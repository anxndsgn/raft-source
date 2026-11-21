import { useContext, useEffect, useMemo } from "react";
import { WorkspaceSlotContext, workspaceFrameOf, workspaceFrameWidth } from "../layout/rowColumnSlot";
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
  workspaceFrameOf(column)?.querySelector<HTMLElement>(".thread-main-column") ?? null;

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
  const frameElement = row ? workspaceFrameOf(row) : null;
  const frame = frameElement ? workspaceFrameWidth(frameElement) : 0;
  const room = frame - sideWidth(open, { panel, thread }) - WORKSPACE_TIMELINE_MIN;
  // A side panel wide enough to leave the workspace no room gives way to it first, down to its 320 (owner fc02cf9e:
  // a wide Files panel turned the workspace into the drawer over the timeline); only past that is it the drawer.
  const panelOpen = !open.has("thread") && SIDE_PANEL_SECTIONS.some((section) => open.has(section as ChannelSideSection));
  const panelFits = Math.max(COLUMN_BOUNDS.sidePanel.min, Math.floor(frame - WORKSPACE_TIMELINE_MIN - 420));
  const panelGivesWay = workspace && !expanded && frame > 0 && panelOpen && room < 420 && panel > panelFits;
  useEffect(() => {
    if (panelGivesWay) commitColumnWidth("sidePanel", panelFits);
  }, [panelGivesWay, panelFits]);
  const drawer = workspace && !expanded && frame > 0 && room < 420 && !panelGivesWay;
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

/** The conversation's own minimum beside a workspace being dragged wider: the timeline's beside the workspace. */
const WORKSPACE_GIVE_WAY_TIMELINE_MIN = WORKSPACE_TIMELINE_MIN;

interface GiveWaySnapshot {
  workspace: number;
  timeline: number;
  panel: number | null;
}

/** The columns left of the workspace island as they are when its drag starts. */
function giveWaySnapshot(column: HTMLElement | null, workspace: number): GiveWaySnapshot {
  const frame = column ? workspaceFrameOf(column) : null;
  const timeline = frame?.querySelector<HTMLElement>(".thread-main-column")?.getBoundingClientRect().width ?? 0;
  const conversation = document.querySelector<HTMLElement>("[data-testid=conversation-island]");
  const panelElement = conversation?.querySelector<HTMLElement>('[data-testid="channel-side-column"][data-in-row="true"]');
  return {
    workspace,
    timeline,
    panel: panelElement ? panelElement.getBoundingClientRect().width : null,
  };
}

/**
 * Dragging the workspace island wider, the columns left of it give way (owner 992f0fdf, Figmama 13ec3927): the
 * conversation down to its minimum beside the workspace (480), then the channel's side panel down to its 320; the drag
 * stops only once both are at their minimums, and on release each keeps the width it gave way to. (The sidebar is not
 * one of them: the conversation's island keeps the room of the row beside it, so a narrower sidebar gives the
 * workspace nothing.)
 */
export function workspaceGiveWay(source: ColumnWidthSource): { source: ColumnWidthSource; dragMax: (column: HTMLElement | null) => number } {
  let start: GiveWaySnapshot | null = null;
  let element: HTMLElement | null = null;
  // The width last shown: a release measures the room again once the others have given way, which would undo them.
  let shown: number | null = null;
  const room = (snapshot: GiveWaySnapshot) =>
    Math.max(0, snapshot.timeline - WORKSPACE_GIVE_WAY_TIMELINE_MIN)
    + (snapshot.panel === null ? 0 : Math.max(0, snapshot.panel - COLUMN_BOUNDS.sidePanel.min));
  const layOut = (width: number, commit: boolean) => {
    // The widths as rendered when the drag starts (the remembered one can be wider than the room let it show).
    if (!start) start = giveWaySnapshot(element, element?.getBoundingClientRect().width || source.get());
    let need = Math.max(0, width - start.workspace);
    need -= Math.min(need, Math.max(0, start.timeline - WORKSPACE_GIVE_WAY_TIMELINE_MIN));
    if (start.panel !== null) {
      const give = Math.min(need, Math.max(0, start.panel - COLUMN_BOUNDS.sidePanel.min));
      need -= give;
      (commit ? commitColumnWidth : previewColumnWidth)("sidePanel", Math.round(start.panel - give));
    }
  };
  return {
    source: {
      ...source,
      preview: (width) => {
        shown = width;
        layOut(width, false);
        source.preview(width);
      },
      commit: (width) => {
        const final = shown ?? width ?? source.get();
        layOut(final, true);
        source.commit(final);
        start = null;
        shown = null;
      },
    },
    dragMax: (column) => {
      element = column;
      const snapshot = giveWaySnapshot(column, column?.getBoundingClientRect().width ?? source.get());
      return Math.max(source.min, Math.round(snapshot.workspace + room(snapshot)));
    },
  };
}
