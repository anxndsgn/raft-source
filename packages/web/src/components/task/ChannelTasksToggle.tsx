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
        <ListTodo />
        {/* Raft redesign (Figma Channel Header): the open tasks counted in a small ink square on the
            icon's top right corner, on a desktop. */}
        {desktop && count ? (
          <span
            className="pointer-events-none absolute top-0.5 right-px h-3.5 min-w-3.5 bg-foreground px-[3px] text-center font-sans text-[9px]/[14px] font-semibold text-layer-canvas tabular-nums"
            data-testid="channel-tasks-count"
          >
            {count}
          </span>
        ) : null}
      </PanelToggleAction>
    </Tooltip>
  );
}
