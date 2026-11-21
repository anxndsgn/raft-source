import { useCallback, useState } from "react";
import type { MouseEvent } from "react";
import { useIntl } from "react-intl";
import { UserBot } from "../../icons/lucideShim";
import { Popover, PopoverContent, PopoverTrigger } from "@botiverse/raft-ui";
import type { PopoverProps } from "@botiverse/raft-ui";
import { useWorkingAgentCount } from "../../features/team/teamWorking";
import { TeamWorkingPreview } from "../../features/team/TeamWorkingPreview";
import { RailTabButton } from "./RailTabButton";
import type { RailTabDrag } from "./SortableRailTabs";

/**
 * The rail's Team tab (PRD 团队页 §4): Members and Computers in one. The tab
 * itself shows no working state (anxndsgn 11/15, card d7ce7df0): only
 * Computers' attention dot. While anyone is held or working, hovering it shows
 * who (T2), in place of the old "Working now" popover; a click opens the Team page.
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
      icon={<UserBot size={18} />}
      label={label}
      active={active}
      onClick={click}
      showDot={attentionDot}
      dotInactiveOnly
      dotTooltip={attentionTooltip}
      // Hovering always shows the preview (Anna 11/16), nobody working included: it is the tooltip.
      showTooltip={false}
      testId="left-rail-tab-team"
    />
  );
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
