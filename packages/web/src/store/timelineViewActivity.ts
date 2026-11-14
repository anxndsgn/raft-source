import api from "../api/client";
import { useChannelStore } from "./channelStore";
import type { InboxItem } from "./inboxStore";
import { holdReadWhileViewPending, useTimelineViewStore, type TimelineViewSpec } from "./timelineViewStore";

/**
 * Reply mode, step 2 (PRD §5-§6): an Activity channel row in a channel that
 * uses replies opens the view its notification belongs to — a reply to me →
 * the reply chain, a task's message → the task's view, an @ → the full
 * timeline. The read position then moves only up to that message, and only
 * when the view hides no unread message before it (otherwise the row stays
 * and the view's bar counts them): no message is read just to clear a row.
 *
 * Returns the message the row opens at when it took the row (the caller then
 * skips reading the whole channel), else null.
 */
export function openActivityTimelineView(item: Extract<InboxItem, { kind: "channel" | "dm" }>): string | null {
  const channel = useChannelStore.getState().channels.find((c) => c.id === item.channelId);
  if (channel?.replyMode !== true) return null;
  const messageId = item.firstMentionMessageId ?? item.firstUnreadMessageId ?? item.lastMessageId;
  if (!messageId) return null;
  const channelId = item.channelId;
  const releaseHold = holdReadWhileViewPending(channelId);
  void (async () => {
    let spec: TimelineViewSpec | null = null;
    let seq: number | null = null;
    try {
      const { data } = await api.get(`/messages/channel/${channelId}/view-entry?message=${encodeURIComponent(messageId)}`);
      spec = (data as { view: TimelineViewSpec | null }).view;
      seq = (data as { seq: number | null }).seq;
    } catch {
      spec = null;
    }
    const readThrough = (through: number) => {
      void api.post(`/channels/${channelId}/read`, { seq: through }).catch(() => {});
    };
    if (!spec) {
      // The full timeline, at the message: read up to it, nothing is hidden there.
      releaseHold();
      useTimelineViewStore.getState().closeView(channelId);
      if (seq !== null) readThrough(seq);
      return;
    }
    const opening = useTimelineViewStore.getState().openView(channelId, spec, {
      focusMessageId: messageId,
      readThrough: messageId,
      onReadThrough: readThrough,
    });
    // The view holds the read position from here on.
    releaseHold();
    await opening;
  })();
  return messageId;
}
