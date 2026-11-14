import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, type DatabaseExecutor } from "../db/index";
import { channels, messages, messageTasks, tasks, taskEvents } from "../db/schema";
import { messageIdShortPrefixConditions } from "../lib/messageId";
import { replyExcerpt, type MessageReplyToView } from "@botiverse/raft-shared";

/**
 * Reply mode (`channels.reply_mode`, shared/replyMode.ts): data and checks
 * that are not part of routing. Routing lives in replyModeRouting.ts.
 */

/** Whether the channel (a regular channel id) has reply mode on. Unknown ids read as off. */
export async function isReplyModeChannel(channelId: string, executor?: DatabaseExecutor): Promise<boolean> {
  const db = executor ?? getDb();
  const [row] = await db.select({ replyMode: channels.replyMode }).from(channels).where(eq(channels.id, channelId));
  return row?.replyMode === true;
}

/** Reason recorded on the system status change that retires in_review when reply mode is turned on. */
export const REPLY_MODE_RETIRED_IN_REVIEW_REASON = "in_review_retired_for_reply_mode";

/**
 * One-time data steps when a channel turns reply mode on (PRD §8.1), in the
 * same transaction as the flag write. Idempotent: turning it off and on again
 * adds nothing new.
 *
 * 1. Tasks of the channel in `in_review` move to `done` (a system event names
 *    the reason). A task that cannot be done without its resource receipt
 *    is left as it is.
 * 2. Every task's existing discussion is linked in `message_tasks`: its host
 *    message and that message's thread, its source message, and its own
 *    conversation. Only links are added; no message is changed.
 */
export async function onReplyModeEnabled(tx: DatabaseExecutor, channelId: string): Promise<void> {
  const retired = await tx.update(tasks)
    .set({ status: "done", completedAt: sql`now()`, updatedAt: sql`now()`, revision: sql`${tasks.revision} + 1` })
    .where(and(
      eq(tasks.channelId, channelId),
      eq(tasks.status, "in_review"),
      sql`(NOT ${tasks.requiresResourceReceipt} OR ${tasks.resourceReceipt} IS NOT NULL)`,
    ))
    .returning({ id: tasks.id });
  if (retired.length > 0) {
    await tx.insert(taskEvents).values(retired.map((row) => ({
      taskId: row.id,
      eventType: "status_changed" as const,
      actorType: "system" as const,
      actorId: null,
      payload: { from: "in_review", to: "done", reason: REPLY_MODE_RETIRED_IN_REVIEW_REASON },
    })));
  }

  await tx.execute(sql`
    INSERT INTO message_tasks (message_id, task_id, linked_by_type, linked_by_id)
    SELECT m.id, t.id, 'system', NULL
      FROM tasks t
      JOIN messages m ON m.id = t.message_id OR m.id = t.source_message_id
     WHERE t.channel_id = ${channelId}
    UNION
    SELECT m.id, t.id, 'system', NULL
      FROM tasks t
      JOIN channels th ON th.parent_message_id = t.message_id AND th.type = 'thread'
      JOIN messages m ON m.channel_id = th.id
     WHERE t.channel_id = ${channelId} AND m.message_type = 'chat'
    UNION
    SELECT m.id, t.id, 'system', NULL
      FROM tasks t
      JOIN messages m ON m.channel_id = t.conversation_channel_id
     WHERE t.channel_id = ${channelId} AND m.message_type = 'chat'
    ON CONFLICT (message_id, task_id) DO NOTHING
  `);
}

/** Task ids each message is linked to, for the given messages. Messages without links are absent. */
export async function getMessageTaskIds(messageIds: readonly string[], executor?: DatabaseExecutor): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (messageIds.length === 0) return result;
  const db = executor ?? getDb();
  const rows = await db.select({ messageId: messageTasks.messageId, taskId: messageTasks.taskId })
    .from(messageTasks)
    .where(inArray(messageTasks.messageId, [...messageIds]));
  for (const row of rows) {
    const list = result.get(row.messageId) ?? [];
    list.push(row.taskId);
    result.set(row.messageId, list);
  }
  return result;
}

type LinkActor = { type: "user" | "agent" | "system"; id: string | null };

/**
 * Link a message to tasks (`message_tasks`), recording a `message_linked`
 * event on each task that did not have it yet. Idempotent.
 */
export async function linkMessageToTasks(
  executor: DatabaseExecutor,
  messageId: string,
  taskIds: readonly string[],
  actor: LinkActor,
): Promise<string[]> {
  const unique = [...new Set(taskIds)];
  if (unique.length === 0) return [];
  const inserted = await executor.insert(messageTasks)
    .values(unique.map((taskId) => ({ messageId, taskId, linkedByType: actor.type, linkedById: actor.id })))
    .onConflictDoNothing()
    .returning({ taskId: messageTasks.taskId });
  if (inserted.length > 0) {
    await executor.insert(taskEvents).values(inserted.map((row) => ({
      taskId: row.taskId,
      eventType: "message_linked" as const,
      actorType: actor.type,
      actorId: actor.id,
      payload: { messageId },
    })));
  }
  return inserted.map((row) => row.taskId);
}

/** Unlink a message from tasks, recording `message_unlinked` on each that had it. */
export async function unlinkMessageFromTasks(
  executor: DatabaseExecutor,
  messageId: string,
  taskIds: readonly string[] | "all",
  actor: LinkActor,
): Promise<string[]> {
  const removed = await executor.delete(messageTasks)
    .where(and(
      eq(messageTasks.messageId, messageId),
      ...(taskIds === "all" ? [] : [inArray(messageTasks.taskId, taskIds.length > 0 ? [...taskIds] : ["00000000-0000-0000-0000-000000000000"])]),
    ))
    .returning({ taskId: messageTasks.taskId });
  if (removed.length > 0) {
    await executor.insert(taskEvents).values(removed.map((row) => ({
      taskId: row.taskId,
      eventType: "message_unlinked" as const,
      actorType: actor.type,
      actorId: actor.id,
      payload: { messageId },
    })));
  }
  return removed.map((row) => row.taskId);
}

export class ReplyModeRefusal extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ReplyModeRefusal";
  }
}

/**
 * The message `ref` (a full id or an 8-hex short id) names in conversation
 * `channelId`, for a reply: it must be on that conversation's own timeline
 * (not in a thread of it, not elsewhere) and not deleted.
 */
export async function resolveReplyTarget(channelId: string, ref: string, executor?: DatabaseExecutor): Promise<{ id: string; seq: number }> {
  const db = executor ?? getDb();
  const trimmed = ref.trim().toLowerCase().replace(/^msg=/, "");
  const isFull = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmed);
  const isShort = /^[0-9a-f]{8}$/.test(trimmed);
  if (!isFull && !isShort) {
    throw new ReplyModeRefusal(400, "reply_to_invalid", `--reply-to expects a message id (the msg= value), got "${ref}"`);
  }
  const rows = await db.select({ id: messages.id, seq: messages.seq, deletedAt: messages.deletedAt })
    .from(messages)
    .where(and(
      eq(messages.channelId, channelId),
      ...(isFull ? [eq(messages.id, trimmed)] : messageIdShortPrefixConditions(trimmed)),
    ))
    .limit(2);
  if (rows.length === 0) {
    throw new ReplyModeRefusal(404, "reply_to_not_found", `No message ${ref} on this conversation's timeline. You can reply only to a message in the same channel or DM, not to one in a thread or another channel.`);
  }
  if (rows.length > 1) {
    throw new ReplyModeRefusal(409, "reply_to_ambiguous", `More than one message matches ${ref}; use the full message id.`);
  }
  const row = rows[0]!;
  if (row.deletedAt) throw new ReplyModeRefusal(410, "reply_to_deleted", `Message ${ref} was deleted; send without --reply-to.`);
  return { id: row.id, seq: row.seq };
}

/** Task ids for task numbers of a channel; unknown numbers are refused by name. */
export async function resolveTaskNumbers(channelId: string, numbers: readonly number[], executor?: DatabaseExecutor): Promise<string[]> {
  const unique = [...new Set(numbers)];
  if (unique.length === 0) return [];
  const db = executor ?? getDb();
  const rows = await db.select({ id: tasks.id, taskNumber: tasks.taskNumber })
    .from(tasks)
    .where(and(eq(tasks.channelId, channelId), inArray(tasks.taskNumber, unique)));
  const found = new Map(rows.map((row) => [row.taskNumber, row.id]));
  const missing = unique.filter((n) => !found.has(n));
  if (missing.length > 0) {
    throw new ReplyModeRefusal(404, "task_not_found", `No task ${missing.map((n) => `#${n}`).join(", ")} in this channel.`);
  }
  return unique.map((n) => found.get(n)!);
}

/** The task ids a message is linked to. */
export async function getLinkedTaskIds(messageId: string, executor?: DatabaseExecutor): Promise<string[]> {
  const db = executor ?? getDb();
  const rows = await db.select({ taskId: messageTasks.taskId }).from(messageTasks).where(eq(messageTasks.messageId, messageId));
  return rows.map((row) => row.taskId);
}

/** Whether a thread channel hangs off a reply-mode channel (old threads there take no new messages). */
export async function isThreadOfReplyModeChannel(threadChannelId: string, executor?: DatabaseExecutor): Promise<boolean> {
  const db = executor ?? getDb();
  const rows = await db.execute(sql`
    SELECT p.reply_mode AS reply_mode
      FROM channels t JOIN channels p ON p.id = t.parent_channel_id
     WHERE t.id = ${threadChannelId} AND t.type = 'thread'
  `);
  return (rows.rows[0] as { reply_mode?: boolean } | undefined)?.reply_mode === true;
}


/** Display facts of reply mode for a page of messages (messageService enrichment). */
export type ReplyModeMessageFacts = {
  replyTo: Map<string, MessageReplyToView>;
  replyCount: Map<string, number>;
  taskNumbers: Map<string, number[]>;
  /** Which of the rows' channels have reply mode on. */
  replyModeChannelIds: Set<string>;
};

function deletedMessageView(messageId: string): MessageReplyToView {
  return { messageId, senderName: null, senderType: null, excerpt: "", deleted: true, seq: null };
}

/**
 * Author, first line and seq of each message (as a reply quote shows it); a
 * deleted or missing message is `deleted`. Used for reply quotes and for the
 * messages named in a task's history (`message_linked` / `message_unlinked`).
 */
export async function loadMessageViews(messageIds: readonly string[], executor?: DatabaseExecutor): Promise<Map<string, MessageReplyToView>> {
  const views = new Map<string, MessageReplyToView>();
  const ids = [...new Set(messageIds)];
  if (ids.length === 0) return views;
  const db = executor ?? getDb();
  const rows = (await db.execute(sql`
      SELECT m.id, m.seq, m.sender_type, m.content, m.deleted_at,
             COALESCE(u.display_name, u.name, a.display_name, a.name) AS sender_name
        FROM messages m
        LEFT JOIN users u ON m.sender_type = 'user' AND u.id::text = m.sender_id
        LEFT JOIN agents a ON m.sender_type = 'agent' AND a.id::text = m.sender_id
       WHERE m.id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    `)).rows as Array<Record<string, unknown>>;
  for (const row of rows) {
    const id = String(row.id);
    if (row.deleted_at != null) { views.set(id, deletedMessageView(id)); continue; }
    views.set(id, {
      messageId: id,
      senderName: row.sender_name == null ? null : String(row.sender_name),
      senderType: String(row.sender_type) as MessageReplyToView["senderType"],
      excerpt: replyExcerpt(String(row.content ?? "")),
      deleted: false,
      seq: Number(row.seq),
    });
  }
  return views;
}

/**
 * For each message: the original it replies to (author, first line, seq; or
 * deleted), how many replies it has, and the numbers of the tasks it is
 * linked to. Three small reads, keyed by the page's ids.
 */
export async function loadReplyModeMessageFacts(
  rows: ReadonlyArray<{ id: string; channelId: string; replyToMessageId?: string | null }>,
  executor?: DatabaseExecutor,
): Promise<ReplyModeMessageFacts> {
  const facts: ReplyModeMessageFacts = { replyTo: new Map(), replyCount: new Map(), taskNumbers: new Map(), replyModeChannelIds: new Set() };
  if (rows.length === 0) return facts;
  const db = executor ?? getDb();
  const ids = rows.map((row) => row.id);
  const originalIds = [...new Set(rows.map((row) => row.replyToMessageId).filter((id): id is string => typeof id === "string"))];
  const channelIds = [...new Set(rows.map((row) => row.channelId))];
  // One at a time: the caller runs this inside one slot of its query limiter.
  // One statement for the page (two when it has replies): this runs inside
  // one slot of the enrichment's query limiter.
  const combined = (await db.execute(sql`
    SELECT 'count' AS kind, reply_to_message_id::text AS id, count(*)::int AS n
      FROM messages
     WHERE reply_to_message_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
     GROUP BY reply_to_message_id
    UNION ALL
    SELECT 'task', mt.message_id::text, t.task_number
      FROM message_tasks mt JOIN tasks t ON t.id = mt.task_id
     WHERE mt.message_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    UNION ALL
    SELECT 'mode', c.id::text, 0
      FROM channels c
     WHERE c.id IN (${sql.join(channelIds.map((id) => sql`${id}::uuid`), sql`, `)}) AND c.reply_mode
  `)).rows as Array<Record<string, unknown>>;
  const counts = combined.filter((row) => row.kind === "count");
  const links = combined.filter((row) => row.kind === "task").sort((x, y) => Number(x.n) - Number(y.n));
  const modeRows = combined.filter((row) => row.kind === "mode").map((row) => ({ id: String(row.id) }));
  for (const row of modeRows) facts.replyModeChannelIds.add(row.id);
  const views = await loadMessageViews(originalIds, db);
  for (const row of rows) {
    if (!row.replyToMessageId) continue;
    facts.replyTo.set(row.id, views.get(row.replyToMessageId) ?? deletedMessageView(row.replyToMessageId));
  }
  for (const row of counts) facts.replyCount.set(String(row.id), Number(row.n));
  for (const row of links) {
    const list = facts.taskNumbers.get(String(row.id)) ?? [];
    list.push(Number(row.n));
    facts.taskNumbers.set(String(row.id), list);
  }
  return facts;
}

/**
 * `raft message read --replies <msg>`: the chain `ref` is in, oldest first —
 * its originals up to the chain's root, the message itself, and every reply
 * under the root (any depth). At most `limit` rows (the newest kept).
 */
export async function replyChainMessageIds(channelId: string, ref: string, limit: number, executor?: DatabaseExecutor): Promise<string[]> {
  const db = executor ?? getDb();
  const anchor = await resolveReplyTarget(channelId, ref, db).catch(async (err) => {
    // A deleted message still anchors its chain.
    if (err instanceof ReplyModeRefusal && err.code === "reply_to_deleted") {
      const trimmed = ref.trim().toLowerCase();
      const rows = await db.select({ id: messages.id, seq: messages.seq }).from(messages)
        .where(and(eq(messages.channelId, channelId), ...(trimmed.length === 8 ? messageIdShortPrefixConditions(trimmed) : [eq(messages.id, trimmed)])))
        .limit(1);
      if (rows[0]) return rows[0];
    }
    throw err;
  });
  const result = await db.execute(sql`
    WITH RECURSIVE up(id, reply_to, depth) AS (
      SELECT id, reply_to_message_id, 0 FROM messages WHERE id = ${anchor.id}
      UNION ALL
      SELECT m.id, m.reply_to_message_id, up.depth + 1
        FROM up JOIN messages m ON m.id = up.reply_to
       WHERE up.depth < 500
    ),
    root AS (SELECT id FROM up ORDER BY depth DESC LIMIT 1),
    down(id, depth) AS (
      SELECT id, 0 FROM root
      UNION ALL
      SELECT m.id, down.depth + 1
        FROM down JOIN messages m ON m.reply_to_message_id = down.id
       WHERE down.depth < 500 AND m.channel_id = ${channelId}
    )
    SELECT m.id FROM messages m
     WHERE m.id IN (SELECT id FROM down UNION SELECT id FROM up)
     ORDER BY m.seq DESC
     LIMIT ${limit}
  `);
  return (result.rows as Array<Record<string, unknown>>).map((row) => String(row.id)).reverse();
}

/** `raft message read --task <n>`: the messages linked to that task of the channel, oldest first, the newest `limit`. */
export async function taskMessageIds(channelId: string, taskNumber: number, limit: number, executor?: DatabaseExecutor): Promise<string[]> {
  if (!Number.isInteger(taskNumber) || taskNumber <= 0) {
    throw new ReplyModeRefusal(400, "task_invalid", "--task expects a task number like 3 or #3.");
  }
  const db = executor ?? getDb();
  const [taskId] = await resolveTaskNumbers(channelId, [taskNumber], db);
  const result = await db.execute(sql`
    SELECT m.id FROM message_tasks mt JOIN messages m ON m.id = mt.message_id
     WHERE mt.task_id = ${taskId}
     ORDER BY m.seq DESC
     LIMIT ${limit}
  `);
  return (result.rows as Array<Record<string, unknown>>).map((row) => String(row.id)).reverse();
}

/** Task numbers by task id. */
export async function taskNumbersByIds(taskIds: readonly string[], executor?: DatabaseExecutor): Promise<Map<string, number>> {
  if (taskIds.length === 0) return new Map();
  const db = executor ?? getDb();
  const rows = await db.select({ id: tasks.id, n: tasks.taskNumber }).from(tasks).where(inArray(tasks.id, [...new Set(taskIds)]));
  return new Map(rows.map((row) => [row.id, row.n]));
}

