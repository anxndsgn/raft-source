import { useIntl } from "react-intl";
import { ChevronLeft } from "lucide-react";

import { useArtifactViewerStore } from "../../apps/artifacts/artifactViewerStore";
import { collapseWorkspace, WORKSPACE_DRAWER_SCRIM_CLASS } from "./sideAreaLayoutRedesign";

/** Layout redesign (Figmama 11/15): the wash over the timeline beside the workspace drawer; pressing it pushes the drawer back. */
export function WorkspaceDrawerScrim() {
  const { formatMessage } = useIntl();
  return (
    <button
      type="button"
      aria-label={formatMessage({ id: "workspace.drawer.collapse" })}
      className={WORKSPACE_DRAWER_SCRIM_CLASS}
      onClick={collapseWorkspace}
      data-testid="workspace-drawer-scrim"
    />
  );
}

/** The pushed-back drawer: a handle at the timeline's right edge, "Workspace N"; pressing it slides the drawer out again. */
export function WorkspaceDrawerHandle() {
  const { formatMessage } = useIntl();
  const count = useArtifactViewerStore((s) => Math.max(1, s.tabs.length));
  return (
    <button
      type="button"
      className="absolute top-1/2 right-0 z-cover flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-container border border-r-0 border-line-seam bg-layer-canvas px-1.5 py-3 text-footnote font-semibold text-foreground shadow-sticker hover:bg-fill-medium"
      onClick={() => useArtifactViewerStore.getState().setDrawerCollapsed(false)}
      data-testid="workspace-drawer-handle"
    >
      <ChevronLeft size={14} aria-hidden />
      <span className="[writing-mode:vertical-rl]">{formatMessage({ id: "workspace.drawer.handle" }, { count })}</span>
    </button>
  );
}
