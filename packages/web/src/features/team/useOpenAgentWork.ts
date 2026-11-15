import { useCallback } from "react";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useChannelStore } from "../../store/channelStore";
import { findStoredChannel } from "../../store/storedChannel";
import { useTimelineViewStore } from "../../store/timelineViewStore";
import type { TeamAgentRow } from "./useTeamAgents";

/** Opens where an agent's work is: its task's channel showing that task (reply mode's task view), else the agent. */
export function useOpenAgentWork() {
  const nav = useAppNavigate();
  return useCallback((row: TeamAgentRow) => {
    const task = row.task;
    if (!task) {
      nav.toAgent(row.agent.id);
      return;
    }
    if (findStoredChannel(useChannelStore.getState(), task.channelId)?.replyMode === true) {
      void useTimelineViewStore.getState().openView(task.channelId, { kind: "task", taskNumber: task.taskNumber, title: task.title });
    }
    nav.toChannel(task.channelId);
  }, [nav]);
}
