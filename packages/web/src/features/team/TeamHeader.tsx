import { useCallback } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { Tabs, TabsLabel, TabsList, TabsTab } from "@botiverse/raft-ui";
import PanelHeader, { FULL_PAGE_HEAD_PROPS } from "../../components/ui/PanelHeader";
import type { AppPanelHeaderProps } from "../../components/ui/PanelHeader";
import { PageHead, PageNav, useDesktopMouse } from "../../components/ui/PageHead";
import type { ReactNode } from "react";
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
/** The Team page's views as a vertical nav beside the page (Figmama 11/21, a page at least 1000 wide). */
export function TeamPageNav({ view }: { view: TeamView }) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const serverSlug = useServerStore((s) => s.current?.slug);
  const { population, loading } = useMembersPopulation();
  const computers = useMachineStore((s) => s.machines.length);
  const members = population.humans.length + population.agents.length;
  const pick = useCallback((next: TeamView) => {
    if (serverSlug && next !== view) navigate(teamViewPath(serverSlug, next));
  }, [navigate, serverSlug, view]);
  return (
    <PageNav<TeamView>
      label={formatMessage({ id: "team.page.title" })}
      value={view}
      onValueChange={pick}
      testId="team-tabs"
      items={[
        { value: "overview", label: formatMessage({ id: "team.page.overview" }), testId: "team-tab-overview" },
        { value: "members", label: formatMessage({ id: "members.page.title" }), count: loading ? null : members, testId: "team-tab-members" },
        { value: "computers", label: formatMessage({ id: "machine.mobile.title" }), count: computers, testId: "team-tab-computers" },
      ]}
    />
  );
}

export function TeamHeader({ view, action, withNav = false, onMobileBack, mobileBackProps }: {
  view: TeamView;
  /** The views are the vertical nav beside the page (TeamPageNav): the head has no tabs and spans nav and column. */
  withNav?: boolean;
  /** The tab's primary action (Members: Recruit agent), at the head's right with a mouse on a desktop (11/21). */
  action?: ReactNode;
} & Pick<AppPanelHeaderProps, "onMobileBack" | "mobileBackProps">) {
  const desktopMouse = useDesktopMouse();
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
    <span className="tabular-nums text-[12px] font-normal text-foreground-muted" data-slot="team-tab-count">{value}</span>
  ));
  const tabs = (
    <Tabs<TeamView> value={view} onValueChange={pick} className="min-w-0 -mb-px" data-testid="team-tabs">
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
  );
  // Layout changes C (Figmama 11/21): with a mouse on a desktop the page head of the reading column.
  if (desktopMouse) {
    return (
      <div className="flex shrink-0 flex-col [--column-margin:20px]" data-testid="team-header" data-full-page="">
        <PageHead
          title={formatMessage({ id: "team.page.title" })}
          subtitle={loading ? undefined : (
            <span data-testid="team-counts">{formatMessage({ id: "team.page.counts" }, { members, humans, agents, computers })}</span>
          )}
          action={action}
          tabs={withNav ? undefined : tabs}
          withNav={withNav}
        />
      </div>
    );
  }
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
      <div className="border-b border-line-seam px-(--column-margin) py-0">
        {tabs}
      </div>
    </div>
  );
}
