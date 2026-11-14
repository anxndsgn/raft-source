import { useIntl } from "react-intl";
import { PanelToggleAction } from "@botiverse/raft-ui";
import { ListTodo } from "lucide-react";
import { useIsDesktopShell } from "../layout/ShellFrame";

import Tooltip from "../ui/Tooltip";

/**
 * The channel header's switch for the Tasks card. No count on it: most tasks
 * are the agents' own business, so the card is there when someone wants to
 * look, not something that asks for attention (@stdrc).
 */
export default function ChannelTasksToggle({ open, onToggle, count }: { open: boolean; onToggle: () => void; count?: number }) {
  const { formatMessage } = useIntl();
  const desktop = useIsDesktopShell();
  const label = formatMessage({ id: open ? "task.sidePanel.close" : "task.sidePanel.open" });
  return (
    <Tooltip content={label}>
      <PanelToggleAction pressed={open} onPressedChange={onToggle} aria-label={label} data-testid="channel-tasks-toggle">
        {/* Layout redesign: on a desktop the head's side-panel switches are words, the open tasks
            counted; on a phone (M2) an icon, the head being narrow. */}
        {desktop ? formatMessage({ id: "channelHead.tasks" }) : <ListTodo />}
        {desktop && count ? <span className="font-mono text-mono-meta">{count}</span> : null}
      </PanelToggleAction>
    </Tooltip>
  );
}
