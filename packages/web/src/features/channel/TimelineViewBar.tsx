import { ArrowLeft, ListFilter } from "lucide-react";
import { Button, PanelAction, TextLink } from "@botiverse/raft-ui";
import { FilterChip, FilterChipLabel, FilterChipRemove } from "@botiverse/raft-ui/wip";
import Tooltip from "../../components/ui/Tooltip";
import { useCallback } from "react";
import { useIntl } from "react-intl";

import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useTimelineViewStore } from "../../store/timelineViewStore";
import type { TimelineViewState } from "../../store/timelineViewStore";

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

  const hiddenFirstId = view.hiddenUnread?.firstId ?? null;
  const close = useCallback(() => closeView(channelId), [channelId, closeView]);
  const back = useCallback(() => backView(channelId), [backView, channelId]);
  const showHiddenUnread = useCallback(() => {
    closeView(channelId);
    if (hiddenFirstId) nav.toMessage(channelId, hiddenFirstId);
  }, [channelId, closeView, hiddenFirstId, nav]);
  const closeLabel = formatMessage({ id: "timelineView.close" });
  // Where ← goes, in its label (raft-ui panel): "Back to Task #3" (Figmama/Anna 11/15).
  const prev = view.prev;
  const prevLabel = !prev ? "" : prev.kind === "task"
    ? formatMessage({ id: "timelineView.task" }, { number: prev.taskNumber })
    : prev.kind === "chain"
      ? formatMessage({ id: "timelineView.chain" }, { name: prev.senderName ?? "", excerpt: prev.excerpt ?? "" })
      : formatMessage({ id: "timelineView.mine" });
  const backLabel = formatMessage({ id: "timelineView.backTo" }, { view: prevLabel });
  // raft-ui pieces: Back (PanelAction, the arrow), the view in effect as a FilterChip with its × (back to everything),
  // what it leaves out as TextLinks.
  return (
    <div
      className="flex min-h-11 items-center gap-2 border-b border-line-hairline bg-layer-canvas px-3 py-1.5 text-callout"
      data-testid="timeline-view-bar"
      data-view-kind={spec.kind}
    >
      {view.prev ? (
        <Tooltip content={backLabel}>
          <PanelAction aria-label={backLabel} onClick={back} data-testid="timeline-view-back"><ArrowLeft /></PanelAction>
        </Tooltip>
      ) : null}
      <FilterChip className="min-w-0 max-w-[60%]" data-testid="timeline-view-chip">
        <ListFilter aria-hidden />
        <FilterChipLabel className="min-w-0 truncate" title={label}>{label}</FilterChipLabel>
        <FilterChipRemove aria-label={closeLabel} onClick={close} data-testid="timeline-view-close" />
      </FilterChip>
      <span className="shrink-0 text-foreground-muted" data-testid="timeline-view-count">
        {formatMessage({ id: "timelineView.count" }, { count: view.total })}
      </span>
      {spec.kind === "task" ? (
        <span className="min-w-0 truncate text-foreground-hint">{formatMessage({ id: "timelineView.taskSendHint" }, { number: spec.taskNumber })}</span>
      ) : null}
      <span className="flex-1" />
      {view.hiddenUnread ? (
        <TextLink render={<button type="button" />} className="shrink-0" onClick={showHiddenUnread} data-testid="timeline-view-hidden-unread">
          {formatMessage({ id: "timelineView.hiddenUnreadShowAll" }, { count: view.hiddenUnread.count })}
        </TextLink>
      ) : view.newOutside > 0 ? (
        <TextLink render={<button type="button" />} className="shrink-0" onClick={close} data-testid="timeline-view-new-outside">
          {formatMessage({ id: "timelineView.newOutsideShowAll" }, { count: view.newOutside })}
        </TextLink>
      ) : null}
    </div>
  );
}

/** "N hidden · show": the timeline messages a view leaves out between two of its messages. */
export function TimelineViewHiddenRow({ channelId, viewMessageId, count }: { channelId: string; viewMessageId: string; count: number }) {
  const { formatMessage } = useIntl();
  const expandHidden = useTimelineViewStore((s) => s.expandHidden);
  const expand = useCallback(() => { void expandHidden(channelId, viewMessageId); }, [channelId, expandHidden, viewMessageId]);
  return (
    <div className="flex items-center gap-2 px-4 py-1" data-testid={`timeline-view-hidden-${viewMessageId}`}>
      <span className="h-px flex-1 bg-line-hairline" />
      <Button type="button" size="sm" variant="ghost" className="shrink-0 text-foreground-hint" onClick={expand}>
        {formatMessage({ id: "timelineView.hiddenExpand" }, { count })}
      </Button>
      <span className="h-px flex-1 bg-line-hairline" />
    </div>
  );
}

function firstLine(content: string): string {
  const line = content.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.length > 60 ? `${line.slice(0, 60)}…` : line;
}
