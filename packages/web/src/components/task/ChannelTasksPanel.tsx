import { useCallback, useContext, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ListTodo, Plus } from "lucide-react";
import {
  Button,
  PanelTitle,
  Tabs,
  TabsLabel,
  TabsList,
  TabsTab,
  ScrollArea,
} from "@botiverse/raft-ui";

import { useAuthStore } from "../../store/authStore";
import { selectChannelTaskBucket, useTaskStore } from "../../store/taskStore";
import type { Task } from "../../store/taskStore";
import { useChannelSideCardStore } from "../../store/channelSideCardStore";
import { TASK_V2_CONVERSATIONS_FLAG_KEY, useServerFeatureFlag } from "../../store/serverFeatureFlags";
import { requestComposerTaskMode } from "../../features/composer/composerTaskMode";
import type { ChannelTasksFilter } from "../../store/channelSideCardStore";
import ChannelSideCard from "./ChannelSideCard";
import { TaskSectionList } from "./TaskSectionList";
import { useChannelStore } from "../../store/channelStore";
import { findStoredChannel } from "../../store/storedChannel";
import EmptyState from "../ui/EmptyState";
import { CreateTaskDialog } from "./DeferredCreateTaskDialog";
import { ChannelTaskDetail, TaskDetailBack } from "./ChannelTaskDetail";

const NO_ACTIONS: never[] = [];
import { SideCardContext } from "./sideCardsLayout";


export function isTaskOnViewer(task: Task, viewerId: string | null | undefined): boolean {
  return !!viewerId && task.claimedByType === "user" && task.claimedById === viewerId;
}

/**
 * The channel's tasks, read beside the conversation (task v2, #wg-task-v2).
 *
 * People mostly don't need to know what each task is; they need to see the
 * work moving and what is waiting on them. So the panel answers two questions:
 * "what are the agents working on here" (All) and "what is on me" (For Me),
 * with the assignee on every card. Details still open in the centered task
 * dialog — the DS keeps task details out of side panels.
 */
export default function ChannelTasksPanel({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const { formatMessage } = useIntl();
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const tasks = useTaskStore((s) => selectChannelTaskBucket(s, channelId));
  const loaded = useTaskStore((s) => s.loadedByChannelId[channelId] ?? false);
  const filter = useChannelSideCardStore((s) => s.taskFilter);
  const setFilter = useChannelSideCardStore((s) => s.setTaskFilter);
  // Layout redesign: a task opens its details here, in place of the task dialog.
  const detailTaskId = useChannelSideCardStore((s) => s.taskDetail[channelId] ?? null);
  const openTaskDetail = useChannelSideCardStore((s) => s.openTaskDetail);
  const closeTaskDetail = useChannelSideCardStore((s) => s.closeTaskDetail);
  const openTask = useCallback((task: Task) => openTaskDetail(channelId, task.id, true), [channelId, openTaskDetail]);
  const backToList = useCallback(() => closeTaskDetail(channelId), [channelId, closeTaskDetail]);
  const detailTask = detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null;
  // Opened but not among the channel's tasks once they are loaded: deleted, or no longer visible (4.5).
  const detailMissing = !!detailTaskId && !detailTask && loaded;
  const [creating, setCreating] = useState(false);
  // No fetch here: the panel only sits beside its own channel, and ChatPanel
  // already loads that channel's tasks (and realtime keeps the bucket live).

  const mine = useMemo(() => tasks.filter((t) => isTaskOnViewer(t, viewerId)), [tasks, viewerId]);
  const created = useMemo(() => tasks.filter((t) => !!viewerId && t.createdByType === "user" && t.createdById === viewerId), [tasks, viewerId]);
  const openCount = (list: Task[]) => list.filter((t) => t.status !== "done" && t.status !== "closed").length;
  const visible = filter === "mine" ? mine : filter === "created" ? created : tasks;
  const replyMode = useChannelStore((st) => findStoredChannel(st, channelId)?.replyMode === true);
  const handleFilterChange = useCallback((value: ChannelTasksFilter) => setFilter(value), [setFilter]);
  // Task v2: a task is a message sent As task (design "新建任务 = 发一条消息"), so "+" turns As task on in the
  // channel's composer beside the card. Covering the conversation (a phone), or with no composer for the
  // channel mounted, it opens the New task dialog.
  const taskV2 = useServerFeatureFlag(TASK_V2_CONVERSATIONS_FLAG_KEY).enabled;
  const covering = useContext(SideCardContext)?.mode === "overlay";
  const openCreate = useCallback(() => {
    // Covering the conversation (a phone): the panel steps aside first, so the composer under it takes the task
    // (task #10 item 2: "+" works the same on a phone).
    if (taskV2 && requestComposerTaskMode(channelId)) {
      if (covering) onClose();
      return;
    }
    setCreating(true);
  }, [channelId, covering, onClose, taskV2]);
  const closeCreate = useCallback(() => setCreating(false), []);

  const newTaskLabel = formatMessage({ id: "task.board.newTask" });
  const newTaskAction = useMemo(() => [{ id: "new-task", label: newTaskLabel, icon: <Plus />, onSelect: openCreate, testId: "channel-tasks-panel-new" }], [newTaskLabel, openCreate]);

  // raft-ui Tabs, underline (tasks.md): each with its number of open tasks in Space Mono.
  const tab = (value: ChannelTasksFilter, labelId: "task.filter.tabAll" | "taskSection.tab.assigned" | "taskSection.tab.created", list: Task[]) => (
    <TabsTab value={value} data-testid={`channel-tasks-filter-${value}`}>
      <TabsLabel>{formatMessage({ id: labelId })}</TabsLabel>
      <span className="font-mono text-mono-meta text-foreground-hint">{openCount(list)}</span>
    </TabsTab>
  );
  const tasksFilter = (
    <Tabs<ChannelTasksFilter> value={filter} onValueChange={handleFilterChange}>
      <TabsList variant="underline" className="w-full" aria-label={formatMessage({ id: "task.sidePanel.filterAria" })}>
        {tab("all", "task.filter.tabAll", tasks)}
        {tab("mine", "taskSection.tab.assigned", mine)}
        {tab("created", "taskSection.tab.created", created)}
      </TabsList>
    </Tabs>
  );
  return (
    <ChannelSideCard
      title={formatMessage({ id: "task.panel.heading" })}
      // Over a task's details its one title row is the crumb (4.5), without "+".
      lead={detailTaskId ? <TaskDetailBack onBack={backToList} /> : undefined}
      titleSlot={detailTaskId ? <PanelTitle className="font-mono" render={<h2>{detailTask ? formatMessage({ id: "taskDetail.number" }, { number: detailTask.taskNumber }) : formatMessage({ id: "task.panel.heading" })}</h2>} /> : undefined}
      closeLabelId="task.sidePanel.close"
      onClose={onClose}
      testId="channel-tasks-panel"
      // Its own action: a button where the head has room, else in its ⋯ (#189 rule 6).
      ownActions={detailTaskId ? NO_ACTIONS : newTaskAction}
      // Layout redesign (anxndsgn, 11/15): no seam under the head; All / Mine right under the title.
      seamless
    >
      {detailTaskId ? null : <div className="shrink-0 px-(--column-margin)" data-testid="channel-tasks-toolbar">{tasksFilter}</div>}
      {detailTask ? (
        <ChannelTaskDetail task={detailTask} />
      ) : detailMissing ? (
        <EmptyState
          icon={<ListTodo />}
          title={formatMessage({ id: "taskDetail.missingTitle" })}
          description={formatMessage({ id: "taskDetail.missingBody" })}
          action={<Button size="md" variant="outline" onClick={backToList} data-testid="channel-task-detail-missing-back">{formatMessage({ id: "taskDetail.backToTasks" })}</Button>}
        />
      ) : detailTaskId ? null : (<>
      {/* Each task row and group heading takes focus, so the list's raft-ui
          ScrollArea is no tab stop. */}
      <ScrollArea tabIndex={-1} className="min-h-0 flex-1" contentClassName="pb-4">
        {visible.length === 0 && loaded ? (
          <EmptyState
            icon={<ListTodo />}
            title={formatMessage({ id: filter === "mine" ? "task.sidePanel.emptyMineTitle" : "task.board.emptyAll" })}
            description={formatMessage({ id: filter === "mine" ? "task.sidePanel.emptyMineBody" : "task.sidePanel.emptyAllBody" })}
          />
        ) : (
          <TaskSectionList tasks={visible} replyMode={replyMode} viewerId={viewerId} openTaskId={detailTaskId} onOpenTask={openTask} />
        )}
      </ScrollArea>
      </>)}
      {creating ? <CreateTaskDialog channelId={channelId} onClose={closeCreate} /> : null}
    </ChannelSideCard>
  );
}
