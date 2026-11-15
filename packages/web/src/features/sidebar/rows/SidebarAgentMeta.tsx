import { useIntl } from "react-intl";
import { AgentStateMark } from "@botiverse/raft-ui-ext";
import { useAgentDisplayState, useAgentStore } from "../../../store/agentStore";
import { useMachineStore } from "../../../store/machineStore";
import { agentMarkState, agentStoppedByComputer } from "../../team/teamWorking";
import { formatAgentDisplayStateText } from "../../../utils/activity";

/**
 * The end of an agent's DM row (task #10 item 8; Figmama, raft-design sidebar.md 11/16): the Team page's state mark
 * while it works or is stuck, nothing while it is idle or off — no runtime, no live sentence. An unread count takes
 * the place first (SidebarPeerRowBody). Its accessible name is the state.
 */
export function SidebarAgentMeta({ agentId, external = false }: {
  agentId: string;
  /** Kept for callers; an external agent shows its mark the same way. */
  runtime?: string | null;
  external?: boolean;
}) {
  const intl = useIntl();
  const display = useAgentDisplayState(agentId);
  const stoppedByComputer = useMachineStore((s) => {
    const agent = useAgentStore.getState().agents.find((a) => a.id === agentId);
    return !!agent && !external && agentStoppedByComputer(agent, s.machines);
  });
  const mark = agentMarkState(display, false, stoppedByComputer);
  if (mark !== "working" && mark !== "held") return null;
  return (
    <span className="flex shrink-0 items-center" data-testid="sidebar-agent-state-mark">
      <AgentStateMark state={mark} label={formatAgentDisplayStateText(intl, display, { withDetail: false })} />
    </span>
  );
}
