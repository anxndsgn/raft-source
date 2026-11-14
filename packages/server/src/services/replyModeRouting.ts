import { sql } from "drizzle-orm";
import { REPLY_CHAIN_AGENT_LOOP_LIMIT, REPLY_CHAIN_PARTICIPANT_WINDOW } from "@botiverse/raft-shared";
import { getDb, type DatabaseExecutor } from "../db/index";

/**
 * Who a message in a reply-mode channel wakes (PRD §7.1). Everyone in the
 * channel can still read it and gets it as unread; this decides only which
 * agents are woken for it:
 *
 * 1. a reply: the original's author and everyone who wrote in the reply
 *    chain above it (the latest REPLY_CHAIN_PARTICIPANT_WINDOW messages);
 * 2. an @mention: the mentioned (handled by the caller, as before);
 * 3./4. linked to tasks: each task's assignee, creator and everyone who
 *    wrote a message linked to it;
 * 5. an agent's message with none of these: no agent;
 * 6. a person's message with none of these: every agent of the channel,
 *    each deciding for itself whether to take it.
 *
 * Loop guard: an agent's reply in a chain that already has more than
 * REPLY_CHAIN_AGENT_LOOP_LIMIT agent messages since its latest human message
 * wakes no agent by the chain (mentions still do).
 */
export type ReplyModeAudience =
  | { kind: "all" }
  | { kind: "some"; agentIds: Set<string>; userIds: Set<string>; loopGuarded: boolean };

type Row = Record<string, unknown>;

/**
 * The reply chain above `messageId` (its ancestors, nearest first), at most
 * `limit` rows, as (sender type, sender id). Ends at a message that is not a
 * reply, a missing (deleted) original, or a cycle.
 */
export async function replyChainAncestors(
  messageId: string,
  limit: number,
  executor?: DatabaseExecutor,
): Promise<Array<{ id: string; senderType: string; senderId: string; messageType: string }>> {
  const db = executor ?? getDb();
  const result = await db.execute(sql`
    WITH RECURSIVE chain(id, reply_to, sender_type, sender_id, message_type, depth, path) AS (
      SELECT o.id, o.reply_to_message_id, o.sender_type, o.sender_id, o.message_type, 1, ARRAY[m.id, o.id]
        FROM messages m JOIN messages o ON o.id = m.reply_to_message_id
       WHERE m.id = ${messageId}
      UNION ALL
      SELECT p.id, p.reply_to_message_id, p.sender_type, p.sender_id, p.message_type, c.depth + 1, c.path || p.id
        FROM chain c JOIN messages p ON p.id = c.reply_to
       WHERE c.depth < ${limit} AND NOT p.id = ANY(c.path)
    )
    SELECT id, sender_type, sender_id, message_type FROM chain ORDER BY depth
  `);
  return (result.rows as Row[]).map((row) => ({
    id: String(row.id),
    senderType: String(row.sender_type),
    senderId: String(row.sender_id),
    messageType: String(row.message_type),
  }));
}

/** Assignee, creator and message authors of the given tasks: agents and users. */
export async function taskFollowers(
  taskIds: readonly string[],
  executor?: DatabaseExecutor,
): Promise<{ agentIds: Set<string>; userIds: Set<string> }> {
  const agentIds = new Set<string>();
  const userIds = new Set<string>();
  if (taskIds.length === 0) return { agentIds, userIds };
  const db = executor ?? getDb();
  const ids = sql.join(taskIds.map((id) => sql`${id}::uuid`), sql`, `);
  const result = await db.execute(sql`
    SELECT created_by_type AS t, created_by_id AS id FROM tasks WHERE id IN (${ids})
    UNION
    SELECT claimed_by_type, claimed_by_id FROM tasks WHERE id IN (${ids}) AND claimed_by_id IS NOT NULL
    UNION
    SELECT m.sender_type, m.sender_id
      FROM message_tasks mt JOIN messages m ON m.id = mt.message_id
     WHERE mt.task_id IN (${ids}) AND m.message_type = 'chat'
  `);
  for (const row of result.rows as Row[]) {
    const type = String(row.t);
    const id = String(row.id);
    if (type === "agent") agentIds.add(id);
    else if (type === "user" && id !== "system") userIds.add(id);
  }
  return { agentIds, userIds };
}

/** The tasks a message is linked to. */
async function linkedTaskIds(messageId: string, executor?: DatabaseExecutor): Promise<string[]> {
  const db = executor ?? getDb();
  const result = await db.execute(sql`SELECT task_id FROM message_tasks WHERE message_id = ${messageId}`);
  return (result.rows as Row[]).map((row) => String(row.task_id));
}

/**
 * The audience of a message in a reply-mode channel (see the module comment).
 * `mentionedAgentIds` are added by the caller's existing mention handling and
 * are not repeated here.
 */
export async function resolveReplyModeAudience(input: {
  message: { id: string; senderType: string; senderId: string; replyToMessageId: string | null };
  executor?: DatabaseExecutor;
}): Promise<ReplyModeAudience> {
  const { message, executor } = input;
  const taskIds = await linkedTaskIds(message.id, executor);
  if (!message.replyToMessageId && taskIds.length === 0) {
    // Case 6 (a person, nothing else): everyone decides for themselves.
    // Case 5 (an agent, nothing else): no one; mentions are added by the caller.
    return message.senderType === "user"
      ? { kind: "all" }
      : { kind: "some", agentIds: new Set(), userIds: new Set(), loopGuarded: false };
  }
  const agentIds = new Set<string>();
  const userIds = new Set<string>();
  let loopGuarded = false;
  if (message.replyToMessageId) {
    const ancestors = await replyChainAncestors(message.id, Math.max(REPLY_CHAIN_PARTICIPANT_WINDOW, REPLY_CHAIN_AGENT_LOOP_LIMIT + 1) * 5, executor);
    // Loop guard: agent messages since the chain's latest human message.
    if (message.senderType === "agent") {
      let agentRun = 1;
      for (const row of ancestors) {
        if (row.senderType === "user" && row.messageType === "chat" && row.senderId !== "system") break;
        if (row.senderType === "agent") agentRun += 1;
      }
      loopGuarded = agentRun > REPLY_CHAIN_AGENT_LOOP_LIMIT;
    }
    if (!loopGuarded) {
      for (const row of ancestors.slice(0, REPLY_CHAIN_PARTICIPANT_WINDOW)) {
        if (row.senderType === "agent") agentIds.add(row.senderId);
        else if (row.senderType === "user" && row.senderId !== "system") userIds.add(row.senderId);
      }
    } else {
      // Humans still hear about it; agents are not woken by the chain.
      for (const row of ancestors.slice(0, REPLY_CHAIN_PARTICIPANT_WINDOW)) {
        if (row.senderType === "user" && row.senderId !== "system") userIds.add(row.senderId);
      }
    }
  }
  if (taskIds.length > 0 && !loopGuarded) {
    const followers = await taskFollowers(taskIds, executor);
    for (const id of followers.agentIds) agentIds.add(id);
    for (const id of followers.userIds) userIds.add(id);
  }
  if (message.senderType === "agent") agentIds.delete(message.senderId);
  if (message.senderType === "user") userIds.delete(message.senderId);
  return { kind: "some", agentIds, userIds, loopGuarded };
}

/**
 * People a message in a reply-mode channel is addressed to (their replies,
 * reply chains and tasks): their notification is personal, like a mention.
 * Empty outside reply mode and for a message that is none of these.
 */
export async function replyModePersonalUserIds(messageId: string, executor?: DatabaseExecutor): Promise<Set<string>> {
  const db = executor ?? getDb();
  const result = await db.execute(sql`
    SELECT m.id, m.sender_type, m.sender_id, m.reply_to_message_id, c.reply_mode
      FROM messages m JOIN channels c ON c.id = m.channel_id
     WHERE m.id = ${messageId}
  `);
  const row = (result.rows as Row[])[0];
  if (!row || row.reply_mode !== true || row.sender_type === "external_projection") return new Set();
  const audience = await resolveReplyModeAudience({
    message: {
      id: String(row.id),
      senderType: String(row.sender_type),
      senderId: String(row.sender_id),
      replyToMessageId: row.reply_to_message_id == null ? null : String(row.reply_to_message_id),
    },
    executor: db,
  });
  return audience.kind === "some" ? audience.userIds : new Set();
}
