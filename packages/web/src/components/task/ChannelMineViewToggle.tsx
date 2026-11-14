import { useIntl } from "react-intl";
import { PanelToggleAction } from "@botiverse/raft-ui";

import Tooltip from "../ui/Tooltip";

/** Reply mode, step 2: the channel header's switch for the "What concerns me" view of the timeline. */
export function ChannelMineViewToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { formatMessage } = useIntl();
  const label = formatMessage({ id: "timelineView.mineToggle" });
  return (
    <Tooltip content={label}>
      <PanelToggleAction pressed={open} onPressedChange={onToggle} aria-label={label} data-testid="channel-mine-view-toggle">
        {label}
      </PanelToggleAction>
    </Tooltip>
  );
}
