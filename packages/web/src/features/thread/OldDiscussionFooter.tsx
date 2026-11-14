import { useCallback } from "react";
import { useIntl } from "react-intl";
import { CornerUpLeft } from "lucide-react";
import { Button } from "@botiverse/raft-ui";
import { replyExcerpt } from "@botiverse/raft-shared";

import type { Message } from "../../store/messageStore";
import { REPLY_TARGET_FOCUS_EVENT, useReplyTargetStore } from "../../store/replyTargetStore";
import { useThreadStore } from "../../store/threadStore";

/**
 * Reply mode + layout redesign (Figmama 11/15): the foot of a thread from before the channel used replies. No
 * composer; "Reply on the timeline" closes the panel and starts a reply to the thread's original message.
 */
export function OldDiscussionFooter({ parentMessage }: { parentMessage: Message | null }) {
  const { formatMessage } = useIntl();
  const replyOnTimeline = useCallback(() => {
    useThreadStore.getState().closeThread();
    if (!parentMessage) return;
    useReplyTargetStore.getState().setReplyTarget(parentMessage.channelId, {
      messageId: parentMessage.id,
      senderName: parentMessage.senderDisplayName || parentMessage.senderName || "",
      excerpt: replyExcerpt(parentMessage.content ?? ""),
    });
    window.dispatchEvent(new CustomEvent(REPLY_TARGET_FOCUS_EVENT, { detail: { channelId: parentMessage.channelId } }));
  }, [parentMessage]);
  return (
    <div className="flex flex-col gap-2 bg-layer-canvas px-3 pt-2 pb-3" data-testid="old-discussion-footer">
      <p className="text-footnote text-foreground-hint">{formatMessage({ id: "message.reply.oldThreadReadOnly" })}</p>
      <Button type="button" variant="outline" size="md" onClick={replyOnTimeline} disabled={!parentMessage} data-testid="old-discussion-reply-on-timeline">
        <CornerUpLeft aria-hidden data-icon="inline-start" />
        {formatMessage({ id: "message.reply.replyOnTimeline" })}
      </Button>
    </div>
  );
}
