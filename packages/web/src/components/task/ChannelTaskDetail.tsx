import { findStoredChannel } from "../../store/storedChannel";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ArrowLeft, ListFilter } from "lucide-react";
import { DescriptionDetails, DescriptionItem, DescriptionTerm, PanelAction, ScrollArea, TextLink } from "@botiverse/raft-ui";
import Tooltip from "../ui/Tooltip";

import api from "../../api/client";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useChannelStore } from "../../store/channelStore";
import type { Task } from "../../store/taskStore";
import { useTimelineViewStore } from "../../store/timelineViewStore";
import { useProfileStore } from "../../store/profileStore";
import { lazyPanel } from "../../boot/deferredUi";
import { TASK_V2_CONVERSATIONS_FLAG_KEY, useServerFeatureFlag } from "../../store/serverFeatureFlags";
import { opensAsTaskConversation } from "../../utils/taskConversation";
import { openTaskConversationDialog } from "./useOpenTask";

// Deferred, its own chunk (check-entry-chunk-structure: MainLayout loads it lazily too).
const TaskModalHead = lazyPanel(() => import("./TaskModalHead"));

/**
 * Layout redesign 4.5 (raft-ui panel): over a task's details the Tasks panel's head is Back — the arrow-left action,
 * first, "Back to tasks", however it was opened — then the task's number as its title.
 */
export function TaskDetailBack({ onBack }: { onBack: () => void }) {
  const { formatMessage } = useIntl();
  // Doc 4.5 (anxndsgn 11/15): a task's details always lead back to its channel's list, however they were opened.
  const label = formatMessage({ id: "panel.backTo.tasks" });
  return (
    <Tooltip content={label}>
      <PanelAction aria-label={label} onClick={onBack} data-testid="channel-task-detail-back"><ArrowLeft /></PanelAction>
    </Tooltip>
  );
}

/**
 * Layout redesign (F2): a task's details in the channel's Tasks panel, in
 * place of the task dialog. "‹ Tasks / #N" goes back to the list. In a channel
 * that uses replies, "N messages" opens the timeline filtered to the task
 * (step 2) and says so while it is.
 */
export function ChannelTaskDetail({ task }: { task: Task }) {
  const { formatMessage } = useIntl();
  const replyMode = useChannelStore((s) => findStoredChannel(s, task.channelId)?.replyMode === true);
  const filtering = useTimelineViewStore((s) => {
    const spec = s.views[task.channelId]?.spec;
    return spec?.kind === "task" && spec.taskNumber === task.taskNumber;
  });
  const nav = useAppNavigate();
  const openProfile = useProfileStore((s) => s.openProfile);
  const [linked, setLinked] = useState<number | null>(null);
  useEffect(() => {
    if (!replyMode) return;
    let cancelled = false;
    api.get(`/tasks/${task.id}/linked-messages`)
      .then(({ data }) => { if (!cancelled) setLinked((data as { count: number }).count); })
      .catch(() => { if (!cancelled) setLinked(0); });
    return () => { cancelled = true; };
  }, [replyMode, task.id, filtering]);

  const openTaskView = useCallback(() => {
    void useTimelineViewStore.getState().openView(task.channelId, { kind: "task", taskNumber: task.taskNumber, title: task.title });
    nav.toChannel(task.channelId);
  }, [nav, task.channelId, task.taskNumber, task.title]);
  const linkedRow = useMemo(() => (replyMode ? (
    <DescriptionItem data-testid="task-detail-linked-messages">
      <DescriptionTerm>{formatMessage({ id: "taskDetail.linkedMessages" })}</DescriptionTerm>
      <DescriptionDetails>
        {linked ? (
          <TextLink
            render={<button type="button" />}
            className="inline-flex items-center gap-1.5 text-left"
            onClick={openTaskView}
          >
            {formatMessage({ id: "task.linkedMessages.count" }, { count: linked })}
            {filtering ? (
              <span className="inline-flex items-center gap-1 font-normal text-foreground-hint">
                <ListFilter size={12} aria-hidden />
                {formatMessage({ id: "taskDetail.filtering" })}
              </span>
            ) : null}
          </TextLink>
        ) : (
          <span className="text-foreground-hint">{linked === 0 ? formatMessage({ id: "taskDetail.noLinkedMessages" }) : "…"}</span>
        )}
      </DescriptionDetails>
    </DescriptionItem>
  ) : null), [filtering, formatMessage, linked, openTaskView, replyMode]);

  // Task v2: a task with its own conversation opens its details here like every task, and the conversation from
  // this row (anxndsgn, card 6aa5ebbb: one behaviour for every task tag).
  const taskV2 = useServerFeatureFlag(TASK_V2_CONVERSATIONS_FLAG_KEY).enabled;
  const hasConversation = opensAsTaskConversation(task, taskV2);
  const openConversation = useCallback(() => openTaskConversationDialog(task), [task]);
  const conversationRow = useMemo(() => (hasConversation ? (
    <DescriptionItem data-testid="task-detail-conversation">
      <DescriptionTerm>{formatMessage({ id: "taskDetail.conversation" })}</DescriptionTerm>
      <DescriptionDetails>
        <TextLink render={<button type="button" />} className="text-left" onClick={openConversation} data-testid="task-detail-open-conversation">
          {formatMessage({ id: "taskDetail.openConversation" })}
        </TextLink>
      </DescriptionDetails>
    </DescriptionItem>
  ) : null), [formatMessage, hasConversation, openConversation]);
  const propertyRows = useMemo(() => ({ trailingRows: <>{conversationRow}{linkedRow}</> }), [conversationRow, linkedRow]);
  const handleOpenProfile = useCallback(
    (kind: "agent" | "human", id: string) => openProfile(kind, id, { openSource: "channel", channelId: task.channelId }),
    [openProfile, task.channelId],
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="channel-task-detail">
      <ScrollArea tabIndex={-1} className="min-h-0 flex-1" contentClassName="pb-4">
        <Suspense fallback={null}>
          <TaskModalHead
            task={task}
            divider={false}
            fullTitle
            propertyRows={propertyRows}
            onOpenProfile={handleOpenProfile}
          />
        </Suspense>
      </ScrollArea>
    </div>
  );
}
