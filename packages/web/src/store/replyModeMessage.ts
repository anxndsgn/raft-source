import type { MessageReplyToView } from "@botiverse/raft-shared";

import { useReplyTargetStore } from "./replyTargetStore";
import { timelineViewComposerTaskNumber } from "./timelineViewStore";

/** Reply mode: what a message carries about replies and task links (shared/replyMode.ts). */
export interface ReplyModeMessageFields {
  /** The message this one replies to (same conversation), and its display facts. */
  replyToMessageId?: string | null;
  replyTo?: MessageReplyToView | null;
  /** How many messages reply to this one. */
  directReplyCount?: number;
  /** Numbers of the tasks this message is linked to (not shown on the timeline). */
  linkedTaskNumbers?: number[];
  /** Whether this message's channel uses replies instead of threads. */
  inReplyModeChannel?: boolean;
}

/**
 * Reply mode, on send: the composer's reply target (replyTargetStore) and, in
 * a task view, the view's task. `fields` go on the POST; `done()` clears the
 * reply target once sent (unless another was picked meanwhile).
 */
export function replyModeSendFields(channelId: string): { fields: { replyToMessageId?: string; taskNumbers?: number[]; excludeTaskNumbers?: number[] }; done: () => void } {
  const replyTarget = useReplyTargetStore.getState().targets[channelId];
  const viewTaskNumber = timelineViewComposerTaskNumber(channelId);
  return {
    fields: {
      ...(replyTarget ? { replyToMessageId: replyTarget.messageId } : {}),
      ...(replyTarget?.excludedTaskNumbers?.length ? { excludeTaskNumbers: replyTarget.excludedTaskNumbers } : {}),
      ...(viewTaskNumber ? { taskNumbers: [viewTaskNumber] } : {}),
    },
    done: () => {
      if (replyTarget && useReplyTargetStore.getState().targets[channelId]?.messageId === replyTarget.messageId) {
        useReplyTargetStore.getState().clearReplyTarget(channelId);
      }
    },
  };
}

type ReplyCountMessage = ReplyModeMessageFields & { id: string; channelId: string; randomId?: string | null };

/**
 * A reply seen for the first time adds one to its original's "N replies" (the
 * server counts them on the next read). `update` is the store's updateMessage.
 */
export function bumpOriginalReplyCount<M extends ReplyCountMessage>(
  message: M,
  loaded: readonly M[],
  update: (patch: { id: string; channelId: string; directReplyCount: number }) => void,
): void {
  if (!message.replyToMessageId) return;
  const known = loaded.find((m) => m.id === message.id || (!!message.randomId && m.randomId === message.randomId));
  if (known?.replyToMessageId) return;
  const original = loaded.find((m) => m.id === message.replyToMessageId);
  if (!original) return;
  queueMicrotask(() => update({ id: original.id, channelId: original.channelId, directReplyCount: (original.directReplyCount ?? 0) + 1 }));
}
