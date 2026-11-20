import type { CSSProperties, SVGProps } from "react";
import type { TaskStatusId } from "./task-status.recipe";

/** Raft draws every status as its pixel: an 8px square, its corner the badge
 *  radius, centred in a 10px box, so an icon slot sized for a glyph still
 *  shows the same pixel (status.md#sizes).
 *
 *  Raft redesign (Figmama 11/18), from the existing variables only: Backlog
 *  and To do are hollow, a 1px edge in hint and in the foreground (told apart
 *  by how dark the edge is); the rest are filled (in progress the working
 *  blue, in review the review yellow, done the idle green, closed hint) with
 *  a 1px hairline inside, so the yellow holds on the canvas. No sticker-ink
 *  edge. Dark mode follows the variables. */
const HAIRLINE = "var(--line-hairline)";
const TASK_STATUS_PIXEL_STYLE: Record<TaskStatusId, CSSProperties> = {
  backlog: { fill: "none", stroke: "var(--foreground-hint)" },
  // Each from its own task-status token, which points at the status/* colour.
  todo: { fill: "none", stroke: "var(--task-status-todo)" },
  "in-progress": { fill: "var(--task-status-in-progress)", stroke: HAIRLINE },
  "in-review": { fill: "var(--task-status-in-review)", stroke: HAIRLINE },
  done: { fill: "var(--task-status-done)", stroke: HAIRLINE },
  closed: { fill: "var(--task-status-closed)", stroke: HAIRLINE },
};

function TaskStatusPixel({
  status,
  className,
  ...props
}: { status: TaskStatusId; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      data-slot="task-status-icon"
      data-status={status}
      width="10"
      height="10"
      overflow="visible"
      className={className}
      {...props}
    >
      {/* 7 + a 1px stroke centred on its edge: 8px outside, the edge inside it. */}
      <rect
        x="50%"
        y="50%"
        width="7"
        height="7"
        strokeWidth="1"
        transform="translate(-3.5 -3.5)"
        style={{ ...TASK_STATUS_PIXEL_STYLE[status], rx: "var(--radius-sticker)" }}
      />
    </svg>
  );
}

export function TaskBacklogIcon(props: SVGProps<SVGSVGElement>) {
  return <TaskStatusPixel status="backlog" {...props} />;
}

export function TaskTodoIcon(props: SVGProps<SVGSVGElement>) {
  return <TaskStatusPixel status="todo" {...props} />;
}

export function TaskInProgressIcon(props: SVGProps<SVGSVGElement>) {
  return <TaskStatusPixel status="in-progress" {...props} />;
}

export function TaskInReviewIcon(props: SVGProps<SVGSVGElement>) {
  return <TaskStatusPixel status="in-review" {...props} />;
}

export function TaskDoneIcon(props: SVGProps<SVGSVGElement>) {
  return <TaskStatusPixel status="done" {...props} />;
}

export function TaskClosedIcon(props: SVGProps<SVGSVGElement>) {
  return <TaskStatusPixel status="closed" {...props} />;
}

export function TaskStatusIcon({
  status,
  className,
  ...props
}: { status: TaskStatusId; className?: string } & SVGProps<SVGSVGElement>) {
  return <TaskStatusPixel status={status} className={className} {...props} />;
}
