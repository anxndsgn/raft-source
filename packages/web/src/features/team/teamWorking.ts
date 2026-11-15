import { isExternalAgentRuntime } from "@botiverse/raft-shared";
import { isAgentInMemberLists, resolveAgentDisplayState } from "../../store/agentStore";
import type { useAgentStore } from "../../store/agentStore";

/** How many of the listed agents are working or thinking: a number, so a store update that leaves it alone renders nothing. */
export function selectWorkingAgentCount(state: ReturnType<typeof useAgentStore.getState>): number {
  let working = 0;
  for (const agent of state.agents) {
    if (!isAgentInMemberLists(agent)) continue;
    const external = agent.external === true || isExternalAgentRuntime(agent.runtime);
    const { activity } = resolveAgentDisplayState(agent, state.agentActivities[agent.id], external);
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
