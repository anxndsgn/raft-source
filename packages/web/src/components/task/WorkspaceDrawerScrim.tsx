import { useCallback } from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { RegionDrawer, RegionDrawerHandle } from "@botiverse/raft-ui-ext";

import { useArtifactViewerStore } from "../../apps/artifacts/artifactViewerStore";
import { collapseWorkspace } from "./sideAreaLayoutRedesign";

/**
 * Layout redesign (Figmama 11/15): the workspace as a drawer over the timeline — raft-ui-ext's RegionDrawer (a drawer
 * over one region): the veil over the strip of timeline beside it, or Escape in it, pushes it back to its handle.
 */
export function WorkspaceDrawer({ children }: { children: ReactNode }) {
  const { formatMessage } = useIntl();
  return (
    <RegionDrawer onCollapse={collapseWorkspace} collapseLabel={formatMessage({ id: "workspace.drawer.collapse" })} data-testid="workspace-drawer">
      {children}
    </RegionDrawer>
  );
}

/** The pushed-back drawer: a handle at the timeline's right edge, "Workspace N"; pressing it slides the drawer out again. */
export function WorkspaceDrawerHandle() {
  const { formatMessage } = useIntl();
  const count = useArtifactViewerStore((s) => Math.max(1, s.tabs.length));
  const expand = useCallback(() => useArtifactViewerStore.getState().setDrawerCollapsed(false), []);
  return <RegionDrawerHandle label={formatMessage({ id: "workspace.drawer.name" })} count={count} onExpand={expand} data-testid="workspace-drawer-handle" />;
}
