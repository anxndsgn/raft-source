/**
 * Reply mode (`channels.reply_mode`): a channel without new threads. Every
 * message is on one timeline; a message may reply to one earlier message of
 * the same timeline (`messages.reply_to_message_id`) and be linked to any
 * number of tasks (`message_tasks`). Agent wakes follow replies, @mentions
 * and task followers instead of the whole channel (see the server's
 * replyModeRouting). Old threads stay readable but take no new messages.
 */

/** The channel types that may turn reply mode on: public and private regular channels. */
export function channelTypeSupportsReplyMode(type: string | null | undefined): boolean {
  return type === "channel" || type === "private";
}

/** The channel field on the wire: absent from an older server means off. */
export interface ChannelReplyModeFields {
  replyMode?: boolean;
}

/** Reply-chain participants count only from the latest this many messages of the chain. */
export const REPLY_CHAIN_PARTICIPANT_WINDOW = 20;

/**
 * Loop guard: once a reply chain has more than this many agent messages since
 * the latest human message in it, new agent messages in the chain wake no agent.
 */
export const REPLY_CHAIN_AGENT_LOOP_LIMIT = 20;

/** Longest excerpt of the original shown above a reply, in characters. */
export const REPLY_EXCERPT_MAX_CHARS = 80;

/** The original a reply points at, as carried on a message for display. */
export interface MessageReplyToView {
  messageId: string;
  /** Null when the original is gone (deleted or retracted). */
  senderName: string | null;
  senderType: "user" | "agent" | "external_projection" | null;
  /** First line of the original, at most REPLY_EXCERPT_MAX_CHARS; empty when deleted. */
  excerpt: string;
  deleted: boolean;
  /** Seq of the original in its conversation (for jump-to); null when deleted. */
  seq: number | null;
}

/** First non-empty line of `content`, trimmed to `max` characters with an ellipsis. */
export function replyExcerpt(content: string, max: number = REPLY_EXCERPT_MAX_CHARS): string {
  const line = content.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const chars = Array.from(line);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : line;
}

/**
 * A short provisional task title from a message's text: its first sentence
 * (or first line), at most `max` characters. The agent is told to replace it.
 */
export function provisionalTaskTitle(content: string, max = 60): string {
  const line = replyExcerpt(content, 10_000);
  const sentenceEnd = line.search(/[。！？!?]|\.(\s|$)/);
  const sentence = sentenceEnd > 0 ? line.slice(0, sentenceEnd + 1) : line;
  const chars = Array.from(sentence.replace(/[。.]$/, ""));
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : chars.join("");
}
