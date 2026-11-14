import { useEffect, useRef, useState } from "react";
import { useArtifactViewerStore } from "../../apps/artifacts/artifactViewerStore";
import { useUIStore } from "../../store/uiStore";
import { SIDEBAR_REGION_ID } from "./sidebarToggle";
import type { ReactNode } from "react";

import { ConversationHeaderSlotContext, WorkspaceSlotContext } from "./rowColumnSlot";

/**
 * Layout redesign (F1–F3): the main area's frame. The conversation's header
 * sits above its row (so it spans the timeline and the channel's side panel),
 * and the workspace (an open Artifact) stands beside both, from the top.
 * `children` is MainLayout's row.
 */
export function ConversationFrame({ children }: { children: ReactNode }) {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [workspaceSlot, setWorkspaceSlot] = useState<HTMLElement | null>(null);
  useWorkspaceMakesRoom();
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1" data-testid="workspace-frame">
      <ConversationHeaderSlotContext.Provider value={headerSlot}>
        <WorkspaceSlotContext.Provider value={workspaceSlot}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="conversation-frame">
            <div ref={setHeaderSlot} className="shrink-0 empty:hidden" data-testid="conversation-header-slot" />
            {children}
          </div>
        </WorkspaceSlotContext.Provider>
      </ConversationHeaderSlotContext.Provider>
      <div ref={setWorkspaceSlot} className="contents" data-testid="workspace-slot" />
    </div>
  );
}

/** Room the main area needs with the workspace open: the timeline's 480, the side panel's 400 at most, the workspace's 560. */
const WORKSPACE_ROW_NEED = 480 + 400 + 560;

/**
 * Layout redesign (Figmama 11/15): the workspace opening in a window too narrow for timeline + side panel + workspace
 * folds the sidebar away first (the rail stays; its button opens it again), and gives it back when the workspace
 * closes — only if it was this that folded it. Narrower still, the row's plan shrinks the workspace to its 420.
 */
function useWorkspaceMakesRoom() {
  const workspaceOpen = useArtifactViewerStore((s) => s.open !== null);
  const foldedByUs = useRef(false);
  useEffect(() => {
    const ui = useUIStore.getState();
    if (workspaceOpen) {
      const sidebar = document.getElementById(SIDEBAR_REGION_ID);
      const sidebarWidth = sidebar?.getBoundingClientRect().width ?? 0;
      const main = document.querySelector<HTMLElement>('[data-testid="workspace-frame"]')?.getBoundingClientRect().width ?? window.innerWidth;
      if (!ui.sidebarHidden && sidebarWidth > 0 && main < WORKSPACE_ROW_NEED) {
        ui.setSidebarHidden(true);
        foldedByUs.current = true;
      }
    } else if (foldedByUs.current) {
      foldedByUs.current = false;
      if (useUIStore.getState().sidebarHidden) ui.setSidebarHidden(false);
    }
  }, [workspaceOpen]);
}
