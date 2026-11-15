import { findStoredChannel } from "../../store/storedChannel";
import { useCallback, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { ListTodo } from "lucide-react";
import { IconTile, InboxItem, InboxItemBody, InboxItemContent, InboxItemHeading, InboxItemSender, InboxItemLeading, InboxItemTitle, InboxItemTrigger } from "@botiverse/raft-ui";
import { InboxItemLine, InboxItemListGroup } from "@botiverse/raft-ui/wip";

import { useAuthStore } from "../../store/authStore";
import { useTaskStore } from "../../store/taskStore";
import { useChannelSideCardStore } from "../../store/channelSideCardStore";
import { useChannelStore } from "../../store/channelStore";
import { useSearchContentStore } from "../../store/searchContentStore";
import { useTimelineViewStore } from "../../store/timelineViewStore";
import { useThreadStore } from "../../store/threadStore";
import type { Task as AssignedTask } from "../../store/taskStore";
import { forMeTasks, useForMeStore } from "./forMeStore";
import { InboxRowDone } from "./InboxRowDone";

/**
 * Layout redesign (F4): in the inbox's "For me", the tasks assigned to me and
 * not done ("Task #4 is assigned to you"), above the replies and @s. A row
 * opens the task's details in its channel's Tasks panel.
 */
export function InboxAssignedTasks() {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const serverTasks = useTaskStore((s) => s.serverTasks);
  const loaded = useTaskStore((s) => s.serverTasksLoaded);
  const loadServerTasks = useTaskStore((s) => s.loadServerTasks);
  useEffect(() => {
    if (!loaded) void loadServerTasks();
  }, [loaded, loadServerTasks]);
  const doneAt = useForMeStore((s) => s.doneAt);
  const { mine, reviews } = useMemo(() => forMeTasks(serverTasks, viewerId, doneAt), [doneAt, serverTasks, viewerId]);
  if (mine.length === 0 && reviews.length === 0) return null;
  return (
    <InboxItemListGroup className="pb-1" data-testid="inbox-assigned-tasks">
      {reviews.map((task) => <AssignedTaskRow key={`review-${task.id}`} task={task} review />)}
      {mine.map((task) => <AssignedTaskRow key={task.id} task={task} />)}
    </InboxItemListGroup>
  );
}

/** raft-ui InboxItem, as the inbox's other rows: where it is, "Task #N assigned to you", its title. */
function AssignedTaskRow({ task, review = false }: { task: AssignedTask; review?: boolean }) {
  const { formatMessage } = useIntl();
  const open = useCallback(() => openAssignedTaskInInbox(task), [task]);
  const done = useCallback(() => void useForMeStore.getState().markDone([`${review ? "review" : "task"}:${task.id}`]), [review, task.id]);
  const title = formatMessage({ id: review ? "inbox.reviewTask.title" : "inbox.assignedTask.title" }, { number: task.taskNumber });
  return (
    <InboxItem density="compact" data-layout="list" data-testid={`inbox-${review ? "review" : "assigned"}-task-${task.taskNumber}`}>
      <InboxItemTrigger aria-label={title} onClick={open} />
      <InboxItemLeading><IconTile><ListTodo aria-hidden /></IconTile></InboxItemLeading>
      <InboxItemContent>
        <InboxItemHeading><InboxItemTitle>{title}</InboxItemTitle></InboxItemHeading>
        <InboxItemLine>
          {/* The title only, one line (Anna 11/16): a long task title is its whole brief. */}
          <InboxItemBody className="line-clamp-1">
            {task.channelName ? <InboxItemSender>{formatMessage({ id: "inbox.assignedTask.where" }, { channel: task.channelName })}</InboxItemSender> : null}
            {task.title}
          </InboxItemBody>
        </InboxItemLine>
        <InboxRowDone phone={false} label={formatMessage({ id: "inbox.forMe.doneRow" }, { title })} onDone={done} />
      </InboxItemContent>
    </InboxItem>
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
