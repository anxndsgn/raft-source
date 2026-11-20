/**
 * Inline thread replies (task #47, artin-directed) — the "Feishu, no card" form.
 *
 * Replies render BELOW the message's chip area as one muted preview surface.
 * Up to three human/agent previews stack under the `N replies` label. The whole
 * surface is one button — not only the count — so a user can click any preview
 * row to open the thread (artin, task #594). System events do not consume a
 * preview slot, and a system-only history has no inline conversation affordance;
 * those events remain available inside the full Thread.
 *
 * Avatars go through `AvatarSlot context="compact-list"` per sender type —
 * rendering every sender with the agent sprite left humans (and agents with
 * null avatarUrl) as identical fallback blocks, which artin flagged.
 *
 * Rendering is memoized per message: a reply arriving in one thread must not
 * re-render the timeline (#4434 class). This component takes only plain data +
 * a stable callback so it can sit inside a memoized MessageItem without
 * punching through it.
 */
import { memo, useMemo } from "react";
import { useIntl } from "react-intl";
import { Pencil } from "lucide-react";
import {
  getMessagePreviewSizeClass,
  getMessagePreviewTimeSizeClass,
  useAppearanceStore,
} from "../../store/appearanceStore";
import {
  MessageReplies,
  MessageRepliesItem,
  MessageRepliesItemContent,
  MessageRepliesItemSender,
  MessageRepliesItemTime,
  MessageRepliesSummary,
} from "@botiverse/raft-ui";
import AvatarSlot from "../ui/AvatarSlot";
import { useAgentStore } from "../../store/agentStore";
import type { Agent } from "../../store/agentStore";
import { useAuthStore } from "../../store/authStore";
import { useServerStore } from "../../store/serverStore";
import type { ServerMember } from "../../store/serverStore";
import type { ThreadReplyPreview } from "../../store/threadRepliesReadModel";
import { resolveMessageSenderMember } from "../../utils/messageSenderMember";
import { useTimeFormatter } from "../../hooks/useTimeFormatter";
import { useMediaQuery } from "../../hooks/effectPrimitives";

const MAX_INLINE_PREVIEWS = 3;
// B6, desktop: the replies row; it hugs its content, 4 in, the control radius.
const REPLIES_ROW_CLASS = "mt-1 mb-px h-6 w-fit max-w-full flex-row items-center gap-1.5 -ml-1 rounded-control px-1 py-0 md:pointer-fine:bg-transparent md:pointer-fine:hover:bg-fill-subtle md:pointer-fine:hover:bg-none md:pointer-fine:active:bg-none [&_strong]:h-auto [&_strong]:min-w-0 [&_strong]:bg-transparent [&_strong]:px-0 [&_strong]:font-sans [&_strong]:text-[12px] [&_strong]:text-danger-strong [&_strong]:inset-ring-0 [&_strong]:ring-0";
const REPLIER_AVATAR_CLASS = "-ml-1 flex size-4 overflow-hidden rounded-full ring-1 ring-layer-canvas first:ml-0 *:size-4! *:rounded-full!";

export function hasInlineThreadReplySurface(
  replies: ThreadReplyPreview[],
  replyCount: number,
): boolean {
  return replyCount > 0 && replies.some((reply) => reply.senderType !== "system");
}

export interface InlineThreadRepliesProps {
  replies: ThreadReplyPreview[];
  replyCount: number;
  unreadCount: number;
  hasDraft: boolean;
  onOpenThread: () => void;
  channelParticipantAgentsById?: ReadonlyMap<string, Agent>;
  channelParticipantMembersById?: ReadonlyMap<string, ServerMember>;
}

function ReplyAvatar({
  reply,
  channelParticipantAgentsById,
  channelParticipantMembersById,
}: {
  reply: ThreadReplyPreview;
  channelParticipantAgentsById?: ReadonlyMap<string, Agent>;
  channelParticipantMembersById?: ReadonlyMap<string, ServerMember>;
}) {
  // Keep identity subscriptions inside the individual avatar. The parent
  // message row remains memoized per thread scope, while an avatar still reacts
  // when this exact member/agent profile is hydrated or updated.
  const agent = useAgentStore((state) =>
    reply.senderType === "agent"
      ? state.agents.find((candidate) => candidate.id === reply.senderId)
      : undefined
  );
  const cachedMember = useServerStore((state) =>
    reply.senderType === "user"
      ? state.members.find((candidate) => candidate.userId === reply.senderId)
      : undefined
  );
  const currentUserServerRole = useServerStore((state) => state.current?.role);
  const currentUser = useAuthStore((state) => state.user);
  const channelParticipantAgent = channelParticipantAgentsById?.get(reply.senderId);
  const channelParticipantMember = channelParticipantMembersById?.get(reply.senderId);
  const member = useMemo(() => {
    if (reply.senderType !== "user") return undefined;
    const authoritativeMember = channelParticipantMember ?? cachedMember;
    const memberById = authoritativeMember
      ? new Map<string, ServerMember>([[authoritativeMember.userId, authoritativeMember]])
      : new Map<string, ServerMember>();
    return resolveMessageSenderMember(
      { senderType: "user", senderId: reply.senderId },
      memberById,
      currentUser,
      currentUserServerRole,
    );
  }, [cachedMember, channelParticipantMember, currentUser, currentUserServerRole, reply.senderId, reply.senderType]);

  if (reply.senderType === "system") return null;
  if (reply.senderType === "agent") {
    return (
      <AvatarSlot
        context="compact-list"
        type="agent"
        agentAvatarUrl={agent?.avatarUrl ?? channelParticipantAgent?.avatarUrl ?? reply.senderAvatarUrl}
      />
    );
  }
  if (reply.senderType === "external_projection") {
    return (
      <AvatarSlot
        context="compact-list"
        type="app"
        appAvatarUrl={reply.senderAvatarUrl}
        appInitials={reply.senderDisplayName || reply.senderName}
      />
    );
  }
  return (
    <AvatarSlot
      context="compact-list"
      type="human"
      humanAvatarUrl={member?.avatarUrl ?? reply.senderAvatarUrl}
    />
  );
}

export const InlineThreadReplies = memo(function InlineThreadReplies({
  replies,
  replyCount,
  unreadCount,
  hasDraft,
  onOpenThread,
  channelParticipantAgentsById,
  channelParticipantMembersById,
}: InlineThreadRepliesProps) {
  const { formatMessage } = useIntl();
  const { formatMessageTime } = useTimeFormatter();
  const messageBodyFontSize = useAppearanceStore((s) => s.messageBodyFontSize);
  const previewSizeClass = getMessagePreviewSizeClass(messageBodyFontSize);
  const previewTimeSizeClass = getMessagePreviewTimeSizeClass(messageBodyFontSize);
  // Raft redesign (B6): with a mouse the replies are one 24px row, not a block of previews.
  const row = useMediaQuery("(width >= 48rem) and (pointer: fine)");
  if (!hasInlineThreadReplySurface(replies, replyCount)) return null;

  // The server may serve more than we show (or fewer, on an older payload);
  // the display cap is ours, not the transport's.
  const previews = replies
    .filter((reply) => reply.senderType !== "system")
    .slice(0, MAX_INLINE_PREVIEWS);
  // The header is always the thread's authoritative total. Preview truncation
  // is only a presentation detail and must not change the count's meaning.
  const countText = formatMessage(
    { id: "message.inlineThreadReplies.replyCount" },
    { count: replyCount },
  );
  // Raft DS › Message `rf-replies__sum`: "N replies" in ink-2, ink while
  // there are new replies, which follow as the pink count sticker (the
  // recipe draws the `strong`); the sticker reads as "N new".
  const countLabel = (
    <MessageRepliesSummary
      data-message-affordance="inline-thread-replies-count"
      className={row ? "shrink-0 text-[13px] leading-[17px] font-semibold text-foreground" : unreadCount > 0 ? "shrink-0 text-foreground" : "shrink-0 text-foreground-muted"}
    >
      {countText}
      {unreadCount > 0 ? (
        <strong
          role="img"
          aria-label={formatMessage({ id: "message.inlineThreadReplies.newReplyCount" }, { count: unreadCount })}
          data-message-affordance="inline-thread-replies-new-count"
        >
          {unreadCount}
        </strong>
      ) : null}
      {hasDraft ? (
        <>
          {" · "}
          <Pencil
            aria-hidden="true"
            size={12}
            data-message-affordance="inline-thread-replies-draft-icon"
            className="mx-0.5 inline-block align-[-2px]"
          />
          {formatMessage({ id: "message.inlineThreadReplies.draft" })}
        </>
      ) : null}
    </MessageRepliesSummary>
  );

  if (row) {
    // B6: who replied (three at most, 16 round, overlapping 4 on a canvas ring), "N replies" Semi Bold
    // 13 ink, then when the last reply came, regular 12 muted, 6 apart; the whole row hovers fill-subtle.
    const repliers = previews.filter((reply, index) => previews.findIndex((other) => other.senderId === reply.senderId) === index).slice(0, 3);
    const latest = previews.reduce<ThreadReplyPreview | null>((last, reply) => (!last || reply.createdAt > last.createdAt ? reply : last), null);
    return (
      <MessageReplies
        onClick={onOpenThread}
        data-message-affordance="inline-thread-replies"
        data-layout="row"
        className={REPLIES_ROW_CLASS}
      >
        {repliers.length > 0 ? (
          <span className="flex shrink-0 items-center" aria-hidden="true">
            {repliers.map((reply) => (
              <span key={reply.messageId} className={REPLIER_AVATAR_CLASS}>
                <ReplyAvatar
                  reply={reply}
                  channelParticipantAgentsById={channelParticipantAgentsById}
                  channelParticipantMembersById={channelParticipantMembersById}
                />
              </span>
            ))}
          </span>
        ) : null}
        {countLabel}
        {latest ? (
          <MessageRepliesItemTime dateTime={latest.createdAt} data-inline-thread-reply-time className="ml-0 text-[12px] leading-4 font-sans text-foreground-muted">
            {formatMessageTime(latest.createdAt)}
          </MessageRepliesItemTime>
        ) : null}
      </MessageReplies>
    );
  }

  return (
    <MessageReplies
      onClick={onOpenThread}
      data-message-affordance="inline-thread-replies"
      // mb-px: the card frame's bottom sits one pixel above the text baseline
      // that the 24 rhythm is measured from; Josh's measure of the followed
      // case reads 23 without it. The DS replies block (fill-muted, 13/18,
      // a content card's width, 560 max) is the recipe's.
      className="mb-px"
    >
      {countLabel}
      {previews.map((reply) => {
        return (
          <MessageRepliesItem
            key={reply.messageId}
            data-inline-thread-reply-row
            className="w-full max-w-full"
          >
            <span className="shrink-0">
              <ReplyAvatar
                reply={reply}
                channelParticipantAgentsById={channelParticipantAgentsById}
                channelParticipantMembersById={channelParticipantMembersById}
              />
            </span>
            {/* The clock remains fixed, so the sender must be allowed to give
                width back on narrow panes; otherwise its intrinsic width can
                push the entire row past the preview surface. */}
            <MessageRepliesItemSender className={previewSizeClass}>
              {reply.senderDisplayName || reply.senderName}
            </MessageRepliesItemSender>
            <MessageRepliesItemContent className={previewSizeClass}>
              {reply.preview}
            </MessageRepliesItemContent>
            <MessageRepliesItemTime
              dateTime={reply.createdAt}
              data-inline-thread-reply-time
              className={`ml-auto shrink-0 ${previewTimeSizeClass}`}
            >
              {formatMessageTime(reply.createdAt)}
            </MessageRepliesItemTime>
          </MessageRepliesItem>
        );
      })}
    </MessageReplies>
  );
});
