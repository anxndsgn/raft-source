import { useMemo } from "react";
import { isAgentInMemberLists, useAgentStore } from "../store/agentStore";
import type { Agent } from "../store/agentStore";
import { useMachineStore } from "../store/machineStore";
import type { Machine } from "../store/machineStore";

/**
 * Team page PRD 5.1 (Anna 11/16): a computer offline needs you only while an agent no one stopped is on it — the
 * inbox's For me, the Team page's Needs you, the rail's dot and its words and the Computers page's summary count the
 * same. The server's summary counts the computer's own offline block alone; this drops that item where no such agent
 * is on it, and keeps every other.
 */
export function withTeamAttention<T extends Pick<Machine, "id" | "attention">>(machines: readonly T[], agents: readonly Agent[]): T[] {
  const waiting = new Set(agents.filter((a) => isAgentInMemberLists(a) && a.status !== "stopped" && a.machineId).map((a) => a.machineId!));
  return machines.map((machine) => {
    const attention = machine.attention;
    if (!attention || waiting.has(machine.id)) return machine;
    const items = attention.items.filter((item) => item.code !== "computer_offline");
    return items.length === attention.items.length ? machine : { ...machine, attention: { ...attention, items, count: items.length } };
  });
}

/** The machines with the Team page's attention rule applied (withTeamAttention), one array while nothing changes. */
export function useTeamAttentionMachines(): Machine[] {
  const machines = useMachineStore((s) => s.machines);
  const agents = useAgentStore((s) => s.agents);
  return useMemo(() => withTeamAttention(machines, agents), [agents, machines]);
}
