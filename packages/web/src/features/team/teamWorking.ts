import { isExternalAgentRuntime } from "@botiverse/raft-shared";
import { useCallback } from "react";
import type { AgentState as AgentMarkState } from "@botiverse/raft-ui-ext";
import { isAgentInMemberLists, resolveAgentDisplayState, useAgentStore } from "../../store/agentStore";
import type { Agent, AgentDisplayState } from "../../store/agentStore";
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

/**
 * The state mark an agent shows (working-agents.md › The state mark), one rule
 * for every place: held only by a usage limit (the inbox's notice, `heldByLimit`,
 * or the agent's own usage_limit error), as the legend says 被限制卡住; working;
 * online and idle; or offline — a computer that stopped it (offline, too old,
 * access revoked) reads offline, its computer is what needs you.
 */
export function agentMarkState(display: Pick<AgentDisplayState, "activity" | "isOnline" | "blocked" | "activityErrorCode">, heldByLimit = false): AgentMarkState {
  if (heldByLimit || display.activityErrorCode === "usage_limit") return "held";
  if (display.blocked) return "offline";
  if (display.activity === "working" || display.activity === "thinking") return "working";
  return display.isOnline ? "idle" : "offline";
}

/** An agent's display state as the Team page reads it: an agent on an offline computer is offline. */
export function teamDisplayState(agent: Agent, activities: ReturnType<typeof useAgentStore.getState>["agentActivities"], machines: readonly Machine[]): AgentDisplayState {
  const external = agent.external === true || isExternalAgentRuntime(agent.runtime);
  return resolveAgentDisplayState(agent, activities[agent.id], external, undefined, isMachineOffline(machines, agent.machineId));
}

function countWorking(state: ReturnType<typeof useAgentStore.getState>, machines: readonly Machine[]): number {
  let working = 0;
  for (const agent of state.agents) {
    if (!isAgentInMemberLists(agent)) continue;
    const { activity } = teamDisplayState(agent, state.agentActivities, machines);
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
