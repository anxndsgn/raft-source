import { useContext, useMemo } from "react";
import { WorkspaceSlotContext } from "../layout/rowColumnSlot";
import { commitColumnWidth, getColumnWidth, previewColumnWidth, resetColumnWidth, useColumnWidth } from "../../store/columnWidthStore";
import { COLUMN_BOUNDS } from "../../lib/panelBounds";
import type { ColumnWidthSource } from "../ui/ColumnResizeHandle";
import { useArtifactViewerStore } from "../../apps/artifacts/artifactViewerStore";
import { visibleChannelSideColumns } from "@botiverse/raft-shared";
import type { ChannelSideLayout, ChannelSideSection } from "@botiverse/raft-shared";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Layout redesign (anxndsgn/Figmama 11/15): the channel's side panel is one place — a thread takes it, Tasks, Files
 * and the details step aside until it closes. `open`: the side area's open sections, changed in place.
 */
export function threadTakesSidePanel(open: Set<string>): void {
  open.add("thread");
  open.delete("tasks");
  open.delete("files");
  open.delete("details");
}

/** Layout redesign (F3): an Artifact's own column is the workspace, beside the channel's header (the workspace slot). */
export function inWorkspace(slot: HTMLElement | null | undefined, sections: readonly string[], node: ReactNode): ReactNode {
  return slot && sections.length === 1 && sections[0] === "artifact" ? createPortal(node, slot, sections.join("+")) : node;
}

/** The channel's info holds the side panel's place too: open, Tasks and Files step aside. */
export function detailsTakeSidePanel(open: Set<string>): void {
  if (!open.has("details")) return;
  open.delete("tasks");
  open.delete("files");
}

const SIDE_PANEL_SECTIONS = ["tasks", "files", "details", "profile", "context"];

/**
 * Layout redesign (Figmama 11/15): where the timeline would go under 480 beside the side panel (its width, a thread its own) and
 * the workspace at its 420, the workspace leaves the row and slides over the timeline from the right instead.
 * `rowWidth`: the main area's (the sidebar folded first, ConversationFrame).
 */
export function workspaceAsDrawer(open: ReadonlySet<string>, rowWidth: number, desktop: boolean, widths = { panel: 360, thread: 400 }): boolean {
  if (!desktop || !open.has("artifact") || rowWidth <= 0) return false;
  const side = open.has("thread") ? threadPanelWidth(widths.thread) : SIDE_PANEL_SECTIONS.some((s) => open.has(s)) ? widths.panel : 0;
  return rowWidth < 480 + 420 + side;
}

/** The open sections the row plans: without the workspace while it is a drawer. */
export function rowSections<T extends string>(open: Set<T>, drawer: boolean): Set<T> {
  if (!drawer) return open;
  const row = new Set(open);
  row.delete("artifact" as T);
  return row;
}

/** The drawer's box: over the timeline at the right edge, the workspace's default width, a shadow. */
// Over the floating pills of the timeline (the unread jump): z-cover. The DS floating layer's offset shadow says "on top".
export const WORKSPACE_DRAWER_CLASS = "absolute inset-y-0 right-0 z-cover flex w-[min(560px,92%)] border-l border-line-seam bg-layer-canvas shadow-sticker";

/** Over the strip of timeline left beside the drawer: a light wash that says "behind"; pressing it closes the drawer. */
export const WORKSPACE_DRAWER_SCRIM_CLASS = "absolute inset-0 z-cover overlay-medium";

/** A thread (or an old discussion) beside the channel: its own remembered width, 400 by default, within 320–480 (4.4). */
export function threadPanelWidth(saved: number): number {
  return Math.min(480, Math.max(320, saved));
}

/** The side panel's columns (Tasks, Files, Members, the info): neither the workspace nor the thread's. */
export function isSidePanelColumn(sections: readonly string[]): boolean {
  return !sections.includes("artifact") && !sections.includes("thread");
}

/** Layout redesign 4.4: dragging the side panel sets the one width its four (Tasks, Files, Members, the info) share. */
export function sidePanelWidthSource(width: number | undefined, contentMin: number | undefined): ColumnWidthSource {
  return {
    width: width ?? COLUMN_BOUNDS.sidePanel.defaultWidth,
    min: COLUMN_BOUNDS.sidePanel.min,
    contentMin,
    get: () => getColumnWidth("sidePanel"),
    preview: (w) => previewColumnWidth("sidePanel", w),
    commit: (w) => commitColumnWidth("sidePanel", w),
    reset: () => resetColumnWidth("sidePanel"),
  };
}

/**
 * Layout redesign 4.4: a plan column's widths — the side panel at its one shared width (`panel`, 320–480), a thread
 * at its own; both keep it when the row has room to spare and are never pressed narrower (`fixed`); the workspace
 * keeps its saved width and flexes.
 */
export function sidePanelWidths(sections: readonly string[], saved: number, thread: number, panel: number) {
  const workspace = sections.includes("artifact");
  const own = workspace ? saved : panel;
  return { saved: sections.includes("thread") ? threadPanelWidth(thread) : own, savedWithoutThread: own, fixed: !workspace };
}

/** The drawer's one section. */
export const DRAWER_SECTIONS: "artifact"[] = ["artifact"];

/** The workspace as a drawer or a column: the sections the row plans, and the drawer's column when it is one. */
export function useWorkspaceDrawer(layout: ChannelSideLayout, open: Set<ChannelSideSection>, rowWidth: number, desktop: boolean) {
  const panel = useColumnWidth("sidePanel");
  const thread = useColumnWidth("thread");
  const drawer = workspaceAsDrawer(open, rowWidth, desktop, { panel, thread });
  const rowOpen = useMemo(() => rowSections(open, drawer), [drawer, open]);
  const collapsed = useArtifactViewerStore((st) => st.drawerCollapsed);
  const drawerColumn = drawer ? visibleChannelSideColumns(layout, open).find((c) => c.sections.includes("artifact")) : undefined;
  const workspaceSlot = useContext(WorkspaceSlotContext);
  return { rowOpen, drawerColumn, workspaceSlot, drawerCollapsed: drawer && collapsed };
}

/** The drawer covers the timeline only (not the channel's header or side panel): the row's conversation column. */
export function drawerHost(row: HTMLElement | null): HTMLElement | null {
  return row?.querySelector<HTMLElement>(":scope > .thread-main-column") ?? null;
}

/** The drawer's scrim pressed: the drawer pushes back to its handle; the Artifact and its tabs stay (Figmama 11/15). */
export function collapseWorkspace(): void {
  useArtifactViewerStore.getState().setDrawerCollapsed(true);
}
