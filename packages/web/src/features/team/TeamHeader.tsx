import { useCallback } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { Tabs, TabsLabel, TabsList, TabsTab } from "@botiverse/raft-ui";
import PanelHeader, { FULL_PAGE_HEAD_PROPS } from "../../components/ui/PanelHeader";
import type { AppPanelHeaderProps } from "../../components/ui/PanelHeader";
import { useMachineStore } from "../../store/machineStore";
import { useServerStore } from "../../store/serverStore";
import { useMembersPopulation } from "../members/useMembersPopulation";
import { teamViewPath } from "./teamWorking";
import type { TeamView } from "./teamWorking";

/**
 * The Team page's head (PRD 团队页 §5, design T1): the Team icon and title,
 * "5 members (1 person, 4 agents) · 1 computer", and under it the page-level
 * tabs Overview | Members N | Computers N (raft-ui Tabs, default sticker).
 * The Members and Computers pages are the tabs' views, so each keeps its own
 * toolbar below this head.
 */
export function TeamHeader({ view, onMobileBack, mobileBackProps }: {
  view: TeamView;
} & Pick<AppPanelHeaderProps, "onMobileBack" | "mobileBackProps">) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const serverSlug = useServerStore((s) => s.current?.slug);
  const { population, loading } = useMembersPopulation();
  const computers = useMachineStore((s) => s.machines.length);
  const humans = population.humans.length;
  const agents = population.agents.length;
  const members = humans + agents;
  const pick = useCallback((next: TeamView) => {
    if (serverSlug && next !== view) navigate(teamViewPath(serverSlug, next));
  }, [navigate, serverSlug, view]);
  const count = (value: number | null) => (value === null ? null : (
    <span className="tabular-nums md:pointer-fine:text-[12px] md:pointer-fine:font-normal md:pointer-fine:text-foreground-muted" data-slot="team-tab-count">{value}</span>
  ));
  return (
    // The head's own 20px edge (the Members tab's), the same on every tab.
    <div className="flex shrink-0 flex-col [--column-margin:16px] md:[--column-margin:20px]" data-testid="team-header" data-full-page="">
      <PanelHeader
        containerProps={FULL_PAGE_HEAD_PROPS}
        title={formatMessage({ id: "team.page.title" })}
        icon={<Users size={18} />}
        // No "0 members" while they load: the counts come with the members.
        titleSuffix={loading ? undefined : (
          <span className="ml-2 hidden truncate text-caption text-foreground-muted md:inline" data-testid="team-counts">
            {formatMessage({ id: "team.page.counts" }, { members, humans, agents, computers })}
          </span>
        )}
        onMobileBack={onMobileBack}
        mobileBackProps={mobileBackProps}
      />
      {/* With a mouse on a desktop the row is the conversation tab bar's height (44px), so its seam runs on with the
          one under the member column's tabs beside it (anxndsgn 11/16). */}
      <div className="border-b border-line-seam px-(--column-margin) py-2 md:pointer-fine:py-0">
        <Tabs<TeamView> value={view} onValueChange={pick} className="min-w-0 md:pointer-fine:-mb-px" data-testid="team-tabs">
          <TabsList aria-label={formatMessage({ id: "team.page.title" })}>
            <TabsTab value="overview" data-testid="team-tab-overview">
              <TabsLabel>{formatMessage({ id: "team.page.overview" })}</TabsLabel>
            </TabsTab>
            <TabsTab value="members" data-testid="team-tab-members">
              <TabsLabel>{formatMessage({ id: "members.page.title" })}</TabsLabel>
              {count(loading ? null : members)}
            </TabsTab>
            <TabsTab value="computers" data-testid="team-tab-computers">
              <TabsLabel>{formatMessage({ id: "machine.mobile.title" })}</TabsLabel>
              {count(computers)}
            </TabsTab>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
