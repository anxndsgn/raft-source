import { createContext } from "react";
import { useUIStore } from "../../store/uiStore";

// The desktop sidebar's collapse control (leading the main area's head) and the column it
// controls (MainLayout's AppShellSidebarSlot) are in different components; the
// region's id ties them together for `aria-controls`, and the control's mark
// lets the keyboard toggle below find the one on screen.
export const SIDEBAR_REGION_ID = "app-sidebar";
/** Marks a head's collapse control (SidebarToggleHeadAction): the channel head's, and the expanded workspace's. */
export const SIDEBAR_TOGGLE_ATTR = "data-sidebar-toggle";

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

/**
 * The same column for the whole shell (ShellFrame): the control is always first
 * in the head of the leftmost island beside the sidebar, so with the workspace
 * expanded over the conversation it leads the workspace's tab row instead
 * (WorkspaceTabStrip; Figmama 11/18).
 */
export const ShellSidebarToggleContext = createContext<SidebarSlotColumn | null>(null);

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
 * a column about to collapse (to the head's toggle on screen). The sidebar's resize
 * handle uses it for a drag past the minimum and for Enter.
 */
export function setSidebarSlotHiddenKeepingFocus(column: SidebarSlotColumn, hidden: boolean, doc: Document = document): void {
  if (hidden) {
    const region = doc.getElementById(SIDEBAR_REGION_ID);
    if (region && region.contains(doc.activeElement)) {
      // The channel head's stays mounted, hidden, under an expanded workspace: focus the one shown.
      [...doc.querySelectorAll<HTMLElement>(`[${SIDEBAR_TOGGLE_ATTR}]`)].find((toggle) => toggle.getClientRects().length > 0)?.focus();
    }
  }
  setSidebarSlotHidden(column, hidden);
}
