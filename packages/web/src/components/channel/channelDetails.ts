import type { Channel } from "../../store/channelStore";
import { useChannelSideCardStore } from "../../store/channelSideCardStore";
import { releaseJoinDeferred } from "../../store/joinDeferred";
import { useThreadStore } from "../../store/threadStore";
import { useArtifactViewerStore, workspaceThreadTabId } from "../../apps/artifacts/artifactViewerStore";
import { setProfileOpenInterceptor } from "../../store/profileStore";
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
  // Already a workspace tab (§5): that tab shows, not a second copy in the side panel.
  const viewer = useArtifactViewerStore.getState();
  const tabId = workspaceThreadTabId(s.openParentMessageId);
  if (viewer.tabs.some((t) => t.id === tabId)) {
    viewer.activateTab(tabId as never);
    queueMicrotask(() => useThreadStore.getState().closeThread());
    return;
  }
  const cards = useChannelSideCardStore.getState();
  if (cards.open.tasks) cards.setCardOpen("tasks", false);
  if (cards.open.files) cards.setCardOpen("files", false);
});

/**
 * Layout redesign 7.1: a person clicked in a conversation (avatar, name, @mention, a task's assignee) opens in the
 * channel's side panel — its members page, on their details (‹ Members), replacing what was there; a desktop only.
 */
setProfileOpenInterceptor((type, id, channelId) => {
  if (typeof window === "undefined" || window.innerWidth < 768) return false;
  prepareChannelDetailsOpen(channelId);
  useChannelSideCardStore.setState({ memberDetail: { channelId, type, id, at: Date.now() } });
  return true;
});
