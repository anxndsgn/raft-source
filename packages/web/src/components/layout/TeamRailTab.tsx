import { useCallback, useState } from "react";
import type { MouseEvent } from "react";
import { useIntl } from "react-intl";
import { Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@botiverse/raft-ui";
import type { PopoverProps } from "@botiverse/raft-ui";
import { useWorkingAgentCount } from "../../features/team/teamWorking";
import { TeamWorkingPreview } from "../../features/team/TeamWorkingPreview";
import { useUsageLimitAttention } from "./useUsageLimitAttention";
import { RailTabButton } from "./RailTabButton";
import type { RailTabDrag } from "./SortableRailTabs";

/**
 * The rail's Team tab (PRD 团队页 §4): Members and Computers in one. While
 * agents work, a turning ring round it and their number; hovering it shows
 * who is held and who is working (T2), in place of the old "Working now"
 * popover; a click opens the Team page. Computers' attention dot rides on it.
 */
export function TeamRailTab({ dragProps, onClick, active, attentionDot, attentionTooltip }: {
  dragProps: RailTabDrag["dragProps"];
  onClick: (event: MouseEvent) => void;
  active: boolean;
  attentionDot: boolean;
  attentionTooltip?: string;
}) {
  const { formatMessage } = useIntl();
  const working = useWorkingAgentCount();
  // Held agents are the inbox's usage-limit notices: the preview opens for them too.
  const held = new Set(useUsageLimitAttention().notifications.flatMap((notice) => notice.affectedAgentIds)).size;
  const [open, setOpen] = useState(false);
  const label = working > 0
    ? formatMessage({ id: "team.rail.working" }, { count: working })
    : formatMessage({ id: "team.page.title" });
  // Hover opens it; a press is the tab's (the Team page), never the preview's toggle.
  const onOpenChange = useCallback<NonNullable<PopoverProps["onOpenChange"]>>((next, details) => {
    if (next && details.reason === "trigger-press") return;
    setOpen(next);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const click = useCallback((event: MouseEvent) => {
    setOpen(false);
    onClick(event);
  }, [onClick]);
  const button = (
    <RailTabButton
      {...dragProps}
      icon={<Users size={18} />}
      label={label}
      active={active}
      onClick={click}
      working={working}
      showDot={attentionDot}
      dotInactiveOnly
      dotTooltip={attentionTooltip}
      showTooltip={working + held === 0}
      testId="left-rail-tab-team"
    />
  );
  if (working + held === 0) return button;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger openOnHover delay={250} closeDelay={150} render={button} />
      {open ? (
        <PopoverContent side="right" align="start" sideOffset={8} className="w-[360px] p-0" data-testid="team-working-preview">
          <TeamWorkingPreview onNavigate={close} />
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
