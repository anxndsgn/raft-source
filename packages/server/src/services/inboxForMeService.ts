/**
 * The inbox's "For me" (task #10 item 7, anxndsgn 11/16: opening an item there is handling it): what a person has
 * handled is kept per item (inbox_for_me_done), apart from the channel's read position, which keeps its own rules.
 *
 * - `conv:<conversation channel id>`: replies to them and @s of them in that conversation, handled through
 *   `done_through_seq` (opening the row, its Done, Done all, or the conversation's "What concerns me" view). A later
 *   reply or @ brings the row back.
 * - `task:<id>` (assigned to them), `review:<id>` (waiting for their review), `card:<message id>` (a question to
 *   them): handled at `done_at`; the row also leaves by its own rule (done, reviewed, answered).
 */
import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../db/index";
import { inboxForMeDone, messages } from "../db/schema";
import { inboxItemRowId } from "./channelService";
import type { InboxItem, InboxItemsResult } from "./channelService";

export const FOR_ME_KEY_RE = /^(conv|task|review|card):[0-9a-f-]{36}$/i;
const MAX_KEYS = 200;

const CONVERSATION_KINDS = new Set(["channel", "dm", "thread", "task"]);
function isConversationItem(item: object): item is InboxItem {
  return CONVERSATION_KINDS.has((item as { kind?: string }).kind ?? "");
}

export type ForMeDoneRow = { itemKey: string; doneThroughSeq: number | null; doneAt: string };

/** Parse the body's keys: up to 200 well-formed `kind:uuid`. */
export function parseForMeKeys(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_KEYS) return null;
  if (value.some((key) => typeof key !== "string" || !FOR_ME_KEY_RE.test(key))) return null;
  return [...new Set((value as string[]).map((key) => key.toLowerCase()))];
}

/**
 * Mark items handled now. A conversation is handled through its newest message (the person saw the row at that
 * point); a later handling only moves the mark forward.
 */
export async function markForMeDone(userId: string, serverId: string, keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  const convIds = keys.filter((key) => key.startsWith("conv:")).map((key) => key.slice(5));
  const newest = new Map<string, number>();
  if (convIds.length > 0) {
    const rows = await getDb()
      .select({ channelId: messages.channelId, seq: sql<number>`max(${messages.seq})::bigint` })
      .from(messages)
      .where(inArray(messages.channelId, convIds))
      .groupBy(messages.channelId);
    for (const row of rows) newest.set(row.channelId.toLowerCase(), Number(row.seq));
  }
  const now = new Date();
  await getDb().insert(inboxForMeDone)
    .values(keys.map((itemKey) => ({
      userId,
      serverId,
      itemKey,
      doneThroughSeq: itemKey.startsWith("conv:") ? newest.get(itemKey.slice(5)) ?? 0 : null,
      doneAt: now,
    })))
    .onConflictDoUpdate({
      target: [inboxForMeDone.userId, inboxForMeDone.itemKey],
      set: {
        doneThroughSeq: sql`GREATEST(COALESCE(${inboxForMeDone.doneThroughSeq}, 0), COALESCE(excluded.done_through_seq, 0))`,
        doneAt: now,
      },
    });
}

/** The person's handled items of these kinds (task, review, card), for the web to leave them out. */
export async function listForMeDone(userId: string, serverId: string): Promise<ForMeDoneRow[]> {
  const rows = await getDb()
    .select({ itemKey: inboxForMeDone.itemKey, doneThroughSeq: inboxForMeDone.doneThroughSeq, doneAt: inboxForMeDone.doneAt })
    .from(inboxForMeDone)
    .where(and(eq(inboxForMeDone.userId, userId), eq(inboxForMeDone.serverId, serverId), sql`${inboxForMeDone.itemKey} NOT LIKE 'conv:%'`));
  return rows.map((row) => ({ itemKey: row.itemKey, doneThroughSeq: row.doneThroughSeq, doneAt: row.doneAt.toISOString() }));
}

/**
 * For me's replies and @s (the unread_mentions read) without the conversations handled since their last reply or
 * @ to this person. Asked for page by page; the counts drop what this page leaves out (the list is short: what
 * waits on one person).
 */
export async function withoutHandledConversations<R extends Pick<InboxItemsResult, "totalCount" | "totalUnreadCount"> & { items: readonly object[] }>(userId: string, result: R): Promise<R> {
  const conversations = result.items.filter(isConversationItem);
  const ids = [...new Set(conversations.map((item) => inboxItemRowId(item).toLowerCase()))];
  if (ids.length === 0) return result;
  const done = await getDb()
    .select({ itemKey: inboxForMeDone.itemKey, doneThroughSeq: inboxForMeDone.doneThroughSeq })
    .from(inboxForMeDone)
    .where(and(eq(inboxForMeDone.userId, userId), inArray(inboxForMeDone.itemKey, ids.map((id) => `conv:${id}`))));
  if (done.length === 0) return result;
  const handledThrough = new Map(done.map((row) => [row.itemKey.slice(5), Number(row.doneThroughSeq ?? 0)]));
  // Still waiting: a reply or @ to them after both the handled mark and their read position.
  const candidates = conversations.filter((item) => handledThrough.has(inboxItemRowId(item).toLowerCase()));
  const waiting = new Set<string>();
  if (candidates.length > 0) {
    const rows = await getDb().execute<{ channel_id: string }>(sql`
      SELECT DISTINCT mm.channel_id::text AS channel_id
      FROM message_mentions mm
      JOIN (VALUES ${sql.join(candidates.map((item) => {
        const id = inboxItemRowId(item).toLowerCase();
        const after = Math.max(handledThrough.get(id) ?? 0, item.maxReadSeq ?? 0);
        return sql`(${id}::uuid, ${after}::bigint)`;
      }), sql`, `)}) AS handled(channel_id, after_seq) ON handled.channel_id = mm.channel_id
      WHERE mm.target_type = 'user'
        AND mm.target_id = ${userId}::uuid
        AND (mm.notifiable_at_send OR mm.notified_at IS NOT NULL)
        AND mm.message_seq > handled.after_seq
    `);
    for (const row of rows.rows) waiting.add(row.channel_id.toLowerCase());
  }
  const removed = conversations.filter((item) => {
    const id = inboxItemRowId(item).toLowerCase();
    return handledThrough.has(id) && !waiting.has(id);
  });
  if (removed.length === 0) return result;
  const gone = new Set<object>(removed);
  return {
    ...result,
    items: result.items.filter((item) => !gone.has(item)),
    totalCount: Math.max(0, result.totalCount - removed.length),
    totalUnreadCount: Math.max(0, result.totalUnreadCount - removed.reduce((sum, item) => sum + item.unreadCount, 0)),
  };
}

export type ForMeQuestion = {
  messageId: string;
  channelId: string;
  seq: number;
  title: string | null;
  reason: string | null;
  firstQuestion: string | null;
  expiresAt: string | null;
  askedByAgentId: string | null;
  createdAt: string;
  /** Asked in a thread or a task's conversation: where it lives (the web opens it there, not as a channel). */
  parentChannelId: string | null;
  parentMessageId: string | null;
  /** The conversation's own type ("thread", "task", "channel", ...) and its parent's ("dm" or a channel's). */
  channelType: string;
  parentChannelType: string | null;
};

/**
 * For me's questions: question cards asked of this person, still open (not answered, withdrawn or expired — the
 * sweep may lag `expiresAt`, so it is checked here too), newest first. Reading one does not handle it.
 */
export async function listOpenQuestionsForUser(userId: string, serverId: string): Promise<ForMeQuestion[]> {
  const rows = await getDb().execute<{
    message_id: string; channel_id: string; seq: string | number; title: string | null; reason: string | null;
    first_question: string | null; expires_at: string | null; requester_agent_id: string | null; created_at: Date | string;
    parent_channel_id: string | null; parent_message_id: string | null; channel_type: string; parent_channel_type: string | null;
  }>(sql`
    SELECT ac.message_id::text AS message_id, m.channel_id::text AS channel_id, m.seq,
           m.action_metadata->'presentation'->>'title' AS title,
           ac.payload->>'reason' AS reason,
           ac.payload->'questions'->0->>'text' AS first_question,
           ac.payload->>'expiresAt' AS expires_at,
           ac.requester_agent_id::text AS requester_agent_id,
           ac.created_at,
           c.parent_channel_id::text AS parent_channel_id, c.parent_message_id::text AS parent_message_id,
           c.type AS channel_type, pc.type AS parent_channel_type
    FROM action_cards ac
    JOIN messages m ON m.id = ac.message_id
    JOIN channels c ON c.id = m.channel_id
    LEFT JOIN channels pc ON pc.id = c.parent_channel_id
    WHERE ac.server_id = ${serverId}::uuid
      AND ac.action_type = 'question:ask'
      AND ac.state = 'prepared'
      AND (ac.payload->>'expiresAt' IS NULL OR (ac.payload->>'expiresAt')::timestamptz > now())
      AND ac.payload->'addressee'->>'kind' = 'user'
      AND ac.payload->'addressee'->>'userId' = ${userId}
      AND m.deleted_at IS NULL
    ORDER BY ac.created_at DESC
    LIMIT 50
  `);
  return rows.rows.map((row) => ({
    messageId: row.message_id,
    channelId: row.channel_id,
    seq: Number(row.seq),
    title: row.title,
    reason: row.reason,
    firstQuestion: row.first_question,
    expiresAt: row.expires_at,
    askedByAgentId: row.requester_agent_id,
    createdAt: new Date(row.created_at).toISOString(),
    parentChannelId: row.parent_channel_id,
    parentMessageId: row.parent_message_id,
    channelType: row.channel_type,
    parentChannelType: row.parent_channel_type,
  }));
}
