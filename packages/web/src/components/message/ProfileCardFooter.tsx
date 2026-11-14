import { useCallback, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { ChevronRight, CircleDot } from "lucide-react";
import { Button } from "@botiverse/raft-ui";

import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useProfileStore } from "../../store/profileStore";
import { useTaskStore } from "../../store/taskStore";
import { openTaskInSidePanel } from "../task/useOpenTask";

/**
 * Layout redesign (F5): the person card's foot. For an agent, what it is
 * doing now — its task in progress ("Working on Task #1 in #channel ›", opens
 * the task) — then Message (an agent's DM) and View details (the profile).
 */
export default function ProfileCardFooter({ type, id }: { type: "agent" | "human"; id: string }) {
  const { formatMessage } = useIntl();
  const nav = useAppNavigate();
  const openProfile = useProfileStore((s) => s.openProfile);
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
  const messageAgent = useCallback(() => nav.toAgent(id), [id, nav]);
  const viewDetails = useCallback(() => openProfile(type, id), [id, openProfile, type]);
  return (
    <div className="flex flex-col gap-2 border-t border-line-hairline px-4 py-3" data-testid="profile-card-footer">
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
      <div className="flex gap-2">
        {type === "agent" ? (
          <Button type="button" size="md" variant="outline" className="flex-1" onClick={messageAgent} data-testid="profile-card-message">
            {formatMessage({ id: "profileCard.message" })}
          </Button>
        ) : null}
        <Button type="button" size="md" variant="accent" className="flex-1" onClick={viewDetails} data-testid="profile-card-details">
          {formatMessage({ id: "profileCard.viewDetails" })}
        </Button>
      </div>
    </div>
  );
}
