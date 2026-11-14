import { create } from "zustand";

/**
 * Reply mode: the message a composer is replying to, per conversation
 * (channel id). Set from a message's "Reply" action, shown as the bar above
 * the composer, sent as `replyToMessageId`, cleared once the reply is sent or
 * the bar is dismissed.
 */
export interface ReplyTarget {
  messageId: string;
  senderName: string;
  excerpt: string;
}

interface ReplyTargetState {
  targets: Record<string, ReplyTarget>;
  setReplyTarget: (channelId: string, target: ReplyTarget) => void;
  clearReplyTarget: (channelId: string) => void;
}

export const useReplyTargetStore = create<ReplyTargetState>((set) => ({
  targets: {},
  setReplyTarget: (channelId, target) => set((state) => ({ targets: { ...state.targets, [channelId]: target } })),
  clearReplyTarget: (channelId) => set((state) => {
    if (!(channelId in state.targets)) return state;
    const { [channelId]: _removed, ...rest } = state.targets;
    return { targets: rest };
  }),
}));

/** Window event a composer listens to: focus it after "Reply" was chosen. */
export const REPLY_TARGET_FOCUS_EVENT = "raft:reply-target-focus";
