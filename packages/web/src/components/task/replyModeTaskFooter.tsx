import { findStoredChannel } from "../../store/storedChannel";
import { lazy, Suspense } from "react";

import { useChannelStore } from "../../store/channelStore";
import type { Task } from "../../store/taskStore";
import { isTaskV2Task } from "../../utils/taskConversation";

const TaskLinkedMessagesBar = lazy(() => import("./TaskLinkedMessagesBar").then((m) => ({ default: m.TaskLinkedMessagesBar })));

/**
 * Reply mode: the task dialog's foot. The task's discussion is its linked messages on the channel's timeline; the
 * old task thread is read-only, and the dialog leads there instead (TaskLinkedMessagesBar).
 */
export function useReplyModeTaskFooter(hostTask: Task | null | undefined, onNavigate: () => void, taskV2: boolean) {
  const hostReplyMode = useChannelStore((s) => (hostTask ? findStoredChannel(s, hostTask.channelId)?.replyMode === true : false));
  const replyModeFooter = hostTask && hostReplyMode && !isTaskV2Task(hostTask)
    ? <Suspense fallback={null}><TaskLinkedMessagesBar task={hostTask} onNavigate={onNavigate} /></Suspense>
    : undefined;
  const replyModeEmpty = replyModeFooter ? <div className="flex-1" /> : undefined;
  // The old "View in thread": not in reply mode (its threads are read-only), nor for a task v2 or legacy one.
  const canViewInThread = !taskV2 && !hostReplyMode && !!hostTask && !hostTask.isLegacy && !isTaskV2Task(hostTask) && hostTask.channelType !== "thread";
  return { canViewInThread, replyModeFooter, replyModeEmpty };
}
