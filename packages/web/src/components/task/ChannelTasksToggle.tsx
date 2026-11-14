import { useIntl } from "react-intl";
import { PanelToggleAction } from "@botiverse/raft-ui";

import Tooltip from "../ui/Tooltip";

/**
 * The channel header's switch for the Tasks card. No count on it: most tasks
 * are the agents' own business, so the card is there when someone wants to
 * look, not something that asks for attention (@stdrc).
 */
export default function ChannelTasksToggle({ open, onToggle, count }: { open: boolean; onToggle: () => void; count?: number }) {
  const { formatMessage } = useIntl();
  const label = formatMessage({ id: open ? "task.sidePanel.close" : "task.sidePanel.open" });
  return (
    <Tooltip content={label}>
      <PanelToggleAction pressed={open} onPressedChange={onToggle} aria-label={label} data-testid="channel-tasks-toggle">
        {/* Layout redesign: the head's side-panel switches are words, the open tasks counted. */}
        {formatMessage({ id: "channelHead.tasks" })}
        {count ? <span className="font-mono text-mono-meta">{count}</span> : null}
      </PanelToggleAction>
    </Tooltip>
  );
}
