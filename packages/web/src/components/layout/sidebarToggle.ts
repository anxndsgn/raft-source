import { createContext } from "react";
import { useUIStore } from "../../store/uiStore";

// The desktop sidebar's collapse control (leading the main area's head) and the column it
// controls (MainLayout's AppShellSidebarSlot) are in different components; the
// ids tie them together for `aria-controls` and for the keyboard toggle below.
export const SIDEBAR_REGION_ID = "app-sidebar";
export const SIDEBAR_TOGGLE_ID = "app-sidebar-toggle";

/**
 * Which column sits in the sidebar slot and collapses: the chat sidebar, or the
 * Activity list beside an opened conversation. Each keeps its own remembered
 * state, so collapsing one never collapses the other.
 */
export type SidebarSlotColumn = "sidebar" | "activityList";

/**
 * Raft redesign (Figma 精修 · 组件化): the sidebar's collapse control leads the
 * main area's head, not the rail. MainLayout gives the column around its routes
 * on a desktop with a collapsible sidebar; the main area's AppPanelHeader reads
 * it and puts SidebarToggleHeadAction first. Null everywhere else (a side
 * column's head, a page portalled beside the conversation).
 */
export const MainHeadSidebarToggleContext = createContext<SidebarSlotColumn | null>(null);

export function isSidebarSlotHidden(column: SidebarSlotColumn): boolean {
  const state = useUIStore.getState();
  return column === "activityList" ? state.activityListHidden : state.sidebarHidden;
}

export function setSidebarSlotHidden(column: SidebarSlotColumn, hidden: boolean): void {
  const state = useUIStore.getState();
  if (column === "activityList") state.setActivityListHidden(hidden);
  else state.setSidebarHidden(hidden);
}

/** The remembered collapsed state of `column`, subscribed. */
export function useSidebarSlotHidden(column: SidebarSlotColumn): boolean {
  return useUIStore((s) => (column === "activityList" ? s.activityListHidden : s.sidebarHidden));
}

/**
 * ⌘\ / Ctrl+\: collapse or expand the column in the sidebar slot. Collapsing
 * makes the column inert, so focus inside it would drop to <body>; move it to
 * the head's toggle first — the control that brings the column back.
 */
export function toggleSidebarFromKeyboard(doc: Document = document, column: SidebarSlotColumn = "sidebar"): void {
  setSidebarSlotHiddenKeepingFocus(column, !isSidebarSlotHidden(column), doc);
}

/**
 * Collapse or expand the column in the sidebar slot, first moving focus out of
 * a column about to collapse (to the rail's toggle). The sidebar's resize
 * handle uses it for a drag past the minimum and for Enter.
 */
export function setSidebarSlotHiddenKeepingFocus(column: SidebarSlotColumn, hidden: boolean, doc: Document = document): void {
  if (hidden) {
    const region = doc.getElementById(SIDEBAR_REGION_ID);
    if (region && region.contains(doc.activeElement)) {
      doc.getElementById(SIDEBAR_TOGGLE_ID)?.focus();
    }
  }
  setSidebarSlotHidden(column, hidden);
}
