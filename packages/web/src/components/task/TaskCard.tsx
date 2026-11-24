import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import {
  TaskCard as RuiTaskCard,
  TaskCardBody,
  TaskCardChannel,
  TaskCardDescription,
  TaskCardLegacy,
  TaskCardMeta,
  TaskCardNumber,
  TaskCardRow,
  TaskCardTitle,
  Skeleton,
} from "@botiverse/raft-ui";
import type { Task, TaskStatus } from "../../store/taskStore";
import { useTaskStore } from "../../store/taskStore";
import { useAuthStore } from "../../store/authStore";
import { useServerPermissions } from "../../hooks/useServerPermissions";
import { TASK_V2_CONVERSATIONS_FLAG_KEY, useServerFeatureFlag } from "../../store/serverFeatureFlags";
import InlineBadgeEditor from "../InlineBadgeEditor";
import { useIntl } from "react-intl";
import { StatusBadge } from "./StatusBadge";
import Tooltip from "../ui/Tooltip";
import { SkeletonTextBar } from "../ui/Skeleton";
import { SKELETON_BADGE_CLASS } from "../ui/skeletonBoxes";
import { TaskBacklogReasonPopover } from "./TaskBacklogReasonPopover";
import { TaskAssigneeAvatar, useTaskAssigneeIdentity } from "./TaskAssignee";

import { useCanWriteTaskChannel } from "./taskChannelWrite";
import { STATUS_STYLES, canEditTaskStatus, getTaskStatusOptions, toRuiTaskStatus } from "./taskStatusUi";

// The card's parts, shared with its placeholder (TaskCardSkeleton): the open
// button that holds the meta, title and description (inline-block, a
// button's own display, so its placeholder sits on the same line box), and
// the foot under it with the status chip.
const TASK_CARD_OPEN_CLASS = "inline-block w-full rounded-control text-left outline-none focus-visible:shadow-focus";
const TASK_CARD_FOOT_CLASS = "mt-2 flex min-w-0 items-center gap-2";
const TASK_ROW_CLASS = "flex h-10 w-full items-center gap-3 rounded-none border-0 border-b border-line-hairline bg-transparent px-3 py-0 hover:bg-fill-subtle hover:bg-none! data-current:hover:bg-fill-cell-selected data-selected:hover:bg-fill-cell-selected";
// The row's status: the 8px square alone in a 20px target, 6px into the row's 12px inset so the square
// sits 12 in, under the group head's; pointed at, a fill-subtle tile says it can be clicked.
const TASK_ROW_STATUS_CLASS = "-ml-1.5 mt-0 size-5 justify-center gap-0 rounded-control bg-transparent px-0 hover:bg-fill-subtle";
const TASK_ROW_OPEN_CLASS = "flex h-full min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:shadow-focus";

// Memoized so a single task update (status change, drag-reorder, socket
// task:* broadcast) re-renders only the changed card, not the whole board.
// `onOpen` takes the task so callsites can pass a *stable* handler instead of
// an inline `() => open(task)` closure that would break this memo for every row
// (#proj-frontend render-perf, same churn class as the channelActivity slice).
function TaskCard({ task, onOpen, showChannelName = true, footerEnd, titleEnd, current = false, selected = false, layout = "card" }: {
  task: Task;
  /** "row": the desktop Tasks page list's 40px line (C13); "card" everywhere else. */
  layout?: "card" | "row";
  /** The card was clicked; the event says with which modifiers (the Tasks page selects on ⌘/Ctrl/Shift). */
  onOpen: (task: Task, event?: MouseEvent) => void;
  showChannelName?: boolean;
  /** Inline after the title, such as the number of messages in the task's
   *  discussion on the Tasks page. Part of the open button. */
  titleEnd?: ReactNode;
  /** The task open beside the board (the Tasks page): the card's button says so. */
  current?: boolean;
  /** Selected on the Tasks page (several tasks acted on at once). */
  selected?: boolean;
  /** Read-only facts shown after the status chip, such as the assignee in the
   *  channel Tasks panel. The chip stays the only thing that edits in place. */
  footerEnd?: ReactNode;
}) {
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
  const currentUser = useAuthStore((s) => s.user);
  const { capabilities } = useServerPermissions();
  const [editingStatus, setEditingStatus] = useState(false);
  const [askingBacklogReason, setAskingBacklogReason] = useState(false);
  const statusChipRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const canManageServer = capabilities.deleteAnyTask;
  const canEditStatus = canEditTaskStatus(task, currentUser?.id, canManageServer, useCanWriteTaskChannel(task.channelId));
  const { formatMessage } = useIntl();
  const currentUserId = currentUser?.id;
  const taskV2 = useServerFeatureFlag(TASK_V2_CONVERSATIONS_FLAG_KEY).enabled;
  const statusOptions = useMemo(
    () => getTaskStatusOptions(task, currentUserId, canManageServer, taskV2)
      .map((option) => ({ id: option.id, label: formatMessage({ id: option.labelId }) })),
    [task, currentUserId, canManageServer, taskV2, formatMessage],
  );
  const style = STATUS_STYLES[task.status];

  const handleStatusSelect = useCallback(async (id: string) => {
    const nextStatus = id as TaskStatus;
    if (nextStatus === task.status) {
      setEditingStatus(false);
      return;
    }
    if (nextStatus === "backlog") {
      // A move into Backlog asks for a reason first; the popover makes the write.
      setEditingStatus(false);
      setAskingBacklogReason(true);
      return;
    }
    setBusy(true);
    try {
      await updateTaskStatus(task.channelId, task.id, nextStatus);
      setEditingStatus(false);
    } catch (err) {
      console.error("Failed to update task status:", err);
    } finally {
      setBusy(false);
    }
  }, [task.status, task.channelId, task.id, updateTaskStatus]);

  const toggleStatusEditor = useCallback(() => setEditingStatus((prev) => !prev), []);
  const closeStatusEditor = useCallback(() => setEditingStatus(false), []);
  const closeBacklogReason = useCallback(() => setAskingBacklogReason(false), []);

  const statusControl = (
    canEditStatus ? (
          <div className={`relative shrink-0 ${busy ? "pointer-events-none" : ""}`}>
            <InlineBadgeEditor
              badgeStatus={toRuiTaskStatus(task.status)}
              displayValue={formatMessage({ id: style.labelId })}
              selectedId={task.status}
              options={statusOptions}
              onSelect={handleStatusSelect}
              open={editingStatus}
              onToggle={toggleStatusEditor}
              onRequestClose={closeStatusEditor}
              triggerRef={statusChipRef}
              badgeClassName=""
              iconOnly={layout === "row"}
              buttonTitle={layout === "row" ? formatMessage({ id: style.labelId }) : undefined}
              buttonClassName={layout === "row" ? TASK_ROW_STATUS_CLASS : undefined}
              dropdownMinWidth="min-w-[140px]"
              dropdownAlign="left"
              dropdownTestId="task-status-menu"
              optionTestIdPrefix="task-status-option"
            />
            <TaskBacklogReasonPopover
              open={askingBacklogReason}
              task={task}
              anchor={statusChipRef}
              finalFocus={statusChipRef}
              onClose={closeBacklogReason}
            />
          </div>
        ) : (
          layout === "row" ? (
            <Tooltip content={formatMessage({ id: style.labelId })}>
              <StatusBadge status={task.status} data-testid="task-status-readonly" className={TASK_ROW_STATUS_CLASS}>
                <span className="sr-only">{formatMessage({ id: style.labelId })}</span>
              </StatusBadge>
            </Tooltip>
          ) : (
            <StatusBadge status={task.status} data-testid="task-status-readonly">
              {formatMessage({ id: style.labelId })}
            </StatusBadge>
          )
        )
  );

  if (layout === "row") {
    const rowNumber = `#${task.taskNumber}`;
    const rowChannel = `#${task.channelName || formatMessage({ id: "task.legacyPanel.unknownChannel" })}`;
    // C13 list row (desktop Tasks page): one 40px line, the status chip, the
    // number, the title, the channel, then the row's own facts; rows meet on a hairline.
    return (
      <RuiTaskCard
        className={`${TASK_ROW_CLASS} ${selected ? "bg-fill-cell-selected inset-ring-2 inset-ring-info" : current ? "bg-fill-cell-selected" : ""}`}
        data-current={current ? "" : undefined}
        data-selected={selected ? "" : undefined}
        data-layout="row"
      >
        <div className="flex shrink-0 items-center">{statusControl}</div>
        <button
          type="button"
          onClick={(event) => onOpen(task, event)}
          aria-current={current ? "true" : undefined}
          className={TASK_ROW_OPEN_CLASS}
        >
          <TaskCardNumber className="w-10">{rowNumber}</TaskCardNumber>
          <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-foreground">
            {task.title}
            {titleEnd ? <span className="ml-1.5 inline-block">{titleEnd}</span> : null}
          </span>
          {task.isLegacy && <TaskCardLegacy>{formatMessage({ id: "task.badge.legacy" })}</TaskCardLegacy>}
          {showChannelName && (
            <TaskCardChannel className="max-w-48 shrink-0">{rowChannel}</TaskCardChannel>
          )}
        </button>
        {footerEnd ? <div className="flex min-w-0 shrink-0 items-center">{footerEnd}</div> : <CardAssignee task={task} />}
      </RuiTaskCard>
    );
  }

  return (
    // The task open beside the board, or selected: the cell's selected fill, as
    // its row in a list; selected also rings it, so a run of picks reads apart.
    <RuiTaskCard
      className={selected ? "w-full bg-fill-cell-selected inset-ring-2 inset-ring-info" : current ? "w-full bg-fill-cell-selected" : "w-full"}
      data-current={current ? "" : undefined}
      data-selected={selected ? "" : undefined}
    >
      <button
        type="button"
        onClick={(event) => onOpen(task, event)}
        aria-current={current ? "true" : undefined}
        className={TASK_CARD_OPEN_CLASS}
      >
        <TaskCardRow>
          <TaskCardBody>
            <TaskCardMeta>
              {showChannelName && (
                <TaskCardChannel>
                  #{task.channelName || formatMessage({ id: "task.legacyPanel.unknownChannel" })}
                </TaskCardChannel>
              )}
              <TaskCardNumber>#{task.taskNumber}</TaskCardNumber>
              {task.isLegacy && (
                <TaskCardLegacy>
                  {formatMessage({ id: "task.badge.legacy" })}
                </TaskCardLegacy>
              )}
            </TaskCardMeta>
            <TaskCardTitle>
              {task.title}
              {titleEnd ? <span className="ml-1.5 inline-block">{titleEnd}</span> : null}
            </TaskCardTitle>
            {task.description && (
              <TaskCardDescription>
                {task.description}
              </TaskCardDescription>
            )}
          </TaskCardBody>
        </TaskCardRow>
      </button>
      {/* Raft DS TaskCard foot: the status chip is the only thing on the card
          that edits in place. A pending write only blocks pointer input. */}
      <div className={TASK_CARD_FOOT_CLASS}>
        {statusControl}
        {footerEnd ? <div className="ml-auto flex min-w-0 items-center">{footerEnd}</div> : <CardAssignee task={task} className="ml-auto" />}
      </div>
    </RuiTaskCard>
  );
}

export default memo(TaskCard);

/**
 * C13, desktop: who has the task, as their 16px round avatar (the name on hover). A card given its own
 * footer facts (a channel's panel names the assignee there) doesn't draw it; nor does an unclaimed task.
 */
function CardAssignee({ task, className = "" }: { task: Task; className?: string }) {
  const { identity } = useTaskAssigneeIdentity(task);
  if (!task.claimedById || !task.claimedByType) return null;
  const name = identity?.displayName || identity?.name || task.claimedByName || "";
  return (
    <Tooltip content={name}>
      <span role="img" aria-label={name} className={`hidden size-4 shrink-0 overflow-hidden rounded-full md:pointer-fine:flex *:size-4! *:rounded-full! ${className}`} data-testid="task-card-assignee">
        <TaskAssigneeAvatar task={task} identity={identity} />
      </span>
    </Tooltip>
  );
}

/**
 * A task card while its column or group loads: TaskCard's own card, open
 * button box, meta line, a title of two lines (a title wraps in a board
 * column; most tasks have no description) and the foot with a chip-sized
 * block, so it is a loaded card's size (Raft DS TaskCard).
 */
export function TaskCardSkeleton() {
  return (
    <RuiTaskCard className="w-full" aria-hidden="true" data-skeleton="">
      <div className={TASK_CARD_OPEN_CLASS}>
        <TaskCardRow>
          <TaskCardBody>
            <TaskCardMeta>
              <TaskCardNumber><SkeletonTextBar className="w-16" /></TaskCardNumber>
            </TaskCardMeta>
            {/* A div where the card has a p: a skeleton bar is a div. */}
            <TaskCardTitle render={<div />}>
              <div><SkeletonTextBar className="w-full" /></div>
              <div><SkeletonTextBar className="w-1/2" /></div>
            </TaskCardTitle>
          </TaskCardBody>
        </TaskCardRow>
      </div>
      <div className={TASK_CARD_FOOT_CLASS}>
        {/* The status chip's box; the editable chip sits 2px low (InlineBadgeEditor). */}
        <Skeleton className={`mt-0.5 w-24 ${SKELETON_BADGE_CLASS}`} />
      </div>
    </RuiTaskCard>
  );
}
