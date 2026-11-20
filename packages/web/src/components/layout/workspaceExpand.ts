import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isSidebarSlotHidden, setSidebarSlotHidden, useSidebarSlotHidden } from "./sidebarToggle";

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
 * channel list away and gives the workspace its width; the conversation keeps
 * the width it had. Restoring puts back exactly what was there before: a list
 * that was open opens again, one already folded stays folded (and then the
 * workspace takes the room a list would have had).
 *
 * It always acts on the channel list (the "sidebar" slot), whatever page is
 * showing. `shown` is "expanded, and this page shows the workspace";
 * `expanded` is the viewer's own expanded flag. Leaving for a page without the
 * workspace gives the list back; coming back folds it again at the width first
 * held, until the viewer stops being expanded.
 *
 * Returns the conversation's width to hold while shown expanded (px), or null.
 */
export function useWorkspaceExpandLayout({
  shown,
  expanded,
  conversationMain,
}: {
  shown: boolean;
  expanded: boolean;
  conversationMain: HTMLElement | null;
}): number | null {
  const [heldWidth, setHeldWidth] = useState<number | null>(null);
  const listWasOpen = useRef<boolean | null>(null);
  const listHidden = useSidebarSlotHidden("sidebar");

  // The conversation's width as last seen before expanding: by the time the
  // expanded layout commits, the island has already given its room away. With
  // the list open the conversation is the main box; folded away, the main
  // slides over the list and the conversation is the whole island.
  const lastWidth = useRef({ main: 0, island: 0 });
  useEffect(() => {
    const island = conversationMain?.parentElement;
    if (!conversationMain || !island || shown) return;
    const read = () => {
      lastWidth.current = { main: conversationMain.getBoundingClientRect().width, island: island.getBoundingClientRect().width };
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(conversationMain);
    observer.observe(island);
    return () => observer.disconnect();
  }, [conversationMain, shown]);

  // The width held for one expansion: measured when it starts, kept across page switches, let go when it ends.
  useEffect(() => {
    if (!expanded) setHeldWidth(null);
  }, [expanded]);

  useLayoutEffect(() => {
    if (shown) {
      if (listWasOpen.current !== null) return;
      const open = !isSidebarSlotHidden("sidebar");
      listWasOpen.current = open;
      setHeldWidth((held) => {
        if (held !== null) return held;
        const { main, island } = lastWidth.current;
        return Math.max(CONVERSATION_MIN, open ? main : island - SIDEBAR_DEFAULT);
      });
      if (open) setSidebarSlotHidden("sidebar", true);
      return;
    }
    if (listWasOpen.current === null) return;
    const reopen = listWasOpen.current;
    listWasOpen.current = null;
    if (reopen) setSidebarSlotHidden("sidebar", false);
  }, [shown]);

  // Opening the list by hand while expanded ends the expansion's hold on it:
  // restoring then leaves it open.
  useEffect(() => {
    if (shown && !listHidden && listWasOpen.current === false) listWasOpen.current = true;
  }, [shown, listHidden]);

  return shown ? heldWidth : null;
}
