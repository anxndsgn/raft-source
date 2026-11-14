import { useIntl } from "react-intl";

import { closeWorkspace, WORKSPACE_DRAWER_SCRIM_CLASS } from "./sideAreaLayoutRedesign";

/** Layout redesign (Figmama 11/15): the wash over the timeline beside the workspace drawer; pressing it closes the drawer. */
export function WorkspaceDrawerScrim() {
  const { formatMessage } = useIntl();
  return (
    <button
      type="button"
      aria-label={formatMessage({ id: "artifacts.viewer.close" })}
      className={WORKSPACE_DRAWER_SCRIM_CLASS}
      onClick={closeWorkspace}
      data-testid="workspace-drawer-scrim"
    />
  );
}

