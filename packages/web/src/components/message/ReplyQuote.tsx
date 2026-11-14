import { CornerUpLeft } from "lucide-react";
import { useIntl } from "react-intl";
import type { MessageReplyToView } from "@botiverse/raft-shared";

/**
 * Reply mode: the line above a reply naming what it answers — the original's
 * author and first line. Clicking it scrolls the timeline to the original and
 * highlights it (loading that part of the history first when needed). A
 * deleted original reads "Original message deleted" and does nothing.
 */
export function ReplyQuote({
  messageId,
  replyTo,
  onJump,
}: {
  messageId: string;
  replyTo: MessageReplyToView;
  onJump?: () => void;
}) {
  const { formatMessage } = useIntl();
  const base = "mb-1 flex min-w-0 max-w-full items-center gap-1.5 border-l-2 border-line pl-2 text-footnote text-foreground-hint";
  if (replyTo.deleted) {
    return (
      <div className={base} data-testid={`message-reply-quote-${messageId}`}>
        <CornerUpLeft size={12} aria-hidden="true" className="shrink-0" />
        <span className="italic">{formatMessage({ id: "message.reply.originalDeleted" })}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${base} text-left hover:text-foreground-muted`}
      onClick={(event) => {
        event.stopPropagation();
        onJump?.();
      }}
      aria-label={formatMessage({ id: "message.reply.jumpToOriginal" }, { name: replyTo.senderName ?? "" })}
      data-testid={`message-reply-quote-${messageId}`}
    >
      <CornerUpLeft size={12} aria-hidden="true" className="shrink-0" />
      {replyTo.senderName ? <span className="shrink-0 font-medium text-foreground-muted">{replyTo.senderName}</span> : null}
      <span className="min-w-0 truncate">{replyTo.excerpt}</span>
    </button>
  );
}

/**
 * Reply mode: "N replies" under a message others replied to. Toggles the list
 * of its replies (those loaded on the timeline) right below it; only a view,
 * not a thread.
 */
export function ReplyCountToggle({
  messageId,
  count,
  expanded,
  onToggle,
}: {
  messageId: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <button
      type="button"
      className="mt-1 inline-flex items-center gap-1 text-footnote text-foreground-hint hover:text-foreground-muted"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-expanded={expanded}
      data-testid={`message-reply-count-${messageId}`}
    >
      <CornerUpLeft size={12} aria-hidden="true" className="shrink-0" />
      {expanded
        ? formatMessage({ id: "message.reply.hideReplies" })
        : formatMessage({ id: "message.reply.replyCount" }, { count })}
    </button>
  );
}
