import { findStoredChannel } from "../../store/storedChannel";
import { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { ListTodo } from "lucide-react";

import { useAuthStore } from "../../store/authStore";
import { useTaskStore } from "../../store/taskStore";
import { useChannelSideCardStore } from "../../store/channelSideCardStore";
import { useChannelStore } from "../../store/channelStore";
import { useSearchContentStore } from "../../store/searchContentStore";
import { useTimelineViewStore } from "../../store/timelineViewStore";
import { useThreadStore } from "../../store/threadStore";
import type { Task as AssignedTask } from "../../store/taskStore";

const OPEN = new Set(["todo", "in_progress", "in_review"]);

/**
 * Layout redesign (F4): in the inbox's "For me", the tasks assigned to me and
 * not done ("Task #4 is assigned to you"), above the replies and @s. A row
 * opens the task's details in its channel's Tasks panel.
 */
export function InboxAssignedTasks() {
  const { formatMessage } = useIntl();
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const serverTasks = useTaskStore((s) => s.serverTasks);
  const loaded = useTaskStore((s) => s.serverTasksLoaded);
  const loadServerTasks = useTaskStore((s) => s.loadServerTasks);
  useEffect(() => {
    if (!loaded) void loadServerTasks();
  }, [loaded, loadServerTasks]);
  const mine = useMemo(
    () => serverTasks
      .filter((t) => t.claimedByType === "user" && t.claimedById === viewerId && OPEN.has(t.status))
      .sort((a, b) => b.taskNumber - a.taskNumber),
    [serverTasks, viewerId],
  );
  if (mine.length === 0) return null;
  return (
    <div className="flex flex-col pb-1" data-testid="inbox-assigned-tasks">
      {mine.map((task) => (
        <button
          key={task.id}
          type="button"
          className="mx-2 flex items-start gap-3 rounded-container px-3 py-2.5 text-left hover:overlay-subtle"
          onClick={() => openAssignedTaskInInbox(task)}
          data-testid={`inbox-assigned-task-${task.taskNumber}`}
        >
          <ListTodo size={16} aria-hidden className="mt-0.5 shrink-0 text-foreground-hint" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-footnote text-foreground-hint">
              {task.channelName
                ? formatMessage({ id: "inbox.assignedTask.kindIn" }, { channel: task.channelName })
                : formatMessage({ id: "inbox.assignedTask.kind" })}
            </span>
            <span className="truncate font-semibold text-foreground">{formatMessage({ id: "inbox.assignedTask.title" }, { number: task.taskNumber })}</span>
            <span className="truncate text-callout text-foreground-muted">{task.title}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Layout redesign (F4): a task row stays in the inbox — its channel opens in the inbox's detail area (filtered to the
 * task where the channel uses replies), the task's details in the side panel. "Open in channel" leaves for the chat.
 */
function openAssignedTaskInInbox(task: AssignedTask) {
  // The side panel follows the row: the thread a previous row opened closes.
  useThreadStore.getState().closeThread();
  useChannelSideCardStore.getState().openTaskDetail(task.channelId, task.id);
  const replyMode = findStoredChannel(useChannelStore.getState(), task.channelId)?.replyMode === true;
  if (replyMode) void useTimelineViewStore.getState().openView(task.channelId, { kind: "task", taskNumber: task.taskNumber, title: task.title });
  useSearchContentStore.getState().open({ kind: "channel", id: task.channelId });
}
