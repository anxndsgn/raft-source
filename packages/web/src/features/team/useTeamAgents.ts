import { useEffect, useMemo } from "react";
import { isExternalAgentRuntime } from "@botiverse/raft-shared";
import type { AgentState as AgentMarkState } from "@botiverse/raft-ui-ext";
import { useUsageLimitAttention } from "../../components/layout/useUsageLimitAttention";
import { isAgentInMemberLists, resolveAgentDisplayState, useAgentStore } from "../../store/agentStore";
import type { Agent } from "../../store/agentStore";
import { useLiveAgentActivityStore } from "../../store/liveAgentActivityStore";
import { isMachineOffline, useMachineStore } from "../../store/machineStore";
import { useTaskStore } from "../../store/taskStore";
import type { Task } from "../../store/taskStore";

/** One agent on the Team page and in the Team tab's preview (PRD 团队页 §4, §5.1). */
export interface TeamAgentRow {
  agent: Agent;
  state: AgentMarkState;
  /** Working: when this stretch began (the live activity store), for "12 min". */
  startedAt: number | null;
  /** Working: the task it holds (in progress, claimed by it), the latest moved first. */
  task: Task | null;
  /** Held by a usage limit: when it resumes (the server's usage-limit notice), and what waits on it. */
  resetsAt: string | null;
  waitingTasks: number;
}

export interface TeamAgents {
  /** Held by a usage limit: the inbox's system notices (useUsageLimitAttention), listed once, here only. */
  held: TeamAgentRow[];
  working: TeamAgentRow[];
  /** Idle, then offline. */
  resting: TeamAgentRow[];
}

const OPEN_TASK = new Set(["todo", "in_progress", "in_review"]);

/**
 * The server's listed agents by state, from data the web already has: the
 * agents' activity, the live activity store's start times, the server's
 * active tasks (their first summary pages, asked for here), and the
 * usage-limit notices. Mount it only where it shows (the preview while open,
 * the Overview): the notices are polled while it is mounted.
 */
export function useTeamAgents(): TeamAgents {
  const agents = useAgentStore((s) => s.agents);
  const activities = useAgentStore((s) => s.agentActivities);
  const machines = useMachineStore((s) => s.machines);
  const live = useLiveAgentActivityStore((s) => s.items);
  const tasks = useTaskStore((s) => s.serverTasks);
  const { notifications } = useUsageLimitAttention();
  useEffect(() => {
    void useTaskStore.getState().loadActiveTaskSummaries();
  }, []);
  return useMemo(() => {
    const resetsAt = new Map<string, string | null>();
    for (const notice of notifications) for (const id of notice.affectedAgentIds) resetsAt.set(id, notice.resetsAt);
    const startedAt = new Map<string, number>();
    for (const item of live) if (item.idleSince === null) startedAt.set(item.agentId, item.startedAt);
    const held: TeamAgentRow[] = [];
    const working: TeamAgentRow[] = [];
    const idle: TeamAgentRow[] = [];
    const offline: TeamAgentRow[] = [];
    for (const agent of agents) {
      if (!isAgentInMemberLists(agent)) continue;
      const theirs = tasks
        .filter((task) => task.claimedByType === "agent" && task.claimedById === agent.id && OPEN_TASK.has(task.status))
        .sort((a, b) => (b.lastActivityAt ?? b.updatedAt).localeCompare(a.lastActivityAt ?? a.updatedAt));
      const inProgress = theirs.find((task) => task.status === "in_progress") ?? null;
      const row: TeamAgentRow = { agent, state: "idle", startedAt: null, task: null, resetsAt: null, waitingTasks: 0 };
      if (resetsAt.has(agent.id)) {
        held.push({ ...row, state: "held", resetsAt: resetsAt.get(agent.id) ?? null, waitingTasks: theirs.filter((task) => task.status !== "in_review").length });
        continue;
      }
      const external = agent.external === true || isExternalAgentRuntime(agent.runtime);
      const display = resolveAgentDisplayState(agent, activities[agent.id], external, undefined, isMachineOffline(machines, agent.machineId));
      if (display.activity === "working" || display.activity === "thinking") {
        working.push({ ...row, state: "working", startedAt: startedAt.get(agent.id) ?? null, task: inProgress });
      } else if (display.isOnline) {
        idle.push(row);
      } else {
        offline.push({ ...row, state: "offline" });
      }
    }
    // Who started first, first: the order the live store keeps.
    working.sort((a, b) => (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity));
    return { held, working, resting: [...idle, ...offline] };
  }, [activities, agents, live, machines, notifications, tasks]);
}
