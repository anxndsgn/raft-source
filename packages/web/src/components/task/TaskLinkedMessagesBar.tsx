import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { ArrowRight } from "lucide-react";

import api from "../../api/client";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import type { Task } from "../../store/taskStore";
import { useTimelineViewStore } from "../../store/timelineViewStore";

/**
 * Reply mode: the task dialog's footer in place of the old task thread's
 * composer. The task's discussion is on the channel's timeline (messages
 * linked to the task), so the dialog only counts them and leads there: the
 * channel's timeline opens filtered to the task (timelineViewStore).
 */
export function TaskLinkedMessagesBar({ task, onNavigate }: { task: Task; onNavigate: () => void }) {
  const { formatMessage } = useIntl();
  const nav = useAppNavigate();
  const [summary, setSummary] = useState<{ count: number; latestMessageId: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.get(`/tasks/${task.id}/linked-messages`)
      .then(({ data }) => { if (!cancelled) setSummary(data as { count: number; latestMessageId: string | null }); })
      .catch(() => { if (!cancelled) setSummary({ count: 0, latestMessageId: null }); });
    return () => { cancelled = true; };
  }, [task.id]);

  const base = "flex min-h-11 w-full items-center gap-2 rounded-container border border-line-hairline px-3 text-callout";
  return (
    <div className="bg-layer-canvas px-3 pt-2 pb-3" data-testid="task-linked-messages-bar">
      {summary && summary.count > 0 && summary.latestMessageId ? (
        <button
          type="button"
          className={`${base} bg-layer-card text-left outline-none hover:overlay-subtle active:overlay-medium focus-visible:shadow-focus`}
          onClick={() => {
            onNavigate();
            void useTimelineViewStore.getState().openView(task.channelId, { kind: "task", taskNumber: task.taskNumber, title: task.title });
            nav.toChannel(task.channelId);
          }}
        >
          <span className="font-medium text-foreground">{formatMessage({ id: "task.linkedMessages.count" }, { count: summary.count })}</span>
          <span className="text-foreground-hint">·</span>
          <span className="flex-1 text-foreground-muted">{formatMessage({ id: "task.linkedMessages.viewInChannel" })}</span>
          <ArrowRight aria-hidden className="size-3.5 shrink-0 text-foreground-hint" />
        </button>
      ) : (
        <div className={`${base} bg-fill-muted text-foreground-hint`}>
          {summary ? formatMessage({ id: "task.linkedMessages.none" }) : formatMessage({ id: "common.loading" })}
        </div>
      )}
    </div>
  );
}
