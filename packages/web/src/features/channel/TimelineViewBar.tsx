import { ChevronLeft, ListFilter, X } from "lucide-react";
import { useIntl } from "react-intl";

import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useTimelineViewStore, type TimelineViewState } from "../../store/timelineViewStore";

/**
 * Reply mode, step 2: the bar over the timeline while a filtered view is open
 * (PRD step 2 §3): what is shown and how many, "‹ back" to the view it came
 * from, × to everything. It also says what the view leaves out that the
 * person should know of: new messages outside it, and unread ones it hid
 * when opened from Activity (the read position stayed for those).
 */
export function TimelineViewBar({ channelId, view }: { channelId: string; view: TimelineViewState }) {
  const { formatMessage } = useIntl();
  const nav = useAppNavigate();
  const closeView = useTimelineViewStore((s) => s.closeView);
  const backView = useTimelineViewStore((s) => s.backView);
  const spec = view.spec;

  let label: string;
  if (spec.kind === "task") {
    label = spec.title
      ? formatMessage({ id: "timelineView.taskWithTitle" }, { number: spec.taskNumber, title: spec.title })
      : formatMessage({ id: "timelineView.task" }, { number: spec.taskNumber });
  } else if (spec.kind === "chain") {
    // The chain's first message names it (once loaded from the start), else what the entry passed.
    const root = !view.hasMore ? view.messages[0] : undefined;
    const name = root ? (root.senderDisplayName ?? root.senderName ?? "") : (spec.senderName ?? "");
    const excerpt = root ? firstLine(root.content) : (spec.excerpt ?? "");
    label = formatMessage({ id: "timelineView.chain" }, { name, excerpt });
  } else {
    label = formatMessage({ id: "timelineView.mine" });
  }

  const showAllAt = (messageId: string | null) => {
    closeView(channelId);
    if (messageId) nav.toMessage(channelId, messageId);
  };

  return (
    <div
      className="flex min-h-9 items-center gap-2 border-b border-line-hairline bg-layer-canvas px-3 py-1.5 text-callout"
      data-testid="timeline-view-bar"
      data-view-kind={spec.kind}
    >
      {view.prev ? (
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-0.5 rounded-control px-1 text-foreground-muted hover:overlay-subtle"
          onClick={() => backView(channelId)}
          data-testid="timeline-view-back"
        >
          <ChevronLeft size={14} aria-hidden />
          {formatMessage({ id: "timelineView.back" })}
        </button>
      ) : (
        <ListFilter size={14} aria-hidden className="shrink-0 text-foreground-hint" />
      )}
      <span className="min-w-0 truncate font-medium text-foreground" title={label}>{label}</span>
      <span className="shrink-0 text-foreground-hint">·</span>
      <span className="shrink-0 text-foreground-muted" data-testid="timeline-view-count">
        {formatMessage({ id: "timelineView.count" }, { count: view.total })}
      </span>
      {spec.kind === "task" ? (
        <>
          <span className="shrink-0 text-foreground-hint">·</span>
          <span className="min-w-0 truncate text-foreground-muted">{formatMessage({ id: "timelineView.taskSendHint" }, { number: spec.taskNumber })}</span>
        </>
      ) : null}
      <span className="flex-1" />
      {view.hiddenUnread ? (
        <button
          type="button"
          className="shrink-0 rounded-control px-1.5 text-foreground-link hover:overlay-subtle"
          onClick={() => showAllAt(view.hiddenUnread?.firstId ?? null)}
          data-testid="timeline-view-hidden-unread"
        >
          {formatMessage({ id: "timelineView.hiddenUnread" }, { count: view.hiddenUnread.count })}
          {" · "}
          {formatMessage({ id: "timelineView.showAll" })}
        </button>
      ) : view.newOutside > 0 ? (
        <button
          type="button"
          className="shrink-0 rounded-control px-1.5 text-foreground-link hover:overlay-subtle"
          onClick={() => showAllAt(null)}
          data-testid="timeline-view-new-outside"
        >
          {formatMessage({ id: "timelineView.newOutside" }, { count: view.newOutside })}
          {" · "}
          {formatMessage({ id: "timelineView.showAll" })}
        </button>
      ) : null}
      <button
        type="button"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-control text-foreground-hint hover:overlay-subtle hover:text-foreground"
        onClick={() => closeView(channelId)}
        aria-label={formatMessage({ id: "timelineView.close" })}
        title={formatMessage({ id: "timelineView.close" })}
        data-testid="timeline-view-close"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

/** "N hidden · show": the timeline messages a view leaves out between two of its messages. */
export function TimelineViewHiddenRow({ channelId, viewMessageId, count }: { channelId: string; viewMessageId: string; count: number }) {
  const { formatMessage } = useIntl();
  const expandHidden = useTimelineViewStore((s) => s.expandHidden);
  return (
    <div className="flex items-center gap-2 px-4 py-1" data-testid={`timeline-view-hidden-${viewMessageId}`}>
      <span className="h-px flex-1 bg-line-hairline" />
      <button
        type="button"
        className="shrink-0 rounded-control px-2 py-0.5 text-footnote text-foreground-hint hover:overlay-subtle hover:text-foreground-muted"
        onClick={() => { void expandHidden(channelId, viewMessageId); }}
      >
        {formatMessage({ id: "timelineView.hidden" }, { count })}
        {" · "}
        {formatMessage({ id: "timelineView.expand" })}
      </button>
      <span className="h-px flex-1 bg-line-hairline" />
    </div>
  );
}

function firstLine(content: string): string {
  const line = content.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.length > 60 ? `${line.slice(0, 60)}…` : line;
}
