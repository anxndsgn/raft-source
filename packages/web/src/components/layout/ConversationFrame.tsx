import { useState } from "react";
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
  return (
    <div className="flex min-h-0 min-w-0 flex-1" data-testid="workspace-frame">
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
