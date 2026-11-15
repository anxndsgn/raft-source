import { findStoredChannel } from "../../store/storedChannel";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ChevronLeft, ListFilter } from "lucide-react";
import { DescriptionDetails, DescriptionItem, DescriptionTerm, ScrollArea } from "@botiverse/raft-ui";

import api from "../../api/client";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useChannelStore } from "../../store/channelStore";
import type { Task } from "../../store/taskStore";
import { useTimelineViewStore } from "../../store/timelineViewStore";
import { useProfileStore } from "../../store/profileStore";
import { useChannelSideCardStore } from "../../store/channelSideCardStore";
import TaskModalHead from "./TaskModalHead";

/**
 * Layout redesign 4.5: the Tasks panel's one title row over a task's details — "‹ Tasks / #N" opened from the list,
 * "#N" alone opened directly (× after it, the panel's). `number` null: the task is gone.
 */
export function TaskDetailCrumb({ channelId, number, onBack }: { channelId: string; number: number | null; onBack: () => void }) {
  const { formatMessage } = useIntl();
  const fromList = useChannelSideCardStore((s) => s.taskDetailFromList[channelId] === true);
  return (
    <div className="flex min-w-0 items-center gap-1 text-headline" data-testid="channel-task-detail-crumb">
      {fromList ? (<>
        <button type="button" className="inline-flex shrink-0 items-center gap-0.5 rounded-control px-1 py-0.5 text-foreground-muted hover:overlay-subtle" onClick={onBack} data-testid="channel-task-detail-back">
          <ChevronLeft size={16} aria-hidden />
          {formatMessage({ id: "task.panel.heading" })}
        </button>
        <span className="text-foreground-hint">/</span>
      </>) : null}
      {number !== null ? <h2 className="truncate font-mono">{formatMessage({ id: "taskDetail.number" }, { number })}</h2> : null}
    </div>
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

  const linkedRow = useMemo(() => (replyMode ? (
    <DescriptionItem data-testid="task-detail-linked-messages">
      <DescriptionTerm>{formatMessage({ id: "taskDetail.linkedMessages" })}</DescriptionTerm>
      <DescriptionDetails>
        {linked ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-left font-medium text-foreground hover:underline"
            onClick={() => {
              void useTimelineViewStore.getState().openView(task.channelId, { kind: "task", taskNumber: task.taskNumber, title: task.title });
              nav.toChannel(task.channelId);
            }}
          >
            {formatMessage({ id: "task.linkedMessages.count" }, { count: linked })}
            {filtering ? (
              <span className="inline-flex items-center gap-1 font-normal text-foreground-hint">
                <ListFilter size={12} aria-hidden />
                {formatMessage({ id: "taskDetail.filtering" })}
              </span>
            ) : null}
          </button>
        ) : (
          <span className="text-foreground-hint">{linked === 0 ? formatMessage({ id: "taskDetail.noLinkedMessages" }) : "…"}</span>
        )}
      </DescriptionDetails>
    </DescriptionItem>
  ) : null), [filtering, formatMessage, linked, nav, replyMode, task.channelId, task.taskNumber, task.title]);

  const propertyRows = useMemo(() => ({ trailingRows: linkedRow }), [linkedRow]);
  const handleOpenProfile = useCallback(
    (kind: "agent" | "human", id: string) => openProfile(kind, id, { openSource: "channel", channelId: task.channelId }),
    [openProfile, task.channelId],
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="channel-task-detail">
      <ScrollArea tabIndex={-1} className="min-h-0 flex-1" contentClassName="pb-4">
        <TaskModalHead
          task={task}
          divider={false}
          propertyRows={propertyRows}
          onOpenProfile={handleOpenProfile}
        />
      </ScrollArea>
    </div>
  );
}
