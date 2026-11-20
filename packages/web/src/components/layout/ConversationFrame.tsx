import { useContext, useEffect, useRef, useState } from "react";
import { useArtifactViewerStore } from "../../apps/artifacts/artifactViewerStore";
import { useUIStore } from "../../store/uiStore";
import { SIDEBAR_REGION_ID } from "./sidebarToggle";
import type { ReactNode } from "react";

import { ConversationHeaderSlotContext, ShellWorkspaceIslandContext, WorkspaceSlotContext, workspaceFrameWidth } from "./rowColumnSlot";

/**
 * Layout redesign (F1–F3): the main area's frame. The conversation's header
 * sits above its row (so it spans the timeline and the channel's side panel),
 * and the workspace (an open Artifact) stands beside both, from the top:
 * in the shell's workspace island (ShellFrame, Raft redesign), or in a slot of
 * its own outside a shell. `children` is MainLayout's row.
 */
export function ConversationFrame({ children }: { children: ReactNode }) {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [ownWorkspaceSlot, setOwnWorkspaceSlot] = useState<HTMLElement | null>(null);
  const workspaceIsland = useContext(ShellWorkspaceIslandContext);
  const workspaceSlot = workspaceIsland === undefined ? ownWorkspaceSlot : workspaceIsland;
  useWorkspaceMakesRoom();
  // Doc §5: the workspace expanded takes the whole conversation area (its header, timeline and side panel hide,
  // as they were; index.css `data-workspace-expanded`). The rail and the sidebar stay.
  const expanded = useArtifactViewerStore((s) => s.expanded && s.open !== null);
  return (
    // In the shell's islands the conversation stays beside an expanded workspace (Raft redesign 11/21: the sidebar
    // folds instead, ShellFrame); only a frame with its own workspace slot hides the conversation.
    <div className="relative flex min-h-0 min-w-0 flex-1" data-testid="workspace-frame" data-workspace-expanded={expanded && workspaceIsland === undefined ? "true" : undefined}>
      <ConversationHeaderSlotContext.Provider value={headerSlot}>
        <WorkspaceSlotContext.Provider value={workspaceSlot}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="conversation-frame">
            <div ref={setHeaderSlot} className="shrink-0 empty:hidden" data-testid="conversation-header-slot" />
            {children}
          </div>
        </WorkspaceSlotContext.Provider>
      </ConversationHeaderSlotContext.Provider>
      {workspaceIsland === undefined ? <div ref={setOwnWorkspaceSlot} className="contents" data-testid="workspace-slot" /> : null}
    </div>
  );
}

/** Room the main area needs with the workspace open: the timeline's 480, the side panel's 400 at most, the workspace's 560. */
const WORKSPACE_ROW_NEED = 480 + 400 + 560;

/**
 * Layout redesign 4.4 (Figmama 11/15): with the workspace open in a window too narrow for timeline + side panel +
 * workspace, the sidebar folds away first (the rail stays; its button opens it again) — on opening and as the window
 * narrows. It comes back when the workspace closes, or the window widens enough again, only if it was this that
 * folded it (a sidebar the person folded stays folded).
 */
function useWorkspaceMakesRoom() {
  const workspaceOpen = useArtifactViewerStore((s) => s.open !== null);
  // Expanded, the workspace takes the conversation's place: the sidebar stays as it is (§5).
  const expanded = useArtifactViewerStore((s) => s.expanded);
  const foldedByUs = useRef<number | null>(null);
  useEffect(() => {
    const ui = useUIStore.getState;
    const frameWidth = () => {
      const frame = document.querySelector<HTMLElement>('[data-testid="workspace-frame"]');
      return frame ? workspaceFrameWidth(frame) : window.innerWidth;
    };
    if (!workspaceOpen) {
      if (foldedByUs.current !== null && ui().sidebarHidden) ui().setSidebarHidden(false);
      foldedByUs.current = null;
      return;
    }
    const fit = () => {
      if (expanded) return;
      const sidebarWidth = document.getElementById(SIDEBAR_REGION_ID)?.getBoundingClientRect().width ?? 0;
      if (!ui().sidebarHidden && sidebarWidth > 0 && frameWidth() < WORKSPACE_ROW_NEED) {
        foldedByUs.current = sidebarWidth;
        ui().setSidebarHidden(true);
      } else if (foldedByUs.current !== null && ui().sidebarHidden && frameWidth() - foldedByUs.current >= WORKSPACE_ROW_NEED) {
        foldedByUs.current = null;
        ui().setSidebarHidden(false);
      } else if (!ui().sidebarHidden) foldedByUs.current = null;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [expanded, workspaceOpen]);
}

