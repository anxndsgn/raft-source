import { useIntl } from "react-intl";
import { AppShellSidebarTrigger } from "@botiverse/raft-ui";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Tooltip from "../ui/Tooltip";
import { labelWithShortcut } from "../ui/LabelWithShortcut";
import { useShortcutBinding } from "../../features/shortcuts/useShortcutBinding";
import { SIDEBAR_TOGGLE_ATTR, useSidebarSlotHidden } from "./sidebarToggle";
import type { SidebarSlotColumn } from "./sidebarToggle";

/**
 * The sidebar's collapse control, first in the main area's head (Raft redesign,
 * Figma 精修 · 组件化: panel-left-close / panel-left-open). raft-ui's
 * AppShellSidebarTrigger owns the toggle (aria-expanded, aria-controls naming
 * the sidebar slot, the shell's open state) and renders a PanelAction; its
 * built-in English label and native `title` give way to the catalog's words
 * and a tooltip that also shows the shortcut.
 */
export function SidebarToggleHeadAction({ column, className }: { column: SidebarSlotColumn; className?: string }) {
  const { formatMessage } = useIntl();
  const sidebarHidden = useSidebarSlotHidden(column);
  const label = formatMessage({ id: sidebarHidden ? "layout.leftRail.expandSidebar" : "layout.leftRail.collapseSidebar" });
  // The person's keys (the shortcuts panel); none set, the tooltip is the label alone.
  const shortcut = useShortcutBinding("sidebar");
  return (
    <Tooltip content={shortcut.combos[0] ? labelWithShortcut(label, shortcut.combos[0], formatMessage) : label}>
      <AppShellSidebarTrigger
        {...{ [SIDEBAR_TOGGLE_ATTR]: "" }}
        className={className}
        aria-label={label}
        aria-keyshortcuts={shortcut.ariaKeyShortcuts || undefined}
        title={undefined}
        data-testid="sidebar-toggle"
        data-sidebar-column={column}
      >
        {sidebarHidden
          ? <PanelLeftOpen size={20} aria-hidden="true" />
          : <PanelLeftClose size={20} aria-hidden="true" />}
      </AppShellSidebarTrigger>
    </Tooltip>
  );
}
