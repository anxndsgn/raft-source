import { useCallback, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { Button, ListRow, ListRowBody, ListRowChevron, ListRowDescription, ListRowIcon, ListRowMeta, ListRowTitle, ListRowTop } from "@botiverse/raft-ui";
import { AgentStateMark } from "@botiverse/raft-ui-ext";

import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useTaskStore } from "../../store/taskStore";
import { useAgentDisplayState, useAgentStore } from "../../store/agentStore";
import { useAuthStore } from "../../store/authStore";
import { useChannelStore } from "../../store/channelStore";
import { useLiveAgentActivityStore } from "../../store/liveAgentActivityStore";
import { findStoredChannel } from "../../store/storedChannel";
import { agentMarkState, agentStoppedByComputer } from "../../features/team/teamWorking";
import { useMachineStore } from "../../store/machineStore";
import { formatAgentDisplayStateText } from "../../utils/activity";
import { useUsageLimitAttention } from "../layout/useUsageLimitAttention";
import { useResumeMoment, useShortSpan } from "../task/agentTimeText";
import { openTaskInSidePanel } from "../task/useOpenTask";

/**
 * Layout redesign 7.1, Team page T3 (Figmama 11/16): the top of a member's details. For an agent, one line of what
 * it is doing now — its state mark, "Working on task #6 in #test · 12 min" and its current step under it (opens the
 * task), or held: why and when it resumes — and Message at the end of the same line.
 */
export function ProfileCardFooter({ type, id }: { type: "agent" | "human"; id: string }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const nav = useAppNavigate();
  const serverTasks = useTaskStore((s) => s.serverTasks);
  const loaded = useTaskStore((s) => s.serverTasksLoaded);
  const loadServerTasks = useTaskStore((s) => s.loadServerTasks);
  useEffect(() => {
    if (!loaded) void loadServerTasks();
  }, [loaded, loadServerTasks]);
  const current = useMemo(
    () => (type === "agent"
      ? serverTasks
        .filter((t) => t.claimedByType === "agent" && t.claimedById === id && t.status === "in_progress")
        .sort((a, b) => b.taskNumber - a.taskNumber)[0] ?? null
      : null),
    [id, serverTasks, type],
  );
  const channelName = useChannelStore((s) => (current ? current.channelName || findStoredChannel(s, current.channelId)?.name || null : null));
  const display = useAgentDisplayState(type === "agent" ? id : "");
  const resetsAt = useUsageLimitAttention().notifications.find((notice) => type === "agent" && notice.affectedAgentIds.includes(id));
  const computerStopped = useMachineStore((s) => {
    const agent = type === "agent" ? useAgentStore.getState().agents.find((a) => a.id === id) : undefined;
    return !!agent && agentStoppedByComputer(agent, s.machines);
  });
  const mark = type === "agent" ? agentMarkState(display, !!resetsAt, computerStopped) : null;
  const startedAt = useLiveAgentActivityStore((s) => (type === "agent" ? s.items.find((item) => item.agentId === id && item.idleSince === null)?.startedAt ?? null : null));
  const resumeMoment = useResumeMoment();
  const shortSpan = useShortSpan();
  const openCurrent = useCallback(() => {
    if (current && !openTaskInSidePanel(current, nav.toChannel)) nav.toChannel(current.channelId);
  }, [current, nav]);
  // Message: an agent's DM, a person's (opened if there is none yet); none for an archived agent or yourself (7.1).
  const archived = useAgentStore((s) => type === "agent" && !!s.agents.find((a) => a.id === id)?.deletedAt);
  const self = useAuthStore((s) => type === "human" && s.user?.id === id);
  const openUserDM = useChannelStore((s) => s.openUserDM);
  const dmId = useChannelStore((s) => (type === "human" ? s.dmChannels.find((c) => c.peerId === id)?.id ?? null : null));
  const message = useCallback(async () => {
    if (type === "agent") return nav.toAgent(id);
    const dm = dmId ?? (await openUserDM(id))?.id;
    if (dm) nav.toDm(dm);
  }, [dmId, id, nav, openUserDM, type]);
  // Held: why (a usage limit and when it resumes, or its computer); working on a task: the task, for how long, the step.
  let title: string | null = null;
  let step: string | null = null;
  if (mark === "held") {
    const byComputer = !!display.blocked || computerStopped;
    const moment = !byComputer ? resumeMoment(resetsAt?.resetsAt) : null;
    title = byComputer
      ? (display.blocked ? formatAgentDisplayStateText(intl, display, { withDetail: false }) : formatMessage({ id: "agent.status.computerOffline" }))
      : moment
        ? `${formatMessage({ id: "taskSection.held" })} · ${formatMessage({ id: "taskSection.heldUntil" }, { when: moment.when })}`
        : formatMessage({ id: "taskSection.held" });
  } else if (current) {
    title = formatMessage({ id: "profileCard.workingOn" }, { channel: channelName ? `#${channelName}` : "", number: current.taskNumber });
    step = mark === "working" ? display.activityText || null : null;
  }
  // Gone from the server (removed or left): the card below says so, and Message hides (index.css).
  const canMessage = !archived && !self;
  if (!title && !canMessage) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line-hairline px-4 py-3" data-testid="profile-card-footer">
      {title ? (
        // raft-ui ListRow: what it is doing now; a task's opens it.
        <ListRow variant="plain" interactive={!!current} onClick={current ? openCurrent : undefined} className="min-w-0 flex-1" data-testid="profile-card-current-task">
          {mark ? <ListRowIcon className="w-3 justify-center self-start pt-1"><AgentStateMark state={mark} /></ListRowIcon> : null}
          <ListRowBody>
            <ListRowTop>
              <ListRowTitle>{title}</ListRowTitle>
              {mark === "working" && startedAt ? <ListRowMeta className="font-mono text-mono-meta">{shortSpan(startedAt)}</ListRowMeta> : null}
            </ListRowTop>
            {step ? <ListRowDescription>{step}</ListRowDescription> : null}
          </ListRowBody>
          {current ? <ListRowChevron /> : null}
        </ListRow>
      ) : <span className="flex-1" />}
      {canMessage ? (
        <Button type="button" size="md" variant="outline" className="shrink-0" onClick={message} data-testid="profile-card-message">
          {formatMessage({ id: "profileCard.message" })}
        </Button>
      ) : null}
    </div>
  );
}
