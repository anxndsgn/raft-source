import { useCallback } from "react";
import { useIntl } from "react-intl";
import { ChevronRight } from "lucide-react";
import { ListRow, ListRowBody, ListRowDescription, ListRowGroup, ListRowIcon, ListRowTitle, PopoverHeader, PopoverTitle, ScrollArea, TextLink } from "@botiverse/raft-ui";
import { useVisibleNotifications } from "../../components/layout/useSystemNotifications";
import AgentActivitySubscription from "../../components/agent/AgentActivitySubscription";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import { TeamAgentLine } from "./TeamAgentLine";
import { useOpenAgentWork } from "./useOpenAgentWork";
import { useTeamAgents } from "./useTeamAgents";
import type { TeamAgentRow } from "./useTeamAgents";

/**
 * The Team tab's hover preview (PRD 团队页 §4, design T2): "2 working · 1 held
 * up", the held agents first (when they resume, what waits), then who is
 * working (channel, task, step, for how long). A row opens its task's channel
 * showing that task; View all opens the Team page.
 */
export function TeamWorkingPreview({ onNavigate }: { onNavigate: () => void }) {
  const { formatMessage } = useIntl();
  const nav = useAppNavigate();
  const { held: allHeld, working } = useTeamAgents();
  // One cause, one row: an agent its computer stopped is in that computer's row, as on the Overview.
  const held = allHeld.filter((row) => !row.heldByComputer);
  const computers = useVisibleNotifications("desktop").filter((entry) => entry.id.startsWith("machine-offline:"));
  const openWork = useOpenAgentWork();
  const open = useCallback((row: TeamAgentRow) => {
    onNavigate();
    openWork(row);
  }, [onNavigate, openWork]);
  const viewAll = useCallback(() => {
    onNavigate();
    nav.toTeam();
  }, [nav, onNavigate]);
  const openComputer = (entry: (typeof computers)[number]) => () => {
    onNavigate();
    entry.action?.onClick();
  };
  return (
    <div className="flex flex-col">
      {/* What each of them is doing: their current step while the preview is open. */}
      <AgentActivitySubscription agentIdKey={working.map((row) => row.agent.id).join(",")} />
      <PopoverHeader className="px-4 pt-3 pb-1">
        <PopoverTitle className="text-footnote font-bold">
          {formatMessage({ id: working.length ? "team.preview.title" : "team.preview.titleIdle" }, { working: working.length, held: allHeld.length })}
        </PopoverTitle>
      </PopoverHeader>
      <ScrollArea tabIndex={-1} className="max-h-[min(60vh,420px)]">
        <ListRowGroup className="rounded-none border-0 bg-transparent">
          {held.map((row) => (
            <TeamAgentLine key={row.agent.id} row={row} variant="preview" onOpen={open} testId="team-preview-row" />
          ))}
          {computers.map((entry) => (
            <ListRow key={entry.id} variant="default" onClick={openComputer(entry)} className="min-h-0 px-4 py-2 [--list-row-rule-start:16px] before:right-4 pointer-coarse:min-h-0" data-testid="team-preview-computer">
              <ListRowIcon className="w-3 justify-center self-start pt-1 [&_svg]:size-3">{entry.icon}</ListRowIcon>
              <ListRowBody>
                <ListRowTitle className="whitespace-normal">{entry.title}</ListRowTitle>
                <ListRowDescription>{entry.body}</ListRowDescription>
              </ListRowBody>
            </ListRow>
          ))}
          {working.map((row) => (
            <TeamAgentLine key={row.agent.id} row={row} variant="preview" onOpen={open} testId="team-preview-row" />
          ))}
        </ListRowGroup>
      </ScrollArea>
      <div className="px-4 pt-1 pb-3">
        <TextLink render={<button type="button" />} onClick={viewAll} className="inline-flex items-center gap-0.5 text-footnote font-bold" data-testid="team-preview-view-all">
          {formatMessage({ id: "team.preview.viewAll" })}
          <ChevronRight size={12} aria-hidden />
        </TextLink>
      </div>
    </div>
  );
}
