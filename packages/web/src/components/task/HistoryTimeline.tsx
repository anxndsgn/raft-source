import { TASK_STATUSES } from "@botiverse/raft-shared";
import type { MessageReplyToView } from "@botiverse/raft-shared";
import { CornerUpLeft } from "lucide-react";
import { Timeline, TimelineContent, TimelineItem, TimelineTime, TimelineTitle } from "@botiverse/raft-ui";
import type { TaskStatusId } from "@botiverse/raft-ui";
import { useIntl } from "react-intl";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useTimeFormatter } from "../../hooks/useTimeFormatter";
import { useThreadStore } from "../../store/threadStore";
import type { MessageId } from "../../i18n/messages";
import type { TaskHistoryEvent, TaskStatus } from "../../store/taskStore";
import { toRuiTaskStatus } from "./taskStatusUi";
import { TimelineDetail, TimelineText } from "./TaskProperties";

const TIMELINE_STATUSES: readonly string[] = TASK_STATUSES;

// Resolve the task status a history event is about, so the Timeline marker can
// be painted from that status's own token. The rui Timeline reads the status's
// colour directly (`TimelineItem taskStatus`), so the history dot uses the SAME
// token as every other task-status surface — no local marker palette.
function historyStatus(event: TaskHistoryEvent): TaskStatusId | undefined {
  const candidate = [event.payload.to, event.payload.status, event.payload.from].find(
    (value): value is string => typeof value === "string" && TIMELINE_STATUSES.includes(value),
  );
  const status = (candidate ?? (event.eventType === "closed" ? "closed" : event.eventType === "reopened" ? "in_progress" : undefined)) as TaskStatus | undefined;
  return status ? toRuiTaskStatus(status) : undefined;
}

/** Task history list — lives in its own file so the per-event rows take only
    stable props from TaskProperties (task #709 react-perf). */
export function HistoryTimeline({ history, resolveName, channelId }: {
  history: TaskHistoryEvent[];
  resolveName: (type: "agent" | "user", id: string) => string | null;
  /** The task's channel: a linked message opens there. */
  channelId?: string;
}) {
  const { formatMessage } = useIntl();
  const { formatShortDateTime } = useTimeFormatter();
  return (
    <Timeline size="sm" data-testid="timeline">
      {history.map((event) => {
        const meta = `${event.actorName ?? event.actorType} · ${formatShortDateTime(event.createdAt)}`;
        return (
          <TimelineItem key={event.id} taskStatus={historyStatus(event)}>
            <TimelineTitle><TimelineText text={historyTitle(event, formatMessage)} bold /></TimelineTitle>
            <TimelineTime>{meta}</TimelineTime>
            <TimelineContent>
              {isMessageLinkEvent(event)
                ? <LinkedMessage view={event.payload.message as MessageReplyToView} channelId={channelId} />
                : <TimelineDetail event={event} resolveName={resolveName} formatMessage={formatMessage} />}
            </TimelineContent>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
}

function historyTitle(event: TaskHistoryEvent, formatMessage: ReturnType<typeof useIntl>["formatMessage"]): string {
  const key = ({ created: "task.history.created", amended: "task.history.amended", status_changed: "task.history.statusChanged", assignee_changed: "task.history.assigneeChanged", reopened: "task.history.reopened", closed: "task.history.closed", resource_receipt_recorded: "task.history.receipt", message_linked: "task.history.messageLinked", message_unlinked: "task.history.messageUnlinked" } as Record<string, MessageId>)[event.eventType];
  return key ? formatMessage({ id: key }) : event.eventType;
}

function isMessageLinkEvent(event: TaskHistoryEvent): boolean {
  if (event.eventType !== "message_linked" && event.eventType !== "message_unlinked") return false;
  const view = event.payload.message;
  return Boolean(view && typeof view === "object" && typeof (view as { messageId?: unknown }).messageId === "string");
}

/**
 * Reply mode: the message a `message_linked` / `message_unlinked` event names,
 * shown as a reply quote (author and first line). Clicking it closes the task
 * dialog and opens the message in the channel.
 */
function LinkedMessage({ view, channelId }: { view: MessageReplyToView; channelId?: string }) {
  const { formatMessage } = useIntl();
  const nav = useAppNavigate();
  const closeTaskModal = useThreadStore((s) => s.closeTaskModal);
  const base = "mt-0.5 flex min-w-0 max-w-full items-center gap-1.5 border-l-2 border-line pl-2 text-footnote text-foreground-hint";
  if (view.deleted || !channelId) {
    return (
      <div className={base} data-testid="task-history-linked-message">
        <CornerUpLeft size={12} aria-hidden="true" className="shrink-0" />
        <span className={view.deleted ? "italic" : "min-w-0 truncate"}>{view.deleted ? formatMessage({ id: "task.history.messageDeleted" }) : view.excerpt}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${base} text-left hover:text-foreground-muted`}
      onClick={() => {
        closeTaskModal();
        nav.toMessage(channelId, view.messageId);
      }}
      aria-label={formatMessage({ id: "task.history.openMessage" }, { name: view.senderName ?? "" })}
      data-testid="task-history-linked-message"
    >
      <CornerUpLeft size={12} aria-hidden="true" className="shrink-0" />
      {view.senderName ? <span className="shrink-0 font-medium text-foreground-muted">{view.senderName}</span> : null}
      <span className="min-w-0 truncate">{view.excerpt}</span>
    </button>
  );
}
