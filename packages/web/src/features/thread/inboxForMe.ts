import { useEffect, useMemo, useState } from "react";

import api from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { useServerStore } from "../../store/serverStore";
import { useTaskStore } from "../../store/taskStore";
import { useVisibleNotifications } from "../../components/layout/useSystemNotifications";
import type { NotificationEntry } from "../../components/layout/useSystemNotifications";

const OPEN = new Set(["todo", "in_progress", "in_review"]);

/** Layout redesign (F4): a system notice someone must act on (a computer offline stops agents) is "for me"; one that only tells goes on top of All. */
export function isActionableNotice(entry: NotificationEntry): boolean {
  return entry.kind === "error" || entry.kind === "warning" || entry.security === true;
}

/**
 * What the inbox's "For me" holds, counted: unread replies to me and @s, tasks
 * assigned to me and not done, and system notices to act on. The rail's inbox
 * badge and the For me tab show this one number.
 */
export function useInboxForMeCount(): number {
  const serverId = useServerStore((s) => s.current?.id ?? null);
  const activityCount = useServerStore((s) => (serverId ? s.serverUnreadCounts[serverId]?.activityUnreadCount ?? 0 : 0));
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const serverTasks = useTaskStore((s) => s.serverTasks);
  const tasksLoaded = useTaskStore((s) => s.serverTasksLoaded);
  const loadServerTasks = useTaskStore((s) => s.loadServerTasks);
  const notices = useVisibleNotifications("desktop");
  const [mentions, setMentions] = useState(0);
  useEffect(() => {
    if (!serverId) return;
    let cancelled = false;
    // The unread replies and @s, counted by the inbox read itself (one row asked for).
    api.get("/channels/inbox", { params: { filter: "unread_mentions", limit: 1, offset: 0 } })
      .then(({ data }) => { if (!cancelled) setMentions(Number((data as { totalUnreadCount?: number; totalCount?: number }).totalUnreadCount ?? (data as { totalCount?: number }).totalCount ?? 0)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [serverId, activityCount]);
  useEffect(() => {
    if (serverId && !tasksLoaded) void loadServerTasks();
  }, [serverId, tasksLoaded, loadServerTasks]);
  const tasks = useMemo(
    () => serverTasks.filter((t) => t.claimedByType === "user" && t.claimedById === viewerId && OPEN.has(t.status)).length,
    [serverTasks, viewerId],
  );
  const actionable = notices.filter(isActionableNotice).length;
  return mentions + tasks + actionable;
}
