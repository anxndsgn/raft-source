export type TaskStatusId = "backlog" | "todo" | "in-progress" | "in-review" | "done" | "closed";

/** Every status, in the order a board's columns and a list's groups show them:
 *  the way work flows, from Backlog to Closed (design/patterns/tasks.md). */
export const TASK_STATUS_IDS: readonly TaskStatusId[] = [
  "backlog",
  "todo",
  "in-progress",
  "in-review",
  "done",
  "closed",
];

/*
 * A task status's colour is the `task-status-*` token scale (see
 * `foundation.css`): every task-status surface (the pixel, the chip, the badge,
 * the Timeline dot) reads the same token for a given status, so they cannot
 * drift apart (Raft redesign: one colour per status, no soft wash or strong
 * ink; a surface shows the status pixel). Backlog has no colour and no token: every hue already has a
 * meaning and gray is Closed's, so its surfaces are drawn with lines instead
 * (design/foundations/color.md#statuses).
 */
