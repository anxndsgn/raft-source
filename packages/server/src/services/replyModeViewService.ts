import { sql, type SQL } from "drizzle-orm";
import { getDb, type DatabaseExecutor } from "../db/index";
import { ReplyModeRefusal, resolveTaskNumbers } from "./replyModeService";

/**
 * Reply mode, step 2: the channel timeline's filtered views (PRD step 2 §3-§5).
 * One view at a time: a task's messages, one reply chain, or what concerns the
 * viewer. Every view is a set of messages on the channel's own timeline; this
 * file answers "which ids, how many, what lies between them".
 */

export type ReplyModeView =
  | { kind: "task"; taskNumber: number }
  | { kind: "chain"; messageId: string }
  | { kind: "mine" };

export const REPLY_MODE_VIEW_KINDS = ["task", "chain", "mine"] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Parses `?view=task&task=3`, `?view=chain&message=<uuid>`, `?view=mine`. */
export function parseReplyModeView(query: Record<string, unknown>): ReplyModeView {
  const kind = String(query.view ?? "");
  if (kind === "task") {
    const n = Number(String(query.task ?? "").replace(/^#/, ""));
    if (!Number.isInteger(n) || n <= 0) throw new ReplyModeRefusal(400, "view_invalid", "view=task needs task=<number>.");
    return { kind, taskNumber: n };
  }
  if (kind === "chain") {
    const id = String(query.message ?? "").trim().toLowerCase();
    if (!UUID_RE.test(id)) throw new ReplyModeRefusal(400, "view_invalid", "view=chain needs message=<message id>.");
    return { kind, messageId: id };
  }
  if (kind === "mine") return { kind };
  throw new ReplyModeRefusal(400, "view_invalid", "view must be task, chain or mine.");
}

/**
 * A statement selecting `id` and `seq` of every message in the view, on the
 * channel's own timeline (threads of it are not on the timeline).
 */
async function viewMembersSql(channelId: string, view: ReplyModeView, userId: string, db: DatabaseExecutor): Promise<SQL> {
  if (view.kind === "task") {
    const [taskId] = await resolveTaskNumbers(channelId, [view.taskNumber], db);
    return sql`
      SELECT m.id, m.seq FROM message_tasks mt JOIN messages m ON m.id = mt.message_id
       WHERE mt.task_id = ${taskId}::uuid AND m.channel_id = ${channelId}::uuid`;
  }
  if (view.kind === "chain") {
    const [anchor] = (await db.execute(sql`
      SELECT id FROM messages WHERE id = ${view.messageId}::uuid AND channel_id = ${channelId}::uuid
    `)).rows as Array<{ id: string }>;
    if (!anchor) throw new ReplyModeRefusal(404, "view_message_not_found", "That message is not on this channel's timeline.");
    // Up to the chain's root, then every reply under the root (any depth).
    return sql`
      WITH RECURSIVE up(id, reply_to, depth) AS (
        SELECT id, reply_to_message_id, 0 FROM messages WHERE id = ${view.messageId}::uuid
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
         WHERE down.depth < 500 AND m.channel_id = ${channelId}::uuid
      )
      SELECT m.id, m.seq FROM messages m
       WHERE m.id IN (SELECT id FROM down UNION SELECT id FROM up)`;
  }
  // Mine (PRD step 2 §4.3): sent by me; replying to a message of mine; @-ing
  // me; or linked to a task I take part in (I claimed it, created it, or sent
  // a message linked to it). Replies to me are also recorded as mention rows
  // (source 'reply'), the explicit join keeps deleted originals' replies too.
  return sql`
    SELECT m.id, m.seq FROM messages m
     WHERE m.channel_id = ${channelId}::uuid
       AND (
         (m.sender_type = 'user' AND m.sender_id = ${userId})
         OR EXISTS (
           SELECT 1 FROM message_mentions mm
            WHERE mm.message_id = m.id AND mm.target_type = 'user' AND mm.target_id = ${userId}::uuid
         )
         OR EXISTS (
           SELECT 1 FROM messages o
            WHERE o.id = m.reply_to_message_id AND o.sender_type = 'user' AND o.sender_id = ${userId}
         )
         OR EXISTS (
           SELECT 1 FROM message_tasks mt JOIN tasks t ON t.id = mt.task_id
            WHERE mt.message_id = m.id
              AND (
                (t.claimed_by_type = 'user' AND t.claimed_by_id = ${userId})
                OR (t.created_by_type = 'user' AND t.created_by_id = ${userId})
                OR EXISTS (
                  SELECT 1 FROM message_tasks mt2 JOIN messages m2 ON m2.id = mt2.message_id
                   WHERE mt2.task_id = t.id AND m2.sender_type = 'user' AND m2.sender_id = ${userId}
                )
              )
         )
       )`;
}

export type ReplyModeViewPage = {
  /** The page's message ids, oldest first. */
  messageIds: string[];
  /** Whether the view has older messages than this page. */
  hasMore: boolean;
  /** Messages in the whole view. */
  total: number;
  /**
   * For each page message (by id), how many timeline messages lie hidden
   * between it and the view message before it (the page's first message
   * counts back to the view's previous message, or to nothing at the start).
   */
  hiddenBefore: Record<string, number>;
  /** Timeline messages newer than `since` that are not in the view (0 without `since`). */
  newOutside: number;
  /**
   * With `readThrough` (a message's seq): unread timeline messages up to it
   * that are not in the view, counted from the viewer's read position.
   */
  hiddenUnread: { count: number; firstSeq: number | null } | null;
  /** The view's newest seq (0 for an empty view). */
  latestSeq: number;
};

export async function readReplyModeViewPage(opts: {
  channelId: string;
  userId: string;
  view: ReplyModeView;
  limit: number;
  beforeSeq?: number;
  sinceSeq?: number;
  readThroughSeq?: number;
  /** The plan's history cutoff: older messages are out of every view. */
  historyCutoff?: Date;
  executor?: DatabaseExecutor;
}): Promise<ReplyModeViewPage> {
  const db = opts.executor ?? getDb();
  const raw = await viewMembersSql(opts.channelId, opts.view, opts.userId, db);
  const members = opts.historyCutoff
    ? sql`SELECT x.id, x.seq FROM (${raw}) x JOIN messages mc ON mc.id = x.id WHERE mc.created_at > ${opts.historyCutoff.toISOString()}::timestamptz`
    : raw;
  const before = opts.beforeSeq ?? Number.MAX_SAFE_INTEGER;
  const rows = (await db.execute(sql`
    WITH v AS (${members}),
    page AS (
      SELECT id, seq FROM v WHERE seq < ${before} ORDER BY seq DESC LIMIT ${opts.limit + 1}
    ),
    page_prev AS (
      SELECT p.id, p.seq,
             (SELECT max(v.seq) FROM v WHERE v.seq < p.seq) AS prev_seq
        FROM page p
    )
    SELECT pp.id::text AS id, pp.seq::bigint AS seq,
           (SELECT count(*) FROM messages m
             WHERE m.channel_id = ${opts.channelId}::uuid
               AND m.seq < pp.seq AND m.seq > coalesce(pp.prev_seq, 0)
               AND m.id NOT IN (SELECT id FROM v))::int AS hidden
      FROM page_prev pp
     ORDER BY pp.seq DESC
  `)).rows as Array<{ id: string; seq: string | number; hidden: number }>;
  const hasMore = rows.length > opts.limit;
  const pageRows = (hasMore ? rows.slice(0, opts.limit) : rows).reverse();

  const [summary] = (await db.execute(sql`
    WITH v AS (${members})
    SELECT (SELECT count(*) FROM v)::int AS total,
           coalesce((SELECT max(seq) FROM v), 0)::bigint AS latest,
           ${opts.sinceSeq !== undefined
             ? sql`(SELECT count(*) FROM messages m
                     WHERE m.channel_id = ${opts.channelId}::uuid AND m.seq > ${opts.sinceSeq}
                       AND m.id NOT IN (SELECT id FROM v))::int`
             : sql`0`} AS new_outside
  `)).rows as Array<{ total: number; latest: string | number; new_outside: number }>;

  let hiddenUnread: ReplyModeViewPage["hiddenUnread"] = null;
  if (opts.readThroughSeq !== undefined) {
    const [row] = (await db.execute(sql`
      WITH v AS (${members}),
      cursor AS (
        SELECT coalesce((SELECT last_read_seq FROM user_channel_read_cursors
                          WHERE user_id = ${opts.userId}::uuid AND channel_id = ${opts.channelId}::uuid), 0) AS last
      )
      SELECT count(*)::int AS n, min(m.seq)::bigint AS first
        FROM messages m, cursor c
       WHERE m.channel_id = ${opts.channelId}::uuid
         AND m.seq > c.last AND m.seq <= ${opts.readThroughSeq}
         AND m.id NOT IN (SELECT id FROM v)
         AND NOT (m.sender_type = 'user' AND m.sender_id = ${opts.userId})
    `)).rows as Array<{ n: number; first: string | number | null }>;
    hiddenUnread = { count: Number(row?.n ?? 0), firstSeq: row?.first == null ? null : Number(row.first) };
  }

  return {
    messageIds: pageRows.map((row) => row.id),
    hasMore,
    total: Number(summary?.total ?? 0),
    hiddenBefore: Object.fromEntries(pageRows.map((row) => [row.id, Number(row.hidden)])),
    newOutside: Number(summary?.new_outside ?? 0),
    hiddenUnread,
    latestSeq: Number(summary?.latest ?? 0),
  };
}
