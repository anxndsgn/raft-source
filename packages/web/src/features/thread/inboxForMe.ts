import { useEffect, useMemo, useState } from "react";

import api from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { useServerStore } from "../../store/serverStore";
import { useTaskStore } from "../../store/taskStore";
import { forMeTasks, openQuestions, useForMeStore } from "./forMeStore";
import { useVisibleNotifications } from "../../components/layout/useSystemNotifications";
import type { NotificationEntry } from "../../components/layout/useSystemNotifications";

/** Layout redesign (F4): a system notice someone must act on (a computer offline stops agents) is "for me"; one that only tells goes on top of All. */
export function isActionableNotice(entry: NotificationEntry): boolean {
  return entry.kind === "error" || entry.kind === "warning" || entry.security === true;
}

/**
 * What the inbox's "For me" holds, counted: one per item (task #10 item 7) — each conversation with replies to me
 * or @s still waiting (the unread_mentions read, less what was handled there), each open question asked of me,
 * each task assigned to me or waiting for my review, each system notice to act on. The rail's inbox badge and
 * the For me tab show this one number.
 */
export function useInboxForMeCount(): number {
  const serverId = useServerStore((s) => s.current?.id ?? null);
  const activityCount = useServerStore((s) => (serverId ? s.serverUnreadCounts[serverId]?.activityUnreadCount ?? 0 : 0));
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const serverTasks = useTaskStore((s) => s.serverTasks);
  const tasksLoaded = useTaskStore((s) => s.serverTasksLoaded);
  const loadServerTasks = useTaskStore((s) => s.loadServerTasks);
  const notices = useVisibleNotifications("desktop");
  const forMeVersion = useForMeStore((s) => s.version);
  const doneAt = useForMeStore((s) => s.doneAt);
  const questions = useForMeStore((s) => s.questions);
  const [conversations, setConversations] = useState(0);
  useEffect(() => {
    if (!serverId) return;
    let cancelled = false;
    // The conversations waiting, counted by the For me read itself (one row asked for).
    api.get("/channels/inbox", { params: { filter: "unread_mentions", limit: 1, offset: 0 } })
      .then(({ data }) => { if (!cancelled) setConversations(Number((data as { totalCount?: number }).totalCount ?? 0)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [serverId, activityCount, forMeVersion]);
  useEffect(() => {
    // Questions answered or withdrawn elsewhere come and go with activity.
    if (serverId) void useForMeStore.getState().load(serverId);
  }, [serverId, activityCount]);
  useEffect(() => {
    if (serverId && !tasksLoaded) void loadServerTasks();
  }, [serverId, tasksLoaded, loadServerTasks]);
  const tasks = useMemo(() => {
    const { mine, reviews } = forMeTasks(serverTasks, viewerId, doneAt);
    return mine.length + reviews.length;
  }, [doneAt, serverTasks, viewerId]);
  const asked = useMemo(() => openQuestions(questions, doneAt).length, [doneAt, questions]);
  const actionable = notices.filter(isActionableNotice).length;
  return conversations + asked + tasks + actionable;
}
