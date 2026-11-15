import { useCallback, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { ChevronRight, CircleDot } from "lucide-react";
import { Button } from "@botiverse/raft-ui";

import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useTaskStore } from "../../store/taskStore";
import { useAgentStore } from "../../store/agentStore";
import { useAuthStore } from "../../store/authStore";
import { useChannelStore } from "../../store/channelStore";
import { openTaskInSidePanel } from "../task/useOpenTask";

/**
 * Layout redesign 7.1: the top of a member's details in the side panel (what the dropped person card held). For an
 * agent, what it is doing now — its task in progress ("Working on Task #1 in #channel ›", opens the task) — and
 * Message (its DM).
 */
export function ProfileCardFooter({ type, id }: { type: "agent" | "human"; id: string }) {
  const { formatMessage } = useIntl();
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
  // Gone from the server (removed or left): the card below says so, and Message hides (index.css).
  const canMessage = !archived && !self;
  if (!current && !canMessage) return null;
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-line-hairline px-4 py-3" data-testid="profile-card-footer">
      {current ? (
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-control bg-fill-muted px-2 py-1.5 text-left text-callout text-foreground hover:overlay-subtle"
          onClick={openCurrent}
          data-testid="profile-card-current-task"
        >
          <CircleDot size={14} aria-hidden className="shrink-0 text-success-strong" />
          <span className="min-w-0 flex-1 truncate">
            {formatMessage({ id: "profileCard.workingOn" }, { channel: current.channelName ? `#${current.channelName}` : "", number: current.taskNumber })}
          </span>
          <ChevronRight size={14} aria-hidden className="shrink-0 text-foreground-hint" />
        </button>
      ) : null}
      {canMessage ? (
        <Button type="button" size="md" variant="outline" className="self-start" onClick={message} data-testid="profile-card-message">
          {formatMessage({ id: "profileCard.message" })}
        </Button>
      ) : null}
    </div>
  );
}
