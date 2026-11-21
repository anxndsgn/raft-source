import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { ListRow, ListRowBody, ListRowDescription, ListRowGroup, ListRowIcon, ListRowTitle, ScrollArea } from "@botiverse/raft-ui";
import { AgentStateMark } from "@botiverse/raft-ui-ext";
import type { AgentState } from "@botiverse/raft-ui-ext";
import AgentActivitySubscription from "../../components/agent/AgentActivitySubscription";
import { useVisibleNotifications } from "../../components/layout/useSystemNotifications";
import type { NotificationEntry } from "../../components/layout/useSystemNotifications";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useProfileStore } from "../../store/profileStore";
import { useMachineStore } from "../../store/machineStore";
import { TeamAgentLine } from "./TeamAgentLine";
import { TeamComputerCards } from "./TeamComputerCards";
import { TeamHeader } from "./TeamHeader";
import { PAGE_COLUMN_CLASS, PAGE_ROOT_CLASS } from "../../components/ui/PageHead";
import { useOpenAgentWork } from "./useOpenAgentWork";
import { useTeamAgents } from "./useTeamAgents";
import type { TeamAgentRow } from "./useTeamAgents";

/**
 * The inbox's For me notices the Overview repeats (PRD 团队页 §5.1 ①): a computer offline, one row each with
 * the agents it stopped (an agent stopped by its computer has no row of its own); usage limits are the held agents' rows.
 */
const isNeedsYouNotice = (entry: NotificationEntry) => entry.id.startsWith("machine-offline:");

const LEGEND: { state: AgentState; label: "team.state.working" | "team.state.idle" | "team.state.offline" | "team.state.held" }[] = [
  { state: "working", label: "team.state.working" },
  { state: "idle", label: "team.state.idle" },
  { state: "offline", label: "team.state.offline" },
  { state: "held", label: "team.state.held" },
];

function Section({ title, count, testId, children }: { title: string; count: number; testId: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      {/* The Members page's group heading (title, then the count in Space Mono). */}
      <h3 className="flex min-w-0 items-baseline gap-2 text-footnote font-bold text-foreground-hint">
        <span className="truncate">{title}</span>
        <span className="font-mono font-normal md:pointer-fine:font-sans">{count}</span>
      </h3>
      {children}
    </section>
  );
}

/** A system notice the inbox lists under For me, as a row: its title, what it says, and its action. */
function NoticeRow({ entry }: { entry: NotificationEntry }) {
  const act = useCallback(() => entry.action?.onClick(), [entry]);
  return (
    <ListRow
      variant="default"
      render={<div role="button" tabIndex={0} />}
      onClick={act}
      className="min-h-0 cursor-pointer px-4 py-2 [--list-row-rule-start:16px] before:right-4 pointer-coarse:min-h-0"
      data-testid="team-notice-row"
    >
      {/* Every row's icon in the state mark's 12px box, so the rows' text starts on one line (Figmama 11/16). */}
      <ListRowIcon className="w-3 justify-center self-start pt-1 [&_svg]:size-3">{entry.icon}</ListRowIcon>
      <ListRowBody>
        {/* Who stopped is the point: the line wraps rather than cut (Anna 11/16). */}
        <ListRowTitle className="whitespace-normal">{entry.title}</ListRowTitle>
        <ListRowDescription>{entry.body}</ListRowDescription>
      </ListRowBody>
      {entry.action ? <span className="shrink-0 text-footnote font-bold text-foreground-muted">{entry.action.label}</span> : null}
    </ListRow>
  );
}

/**
 * The Team page's Overview (PRD 团队页 §5.1, design T1): what needs you (held
 * agents, a machine offline: the inbox's own For me notices), who is working,
 * who is idle or offline, the computers, and what the marks mean.
 */
export function TeamOverviewPage() {
  const { formatMessage } = useIntl();
  const nav = useAppNavigate();
  const { held: allHeld, working, resting } = useTeamAgents();
  // One cause, one row: an agent its computer stopped is in that computer's row.
  const held = useMemo(() => allHeld.filter((row) => !row.heldByComputer), [allHeld]);
  const machines = useMachineStore((s) => s.machines);
  const notices = useVisibleNotifications("desktop").filter(isNeedsYouNotice);
  const openWork = useOpenAgentWork();
  // A row opens the agent's details in a column right of the Overview (PRD v2.0 §5.4; a phone pushes them, full
  // screen); its channel and task links open the work.
  const openProfile = useProfileStore((s) => s.openProfile);
  const openAgent = useCallback((row: TeamAgentRow) => openProfile("agent", row.agent.id, { teamColumn: true }), [openProfile]);
  const openChannel = useCallback((channelId: string) => nav.toChannel(channelId), [nav]);
  const workingByMachine = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of working) if (row.agent.machineId) counts.set(row.agent.machineId, (counts.get(row.agent.machineId) ?? 0) + 1);
    return counts;
  }, [working]);
  const line = (row: TeamAgentRow) => (
    <TeamAgentLine key={row.agent.id} row={row} variant="page" onOpen={openAgent} onOpenWork={openWork} onOpenChannel={openChannel} testId={`team-overview-${row.state}`} />
  );
  const needsYou = held.length + notices.length;
  return (
    <div className={`${PAGE_ROOT_CLASS} flex min-h-0 min-w-0 flex-1 flex-col font-sans`} data-testid="team-overview-page">
      {/* A root of the Team tab on a phone (PRD 团队页 §8): no Back. */}
      <TeamHeader view="overview" />
      {/* What each working agent is doing: their current step while the page is open. */}
      <AgentActivitySubscription agentIdKey={working.map((row) => row.agent.id).join(",")} />
      <ScrollArea className="min-h-0 flex-1 bg-layer-canvas safe-bottom" data-testid="team-overview-scroller">
        <div className={`flex flex-col gap-6 px-5 pt-4 pb-8 ${PAGE_COLUMN_CLASS}`}>
          {needsYou > 0 ? (
            <Section title={formatMessage({ id: "team.overview.needsYou" })} count={needsYou} testId="team-overview-needs-you">
              <ListRowGroup>
                {held.map(line)}
                {notices.map((entry) => <NoticeRow key={entry.id} entry={entry} />)}
              </ListRowGroup>
            </Section>
          ) : null}
          <Section title={formatMessage({ id: "team.overview.working" })} count={working.length} testId="team-overview-working">
            {working.length > 0 ? (
              <ListRowGroup>{working.map(line)}</ListRowGroup>
            ) : (
              <p className="text-footnote text-foreground-muted">{formatMessage({ id: "team.overview.nobodyWorking" })}</p>
            )}
          </Section>
          {resting.length > 0 ? (
            <Section title={formatMessage({ id: "team.overview.resting" })} count={resting.length} testId="team-overview-resting">
              <ListRowGroup>{resting.map(line)}</ListRowGroup>
            </Section>
          ) : null}
          {machines.length > 0 ? (
            <Section title={formatMessage({ id: "team.overview.computers" })} count={machines.length} testId="team-overview-computers">
              <TeamComputerCards machines={machines} workingByMachine={workingByMachine} />
            </Section>
          ) : null}
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-foreground-muted" aria-label={formatMessage({ id: "team.overview.legend" })} data-testid="team-overview-legend">
            {LEGEND.map((item) => (
              <li key={item.state} className="flex items-center gap-1.5">
                <AgentStateMark state={item.state} />
                {formatMessage({ id: item.label })}
              </li>
            ))}
          </ul>
        </div>
      </ScrollArea>
    </div>
  );
}
