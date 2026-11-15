import { isExternalAgentRuntime } from "@botiverse/raft-shared";
import { useCallback } from "react";
import { isAgentInMemberLists, resolveAgentDisplayState, useAgentStore } from "../../store/agentStore";
import { isMachineOffline, useMachineStore } from "../../store/machineStore";
import type { Machine } from "../../store/machineStore";

/**
 * How many of the listed agents are working or thinking, by the Team page's
 * rule (useTeamAgents): an agent on an offline computer is offline. A number,
 * so a store update that leaves it alone renders nothing.
 */
export function useWorkingAgentCount(): number {
  const machines = useMachineStore((s) => s.machines);
  const select = useCallback((state: ReturnType<typeof useAgentStore.getState>) => countWorking(state, machines), [machines]);
  return useAgentStore(select);
}

function countWorking(state: ReturnType<typeof useAgentStore.getState>, machines: readonly Machine[]): number {
  let working = 0;
  for (const agent of state.agents) {
    if (!isAgentInMemberLists(agent)) continue;
    const external = agent.external === true || isExternalAgentRuntime(agent.runtime);
    const { activity } = resolveAgentDisplayState(agent, state.agentActivities[agent.id], external, undefined, isMachineOffline(machines, agent.machineId));
    if (activity === "working" || activity === "thinking") working += 1;
  }
  return working;
}

/** The Team page's three views, each its own address (teamViewPath). */
export type TeamView = "overview" | "members" | "computers";

export function teamViewPath(serverSlug: string, view: TeamView): string {
  const base = `/s/${serverSlug}`;
  return view === "overview" ? `${base}/team` : `${base}/${view}`;
}
