import { useEffect, useMemo } from "react";
import type { AgentState as AgentMarkState } from "@botiverse/raft-ui-ext";
import { useUsageLimitAttention } from "../../components/layout/useUsageLimitAttention";
import { isAgentInMemberLists, useAgentStore } from "../../store/agentStore";
import type { Agent } from "../../store/agentStore";
import { useLiveAgentActivityStore } from "../../store/liveAgentActivityStore";
import { useMachineStore } from "../../store/machineStore";
import { useTaskStore } from "../../store/taskStore";
import type { Task } from "../../store/taskStore";
import { agentMarkState, teamDisplayState } from "./teamWorking";

/** One agent on the Team page and in the Team tab's preview (PRD 团队页 §4, §5.1). */
export interface TeamAgentRow {
  agent: Agent;
  state: AgentMarkState;
  /** Working: when this stretch began (the live activity store), for "12 min". */
  startedAt: number | null;
  /** Working: the task it holds (in progress, claimed by it); held: the task waiting on it. The latest moved first. */
  task: Task | null;
  /** Held by a usage limit: when it resumes (the server's usage-limit notice), and what waits on it. */
  resetsAt: string | null;
  waitingTasks: number;
  /** Held: the runtime whose usage ran out (the notice's provider). */
  provider: string | null;
  /** Held by its computer (offline, too old, access revoked), not a usage limit: its state says which. */
  heldByComputer: boolean;
  /** Idle or offline: the last task it finished (in review or done), for "Finished task #3 5 min ago". */
  finished: Task | null;
}

export interface TeamAgents {
  /** Held by a usage limit: the inbox's system notices (useUsageLimitAttention), listed once, here only. */
  held: TeamAgentRow[];
  working: TeamAgentRow[];
  /** Idle, then offline. */
  resting: TeamAgentRow[];
}

const OPEN_TASK = new Set(["todo", "in_progress", "in_review"]);
const movedAt = (task: Task) => task.lastActivityAt ?? task.updatedAt;

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
    const provider = new Map<string, string>();
    for (const notice of notifications) {
      for (const id of notice.affectedAgentIds) {
        resetsAt.set(id, notice.resetsAt);
        provider.set(id, notice.provider);
      }
    }
    const startedAt = new Map<string, number>();
    for (const item of live) if (item.idleSince === null) startedAt.set(item.agentId, item.startedAt);
    const held: TeamAgentRow[] = [];
    const working: TeamAgentRow[] = [];
    const idle: TeamAgentRow[] = [];
    const offline: TeamAgentRow[] = [];
    for (const agent of agents) {
      if (!isAgentInMemberLists(agent)) continue;
      const claimed = tasks
        .filter((task) => task.claimedByType === "agent" && task.claimedById === agent.id)
        .sort((a, b) => movedAt(b).localeCompare(movedAt(a)));
      const theirs = claimed.filter((task) => OPEN_TASK.has(task.status));
      const inProgress = theirs.find((task) => task.status === "in_progress") ?? null;
      const finished = claimed.find((task) => task.status === "in_review" || task.status === "done") ?? null;
      const row: TeamAgentRow = { agent, state: "idle", startedAt: null, task: null, resetsAt: null, waitingTasks: 0, provider: null, heldByComputer: false, finished };
      if (resetsAt.has(agent.id)) {
        const waiting = theirs.filter((task) => task.status !== "in_review");
        held.push({ ...row, state: "held", resetsAt: resetsAt.get(agent.id) ?? null, task: waiting[0] ?? null, waitingTasks: waiting.length, provider: provider.get(agent.id) ?? null });
        continue;
      }
      const display = teamDisplayState(agent, activities, machines);
      const state = agentMarkState(display);
      if (state === "working") {
        working.push({ ...row, state: "working", startedAt: startedAt.get(agent.id) ?? null, task: inProgress });
      } else if (state === "idle") {
        idle.push(row);
      } else if (state === "held") {
        // Its computer stopped it, or its own usage_limit error came before the server's notice.
        held.push({ ...row, state, heldByComputer: !!display.blocked, task: theirs.find((task) => task.status !== "in_review") ?? null, waitingTasks: theirs.filter((task) => task.status !== "in_review").length });
      } else {
        offline.push({ ...row, state });
      }
    }
    // Who started first, first: the order the live store keeps.
    working.sort((a, b) => (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity));
    return { held, working, resting: [...idle, ...offline] };
  }, [activities, agents, live, machines, notifications, tasks]);
}
