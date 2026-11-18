import { createContext } from "react";

/**
 * Where a page in the conversation's column (MainLayout's `.thread-main-column`) puts a column of its own beside it in
 * MainLayout's row, so that column stands in the row the #189 rules plan (rowLayout) and the page is the row's
 * conversation: the Tasks page's task beside its list (TasksRoute), as the thread beside its channel. A `contents`
 * element right after the conversation's column, so what is portaled into it is the row's flex item.
 *
 * Undefined outside MainLayout (no row: the page lays the column out itself); null until the slot has mounted.
 */
export const RowColumnSlotContext = createContext<HTMLElement | null | undefined>(undefined);

/**
 * Layout redesign: where the conversation's header goes on a desktop, above
 * MainLayout's row, so the header spans the conversation and its side panel
 * (the side panel belongs to the channel and starts under its header).
 * Undefined outside MainLayout; null until mounted.
 */
export const ConversationHeaderSlotContext = createContext<HTMLElement | null | undefined>(undefined);

/**
 * Layout redesign (F3): where the workspace (an open Artifact's column) goes
 * on a desktop — beside the conversation's header and row, from the window's
 * top, not under the channel's header. Undefined outside MainLayout.
 */
export const WorkspaceSlotContext = createContext<HTMLElement | null | undefined>(undefined);

/**
 * Raft redesign: the workspace island ShellFrame draws beside the conversation's
 * island, for ConversationFrame to hand on as the WorkspaceSlotContext.
 * Undefined outside ShellFrame; null until mounted.
 */
export const ShellWorkspaceIslandContext = createContext<HTMLElement | null | undefined>(undefined);

/**
 * The conversation's frame (ConversationFrame's `workspace-frame`) an element
 * belongs to: its own, or, for the workspace's column in the shell's
 * workspace island, the one in the island beside it.
 */
export function workspaceFrameOf(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>('[data-testid="workspace-frame"]')
    ?? element.closest('[data-slot="app-shell-island-row"]')?.querySelector<HTMLElement>('[data-testid="workspace-frame"]')
    ?? null;
}

/**
 * The room the conversation and the workspace share: the frame's own width,
 * plus the workspace island's beside it when the shell draws one (ShellFrame).
 */
export function workspaceFrameWidth(frame: HTMLElement): number {
  const island = frame.closest('[data-slot="app-shell-island-row"]')?.querySelector<HTMLElement>(':scope > [data-testid="workspace-island"]');
  return frame.getBoundingClientRect().width + (island?.getBoundingClientRect().width ?? 0);
}
