import type { Channel } from "../../store/channelStore";
import { useChannelSideCardStore } from "../../store/channelSideCardStore";
import { releaseJoinDeferred } from "../../store/joinDeferred";
import { useThreadStore } from "../../store/threadStore";
import { isSidebarExternalSectionChannel } from "../layout/sidebarChannelVisibility";

/** Tagged External in the details (a guest, a guest server or an open invite; or joint): the tag and who-sees line. */
export function channelDetailsExternal(channel: Channel | null | undefined): boolean {
  return channel ? isSidebarExternalSectionChannel(channel) || channel.type === "joint" : false;
}

/**
 * As the channel details open, however they open (the toggle, the channel's name, the archived banner,
 * Announcement settings): right after a join the channel's members and settings load now, not at idle
 * (#proj-frontend:#24); where the row shows its columns as tabs, the details opened last are the tab shown.
 */
export function prepareChannelDetailsOpen(channelId: string, page?: "root") {
  releaseJoinDeferred(channelId);
  const cards = useChannelSideCardStore.getState();
  cards.focusCard("details");
  // The channel's name (4.5 row 4): the info itself, even over its member list.
  if (page === "root") cards.showDetailsRoot();
  // Layout redesign 4.2: the details take the side panel's one place — the thread, Tasks and Files close.
  if (cards.open.tasks) cards.setCardOpen("tasks", false);
  if (cards.open.files) cards.setCardOpen("files", false);
  const thread = useThreadStore.getState();
  if (thread.openParentMessageId && thread.openParentChannelId === channelId && !thread.taskModal) thread.closeThread();
}

// Layout redesign 4.2: a thread (or an old discussion) opened takes the side panel's one place — Tasks and Files close,
// so closing the thread closes the panel (it was opened directly: ×, no Back).
useThreadStore.subscribe((s, prev) => {
  if (!s.openParentMessageId || s.taskModal || s.openParentMessageId === prev.openParentMessageId) return;
  const cards = useChannelSideCardStore.getState();
  if (cards.open.tasks) cards.setCardOpen("tasks", false);
  if (cards.open.files) cards.setCardOpen("files", false);
});
