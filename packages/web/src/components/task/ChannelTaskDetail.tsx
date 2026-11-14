import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { ChevronLeft, ListFilter } from "lucide-react";
import { DescriptionDetails, DescriptionItem, DescriptionTerm, ScrollArea } from "@botiverse/raft-ui";

import api from "../../api/client";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useChannelStore } from "../../store/channelStore";
import type { Task } from "../../store/taskStore";
import { useTimelineViewStore } from "../../store/timelineViewStore";
import { useProfileStore } from "../../store/profileStore";
import TaskModalHead from "./TaskModalHead";

/**
 * Layout redesign (F2): a task's details in the channel's Tasks panel, in
 * place of the task dialog. "‹ Tasks / #N" goes back to the list. In a channel
 * that uses replies, "N messages" opens the timeline filtered to the task
 * (step 2) and says so while it is.
 */
export default function ChannelTaskDetail({ task, onBack }: { task: Task; onBack: () => void }) {
  const { formatMessage } = useIntl();
  const replyMode = useChannelStore((s) => s.channels.find((c) => c.id === task.channelId)?.replyMode === true);
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

  const linkedRow = replyMode ? (
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
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="channel-task-detail">
      <div className="flex shrink-0 items-center gap-1 px-3 pt-2 text-footnote text-foreground-muted">
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded-control px-1 py-0.5 hover:overlay-subtle"
          onClick={onBack}
          data-testid="channel-task-detail-back"
        >
          <ChevronLeft size={14} aria-hidden />
          {formatMessage({ id: "task.panel.heading" })}
        </button>
        <span className="text-foreground-hint">/</span>
        <span className="font-mono">#{task.taskNumber}</span>
      </div>
      <ScrollArea tabIndex={-1} className="min-h-0 flex-1" contentClassName="pb-4">
        <TaskModalHead
          task={task}
          divider={false}
          propertyRows={{ trailingRows: linkedRow }}
          onOpenProfile={(kind, id) => openProfile(kind === "agent" ? "agent" : "human", id, { openSource: "channel", channelId: task.channelId })}
        />
      </ScrollArea>
    </div>
  );
}
