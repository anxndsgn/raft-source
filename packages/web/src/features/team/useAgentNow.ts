import { useIntl } from "react-intl";
import { currentTimeMs } from "@botiverse/raft-shared";
import type { AgentState as AgentMarkState } from "@botiverse/raft-ui-ext";
import { useResumeMoment } from "../../components/task/agentTimeText";
import { useAgentDisplayState } from "../../store/agentStore";
import type { Agent, AgentDisplayState } from "../../store/agentStore";
import { useLiveAgentActivityStore } from "../../store/liveAgentActivityStore";
import { useMachineStore } from "../../store/machineStore";
import { formatActivityText, formatAgentDisplayStateText } from "../../utils/activity";
import { agentMarkState, agentStoppedByComputer } from "./teamWorking";

export interface AgentNow {
  mark: AgentMarkState;
  /** The short words: "Held · back 23:00", "Computer offline", "Working · 12 min", or its presence word. */
  word: string;
  /** The full state, for a title. */
  title: string;
  display: AgentDisplayState;
  /** Held by its computer (offline, too old, access revoked), not a usage limit. */
  byComputer: boolean;
  startedAt: number | null;
}

/**
 * What an agent is doing now, in the one writing every Team surface shares (the members table, the phone's rows, the
 * details' strip): its state mark by the one rule (agentMarkState) and its words. `limitResetsAt`: held by a usage
 * limit (the inbox's notice) and when it resumes; undefined when it isn't.
 */
export function useAgentNow(agent: Agent, limitResetsAt: string | null | undefined): AgentNow {
  const intl = useIntl();
  const { formatMessage } = intl;
  const resumeMoment = useResumeMoment();
  const display = useAgentDisplayState(agent.id, agent);
  const computerStopped = useMachineStore((s) => agentStoppedByComputer(agent, s.machines));
  const startedAt = useLiveAgentActivityStore((s) => s.items.find((item) => item.agentId === agent.id && item.idleSince === null)?.startedAt ?? null);
  const mark = agentMarkState(display, limitResetsAt !== undefined, computerStopped);
  const title = formatAgentDisplayStateText(intl, display, { withDetail: false });
  const byComputer = mark === "held" && (!!display.blocked || computerStopped);
  let word: string;
  if (mark === "held" && !byComputer) {
    const moment = resumeMoment(limitResetsAt);
    word = moment
      ? `${formatMessage({ id: "taskSection.held" })} · ${formatMessage({ id: "taskSection.heldUntil" }, { when: moment.when })}`
      : formatMessage({ id: "taskSection.held" });
  } else if (byComputer) {
    word = display.blocked ? title : formatMessage({ id: "agent.status.computerOffline" });
  } else if (mark === "working" && startedAt) {
    word = formatMessage({ id: "taskSection.workingFor" }, { minutes: Math.max(1, Math.round((currentTimeMs() - startedAt) / 60000)) });
  } else if (agent.status === "stopped") {
    // Stopped by a person: the details' head says so too (Anna 11/16: one name for one state).
    word = formatMessage({ id: "activity.log.status.stopped" });
  } else {
    word = display.paused || display.likelyOnline ? title : formatActivityText(formatMessage, display.activity, "");
  }
  return { mark, word, title, display, byComputer, startedAt };
}
