import type { MouseEvent, ReactNode } from "react";

/**
 * A row of Raft Chat's Tasks section (raft-design tasks.md › Rows in the Tasks section): two lines — the title
 * (wrapping to two, then an ellipsis), then who has it and how it stands now — plus, for an agent at work, its
 * current step; at the end the time since it last moved and the row's one action. The whole row is the target
 * (`onOpen`); the action sits above it. Its padding is the section's margin (`--column-margin`).
 */
export function TaskSectionRow({ status, title, openLabel, onOpen, selected = false, state, step, time, action, ...props }: {
  /** The status pixel (raft-ui TaskStatusIcon at 10px). */
  status: ReactNode;
  title: ReactNode;
  /** The row's name for a screen reader ("Open Task #4"). */
  openLabel: string;
  onOpen: () => void;
  /** The task open in the section's details. */
  selected?: boolean;
  /** The state line: the parts in order (number, assignee, live state), joined by middle dots. */
  state: ReactNode[];
  /** An agent at work: its current step, in Space Mono. */
  step?: ReactNode;
  /** Since it last moved, in Space Mono. */
  time?: ReactNode;
  /** Review or Claim (raft-ui Button size="sm"). */
  action?: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <div
      {...props}
      data-selected={selected ? "" : undefined}
      className="group/task-row relative flex gap-2.5 px-(--column-margin,16px) py-2.5 hover:overlay-subtle has-[>button:active]:overlay-medium data-selected:bg-fill-cell-selected"
    >
      <button type="button" aria-label={openLabel} aria-current={selected ? "true" : undefined} onClick={onOpen} className="absolute inset-0 z-0 cursor-pointer outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-ink" />
      <span className="pointer-events-none mt-[0.45em] flex size-2.5 shrink-0 items-center justify-center">{status}</span>
      <div className="pointer-events-none flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-callout text-foreground">{title}</span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-foreground-muted">
          {state.filter(Boolean).flatMap((part, index) => (index === 0 ? [<span key={index} className="flex min-w-0 items-center gap-1">{part}</span>] : [
            <span key={`dot-${index}`} aria-hidden className="text-foreground-hint">·</span>,
            <span key={index} className="flex min-w-0 items-center gap-1">{part}</span>,
          ]))}
        </span>
        {step ? <span className="mt-0.5 truncate font-mono text-caption text-foreground-hint">{step}</span> : null}
      </div>
      {time || action ? (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {time ? <span className="pointer-events-none text-caption text-foreground-hint tabular-nums">{time}</span> : null}
          {action ? <span className="relative z-raised" onClick={stop}>{action}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** The action is pressed, not the row. */
function stop(event: MouseEvent) {
  event.stopPropagation();
}
