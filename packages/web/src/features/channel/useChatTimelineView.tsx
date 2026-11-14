import { useCallback, useContext, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { IntlShape } from "react-intl";
import type { ReactNode } from "react";

import type { Channel } from "../../store/channelStore";
import type { Message } from "../../store/messageStore";
import type { Task } from "../../store/taskStore";
import { timelineViewRows, useTimelineViewStore } from "../../store/timelineViewStore";
import type { TimelineViewState } from "../../store/timelineViewStore";
import { useThreadStore } from "../../store/threadStore";
import { useLocation } from "react-router-dom";
import { useIntl as useIntlHook } from "react-intl";
import { ChevronRight } from "lucide-react";
import { PanelAction } from "@botiverse/raft-ui";
import { useSearchContentStore } from "../../store/searchContentStore";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import type { MessageTimelineSource } from "../../components/message/messageTimelineShared";
import { TimelineViewHiddenRow } from "./TimelineViewBar";
import { ConversationHeaderSlotContext } from "../../components/layout/rowColumnSlot";
import { useIsDesktopShell } from "../../components/layout/ShellFrame";

/**
 * Reply mode, step 2: ChatPanel's part of a filtered view of the timeline
 * (timelineViewStore). The view shows its own messages (with "N hidden" rows
 * between them) in place of the channel's, follows the channel live, and
 * loads its own older pages.
 */
export function useChatTimelineView(channel: Channel | null, seqMessages: readonly Message[], base: { messages: Message[]; hasMore: boolean; loading: boolean }) {
  const channelId = channel?.id ?? null;
  const view = useTimelineViewStore((s) => (channelId && channel?.replyMode === true ? s.views[channelId] ?? null : null));
  const rows = useMemo(() => (view ? timelineViewRows(view) : null), [view]);
  const open = view !== null;
  // Anything new or changed on the timeline (a message, an edit, a task link) reads the view again, a little later.
  useEffect(() => {
    if (!open || !channelId) return;
    const timer = setTimeout(() => { void useTimelineViewStore.getState().refreshView(channelId); }, 400);
    return () => clearTimeout(timer);
  }, [open, channelId, seqMessages]);
  return {
    view,
    rows,
    messages: rows ? rows.messages : base.messages,
    hasMore: view ? view.hasMore : base.hasMore,
    loading: view ? view.loading && view.messages.length === 0 : base.loading,
  };
}

/** The timeline's source while a view is open: its rows, its older pages, no newer ones. */
export function timelineViewSource(view: TimelineViewState, messages: Message[], loading: boolean, loadOlder: () => Promise<void>): MessageTimelineSource {
  return {
    messages,
    hasOlder: view.hasMore,
    hasNewer: false,
    loading,
    loadOlder,
    loadNewer: () => Promise.resolve(),
    initialFocusMessageId: view.focusMessageId,
    initialAtStart: false,
    atStartKey: null,
  };
}

/** Wraps the timeline's row renderer: a "N hidden · show" row before a message the view skipped to. */
export function useViewHiddenRows(
  renderItem: (msg: Message, index: number) => ReactNode,
  rows: ReturnType<typeof timelineViewRows> | null,
  channelId: string | null,
) {
  return useCallback((msg: Message, index: number) => {
    const hidden = rows?.hiddenRowBefore.get(msg.id);
    const rendered = renderItem(msg, index);
    if (!hidden || !channelId) return rendered;
    return (
      <>
        <TimelineViewHiddenRow channelId={channelId} viewMessageId={hidden.viewMessageId} count={hidden.count} />
        {rendered}
      </>
    );
  }, [rows, channelId, renderItem]);
}

/** The head's "What concerns me" switch (desktops only: phones have no views), and the Tasks switch's count. */
export function useMineViewSwitch(channel: Channel | null, view: TimelineViewState | null, desktop: boolean, tasks: readonly Task[] | undefined) {
  const channelId = channel?.id ?? null;
  const openTaskCount = useMemo(() => (tasks ?? []).filter((t) => t.status !== "done" && t.status !== "closed").length, [tasks]);
  const mineOpen = view?.spec.kind === "mine";
  const toggle = useCallback(() => {
    if (!channelId) return;
    const store = useTimelineViewStore.getState();
    if (store.views[channelId]?.spec.kind === "mine") store.closeView(channelId);
    else void store.openView(channelId, { kind: "mine" });
  }, [channelId]);
  const available = channel?.replyMode === true && channel?.type !== "dm" && desktop;
  const mineView = useMemo(() => (available ? { open: mineOpen, onToggle: toggle } : null), [available, mineOpen, toggle]);
  return { mineView, openTaskCount };
}

/** The composer's placeholder in a task view: "Message #channel · linked to Task #3". */
export function timelineViewComposerPlaceholder(view: TimelineViewState | null, channelName: string, formatMessage: IntlShape["formatMessage"]): string | undefined {
  return view?.spec.kind === "task"
    ? formatMessage({ id: "timelineView.composerTask" }, { channel: `#${channelName}`, number: view.spec.taskNumber })
    : undefined;
}

/**
 * Layout redesign: on a desktop the page's own conversation puts its header
 * above MainLayout's row (ConversationHeaderSlotContext), spanning the
 * timeline and the side panel.
 */
export function useConversationHeaderPortal(ownsUrl: boolean) {
  const slot = useContext(ConversationHeaderSlotContext);
  const desktop = useIsDesktopShell();
  const portalHeader = (header: ReactNode) => (slot && ownsUrl && desktop ? createPortal(header, slot) : header);
  return { portalHeader, desktop };
}

/**
 * Layout redesign (Figmama 11/15): a thread open in this channel holds the side panel's place. The Tasks and Files
 * switches don't show pressed meanwhile, and pressing one closes the thread and shows that panel.
 */
export function useThreadAwareCardToggles(channelId: string | null, cards: { tasksCardOpen: boolean; filesCardOpen: boolean; toggleTasksCard: () => void; toggleFilesCard: () => void }) {
  const { tasksCardOpen, filesCardOpen, toggleTasksCard, toggleFilesCard } = cards;
  const threadHere = useThreadStore((s) => !!s.openParentMessageId && s.openParentChannelId === channelId && !s.taskModal);
  const showTasksCard = useCallback(() => {
    if (!threadHere) return toggleTasksCard();
    useThreadStore.getState().closeThread();
    if (!tasksCardOpen) toggleTasksCard();
  }, [threadHere, tasksCardOpen, toggleTasksCard]);
  const showFilesCard = useCallback(() => {
    if (!threadHere) return toggleFilesCard();
    useThreadStore.getState().closeThread();
    if (!filesCardOpen) toggleFilesCard();
  }, [threadHere, filesCardOpen, toggleFilesCard]);
  return { threadHere, showTasksCard, showFilesCard };
}

/**
 * Layout redesign (F4): a channel the inbox opened beside its list says how to leave for it — "Open in channel ›"
 * switches to the chat with that channel selected. Null anywhere else.
 */
export function useOpenInChannelAction(channelId: string | null): ReactNode {
  const { formatMessage } = useIntlHook();
  const nav = useAppNavigate();
  const inInbox = useLocation().pathname.endsWith("/activity");
  const shown = useSearchContentStore((s) => inInbox && !!channelId && s.slot?.id === channelId);
  const open = useCallback(() => { if (channelId) nav.toChannel(channelId); }, [channelId, nav]);
  if (!shown) return null;
  return (
    <PanelAction onClick={open} data-testid="inbox-open-in-channel">
      {formatMessage({ id: "inbox.openInChannel" })}
      <ChevronRight aria-hidden />
    </PanelAction>
  );
}
