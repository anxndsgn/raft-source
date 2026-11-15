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

/** Doc §5: dragging the workspace wider stops where the timeline is down to 480. */
export const WORKSPACE_TIMELINE_MIN = 480;

/** The timeline beside the workspace (which stands outside the row, in the frame): the row's conversation column. */
export const workspaceMainColumn = (column: HTMLElement): HTMLElement | null =>
  column.closest<HTMLElement>('[data-testid="workspace-frame"]')?.querySelector<HTMLElement>(".thread-main-column") ?? null;

/** The drawer's one section. */
export const DRAWER_SECTIONS: "artifact"[] = ["artifact"];

/** The side panel's width beside the timeline now: a thread's, the panel's, or none. */
function sideWidth(open: ReadonlySet<string>, widths: { panel: number; thread: number }): number {
  return open.has("thread") ? threadPanelWidth(widths.thread) : SIDE_PANEL_SECTIONS.some((s) => open.has(s)) ? widths.panel : 0;
}

/**
 * Doc 4.4 / §5: the workspace is never one of the row's columns — it stands right of the conversation, from the top,
 * and takes its own width: its saved one, down to 420 so the timeline keeps 480 beside the side panel; with less room
 * than that it is a drawer over the timeline. Expanded, it fills the conversation area. The row (timeline and side
 * panel) is planned without it. `row`: the planned row, inside the frame the workspace shares.
 */
export function useWorkspaceDrawer(layout: ChannelSideLayout, open: Set<ChannelSideSection>, row: HTMLElement | null, desktop: boolean) {
  const panel = useColumnWidth("sidePanel");
  const thread = useColumnWidth("thread");
  const expanded = useArtifactViewerStore((s) => s.expanded) && desktop;
  const workspace = desktop && open.has("artifact");
  const frame = row?.closest<HTMLElement>('[data-testid="workspace-frame"]')?.getBoundingClientRect().width ?? 0;
  const room = frame - sideWidth(open, { panel, thread }) - WORKSPACE_TIMELINE_MIN;
  const drawer = workspace && !expanded && frame > 0 && room < 420;
  const rowOpen = useMemo(() => {
    if (!workspace) return open;
    const rest = new Set(open);
    rest.delete("artifact");
    return rest;
  }, [open, workspace]);
  const column = workspace ? visibleChannelSideColumns(layout, open).find((c) => c.sections.includes("artifact")) : undefined;
  const width = column ? (expanded ? column.width : Math.max(420, Math.min(column.width, room))) : 0;
  const collapsed = useArtifactViewerStore((st) => st.drawerCollapsed);
  const workspaceSlot = useContext(WorkspaceSlotContext);
  return { rowOpen, workspaceColumn: column, workspaceWidth: width, drawer, workspaceSlot, drawerCollapsed: drawer && collapsed };
}

/** The Artifact shown expanded: a phone's (`placed`) or the desktop workspace's, filling the conversation area (§5). */
export function useOrWorkspaceExpanded(placed: boolean): boolean {
  const workspace = useArtifactViewerStore((s) => s.expanded && s.open !== null);
  return placed || workspace;
}

/** The drawer covers the timeline only (not the channel's header or side panel): the row's conversation column. */
export function drawerHost(row: HTMLElement | null): HTMLElement | null {
  return row?.querySelector<HTMLElement>(":scope > .thread-main-column") ?? null;
}

/** The drawer's scrim pressed: the drawer pushes back to its handle; the Artifact and its tabs stay (Figmama 11/15). */
export function collapseWorkspace(): void {
  useArtifactViewerStore.getState().setDrawerCollapsed(true);
}
