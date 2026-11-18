/**
 * The @botiverse/ricons glyphs drawn with Raft's
 * own icon set (Raft Icons, "Icons 20 · 重绘"); also reaches raft-ui.
 * Wired in scripts/iconAliases.ts. ricons render at 18px by default, so the shims
 * keep that default size. JoinPrivateChannelIcon has no Raft counterpart
 * and falls through to ricons.
 */
import type { SVGProps } from "react";
import { RIcon } from "./raftIcons";
import type { RIconName } from "./raftIcons";

// @ts-expect-error alias to the real package (scripts/iconAliases.ts)
export * from "@botiverse/ricons/real";

function make(name: RIconName, displayName: string) {
  const C = ({ width = 18, height = 18, ...props }: SVGProps<SVGSVGElement>) => <RIcon {...props} name={name} width={width} height={height} />;
  C.displayName = displayName;
  return C;
}

export const MessageIcon = make("message", "MessageIcon");
export const ChatIcon = MessageIcon;
export const DirectMessageIcon = make("direct-message", "DirectMessageIcon");
export const ThreadIcon = make("thread", "ThreadIcon");
export const CommentIcon = make("comment", "CommentIcon");
export const FeedbackIcon = make("feedback", "FeedbackIcon");
export const ArtifactIcon = make("artifact", "ArtifactIcon");
export const AddCommentIcon = make("add-comment", "AddCommentIcon");
export const FollowThreadIcon = make("follow-thread", "FollowThreadIcon");
export const UnfollowThreadIcon = make("unfollow-thread", "UnfollowThreadIcon");
export const FollowArtifactIcon = make("follow-artifact", "FollowArtifactIcon");
export const UnfollowArtifactIcon = make("unfollow-artifact", "UnfollowArtifactIcon");
export const JoinChannelIcon = make("join-channel", "JoinChannelIcon");
export const LeaveChannelIcon = make("leave-channel", "LeaveChannelIcon");
export const JoinJointChannelIcon = make("join-joint-channel", "JoinJointChannelIcon");
export const LeaveJointChannelIcon = make("leave-joint-channel", "LeaveJointChannelIcon");
export const LeavePrivateChannelIcon = make("leave-private-channel", "LeavePrivateChannelIcon");
export const ReopenTaskIcon = make("reopen-task", "ReopenTaskIcon");
