import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isSidebarSlotHidden, setSidebarSlotHidden } from "./sidebarToggle";

/** Whether an element has child elements now, kept current as they come and go. */
export function useHasChildElements(element: HTMLElement | null): boolean {
  const [has, setHas] = useState(false);
  useLayoutEffect(() => {
    if (!element) {
      setHas(false);
      return;
    }
    const read = () => setHas(element.childElementCount > 0);
    read();
    const observer = new MutationObserver(read);
    observer.observe(element, { childList: true });
    return () => observer.disconnect();
  }, [element]);
  return has;
}

/** The narrowest the conversation keeps beside an expanded workspace. */
const CONVERSATION_MIN = 360;
/** The sidebar's default width: what an expanded workspace takes when the sidebar was already folded away. */
const SIDEBAR_DEFAULT = 232;

/**
 * Raft redesign (Figmama / anxndsgn 11/21): expanding the workspace folds the
 * sidebar away and gives the workspace its width; the conversation keeps the
 * width it had. Restoring puts back exactly what was there before: a sidebar
 * that was open opens again, one that was already folded stays folded (and
 * then the workspace takes the room a sidebar would have had).
 *
 * Returns the conversation's width to hold while expanded (px), or null.
 */
export function useWorkspaceExpandLayout({
  expanded,
  sidebarOpen,
  onSidebarOpenChange,
  conversationMain,
}: {
  expanded: boolean;
  sidebarOpen: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  conversationMain: HTMLElement | null;
}): number | null {
  const [conversationWidth, setConversationWidth] = useState<number | null>(null);
  const sidebarWasOpen = useRef<boolean | null>(null);
  // The conversation's width as last seen before expanding: by the time the
  // expanded layout commits, the island has already given its room away.
  // With the sidebar open the conversation is the main box; folded away, the
  // main slides over the sidebar and the conversation is the whole island.
  const lastWidth = useRef({ main: 0, island: 0 });
  useEffect(() => {
    const island = conversationMain?.parentElement;
    if (!conversationMain || !island || expanded) return;
    const read = () => {
      lastWidth.current = { main: conversationMain.getBoundingClientRect().width, island: island.getBoundingClientRect().width };
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(conversationMain);
    observer.observe(island);
    return () => observer.disconnect();
  }, [conversationMain, expanded]);
  void onSidebarOpenChange;

  useLayoutEffect(() => {
    // Always the channel list ("sidebar"), whatever page is showing: leaving for the inbox, whose own list is
    // in that slot, must still give the channel list back (Figmama 11/21).
    const open = !isSidebarSlotHidden("sidebar");
    const setOpen = (next: boolean) => setSidebarSlotHidden("sidebar", !next);
    if (expanded) {
      if (sidebarWasOpen.current !== null) return;
      sidebarWasOpen.current = open;
      const { main, island } = lastWidth.current;
      // Open: the conversation keeps its width and the sidebar's room goes to
      // the workspace. Already folded: the workspace grows by a sidebar's width.
      setConversationWidth(Math.max(CONVERSATION_MIN, open ? main : island - SIDEBAR_DEFAULT));
      if (open) setOpen(false);
      return;
    }
    if (sidebarWasOpen.current === null) return;
    const reopen = sidebarWasOpen.current;
    sidebarWasOpen.current = null;
    setConversationWidth(null);
    if (reopen) setOpen(true);
  }, [expanded, conversationMain]);

  // Opening the sidebar by hand while expanded ends the expansion's hold on it:
  // restoring then leaves it open.
  useEffect(() => {
    if (expanded && sidebarOpen && sidebarWasOpen.current === false) sidebarWasOpen.current = true;
  }, [expanded, sidebarOpen]);

  return expanded ? conversationWidth : null;
}
