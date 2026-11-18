import { LeaveChannelIcon, LeaveJointChannelIcon, LeavePrivateChannelIcon } from "@botiverse/ricons";
import type { ReactNode } from "react";
import { RIcon } from "../../icons/raftIcons";
import { useIntl } from "react-intl";
import type { Channel } from "../../store/channelStore";
import { useServerStore } from "../../store/serverStore";
import { useStoredChannel } from "../../store/useStoredChannel";
import { channelKindIconProps } from "./channelKind";
import type { ChannelKindSource } from "./channelKind";

export const CHANNEL_KIND_ICON_SIZE = 14;

/**
 * A channel's kind icon on any surface. Pass the channel when the surface has
 * it; else its id, looked up in the current server's channels; `type` is the
 * fallback for a channel that isn't loaded (another server's, or not in the
 * store yet), drawn from its type alone. The public page is the current
 * server's unless `serverPublicPageLive` is given.
 */
export function ChannelIcon({
  channel,
  channelId,
  type = "channel",
  serverPublicPageLive,
  size = CHANNEL_KIND_ICON_SIZE,
  className,
}: {
  channel?: ChannelKindSource | null;
  channelId?: string | null;
  type?: Channel["type"];
  serverPublicPageLive?: boolean;
  size?: number;
  className?: string;
}) {
  const stored = useStoredChannel(channel ? null : channelId);
  const currentPublicPageLive = useServerStore((s) => s.current?.publicPageLive === true);
  const source = channel ?? stored;
  if (!source) return <ChannelKindIcon type={type} size={size} className={className} />;
  // A partial row without its type (an optimistic or cached one) keeps the caller's.
  const withType = source.type ? source : { ...source, type };
  return <ChannelKindIcon {...channelKindIconProps(withType, serverPublicPageLive ?? currentPublicPageLive)} size={size} className={className} />;
}

export function ChannelKindIcon({
  type,
  size = CHANNEL_KIND_ICON_SIZE,
  className,
  onPublicPage = false,
  external = false,
}: {
  type: Channel["type"];
  size?: number;
  className?: string;
  /** Anyone can read this channel on the server's public page (server public
   *  and channel visible to Guests): the # carries a small globe, the same
   *  mark as Public access in settings (cindyz, #wg-rbac:cbca4ee7). */
  onPublicPage?: boolean;
  /** It has a guest, a guest server or an open invite (Q12 A: the sidebar's
   *  External section, isSidebarExternalSectionChannel): the lock + arrow out,
   *  for a public, private or joint channel alike. Without it a joint channel
   *  keeps the branch. Surfaces don't set it by hand: channelKindIconProps /
   *  ChannelIcon choose it from the channel. */
  external?: boolean;
}) {
  if (external && (type === "channel" || type === "private" || type === "joint")) return <ExternalChannelGlyph size={size} className={className} />;
  if (type === "private") return <KindGlyph name="lock" size={size} className={className} />;
  if (type === "channel" && onPublicPage) return <PublicChannelGlyph size={size} className={className} />;
  if (type === "joint") return <KindGlyph name="git-branch" size={size} className={className} />;
  if (type === "channel") return <KindGlyph name="hash" size={size} className={className} />;
  return null;
}

/**
 * The #, lock and branch of a channel's kind in Raft's own icons (Raft
 * redesign); it keeps lucide's classes, which tests and styles select.
 */
function KindGlyph({ name, size, className }: { name: "hash" | "lock" | "git-branch"; size: number; className?: string }) {
  return <RIcon name={name} width={size} height={size} className={`lucide lucide-${name}${className ? ` ${className}` : ""}`} />;
}

/**
 * An external channel: one with Guests, guest servers or pending external
 * invites (cindyz 10-30, #wg-rbac:0829b5df, option A right; Q12 A): a lock
 * with an arrow pointing out of its bottom-right corner, Raft's own
 * lock-external. One glyph, one variant: external channels are always private.
 */
export function ExternalChannelIcon({ size = CHANNEL_KIND_ICON_SIZE, className }: { size?: number; className?: string }) {
  return <RIcon name="lock-external" width={size} height={size} className={`lucide lucide-external-channel${className ? ` ${className}` : ""}`} />;
}

/** The external glyph with its meaning as text, like the # + globe (one glyph, a native tooltip, a screen-reader phrase). */
function ExternalChannelGlyph({ size, className }: { size: number; className?: string }) {
  const { formatMessage } = useIntl();
  return (
    <MeaningfulGlyph label={formatMessage({ id: "channel.externalMembers" })}>
      <ExternalChannelIcon size={size} className={className} />
    </MeaningfulGlyph>
  );
}

/**
 * Leave, drawn on the channel's own kind glyph with a minus (raft-ui action
 * icons): # for a public channel, the lock for a private one, the branch for
 * a joint one. Icon audit v7: one meaning, one icon, so Leave is not LogOut
 * (that is signing out of Raft).
 */
export function LeaveChannelKindIcon({
  type,
  size,
  className,
}: {
  type: Channel["type"] | undefined;
  size: number;
  className?: string;
}) {
  const Icon = type === "private" ? LeavePrivateChannelIcon : type === "joint" ? LeaveJointChannelIcon : LeaveChannelIcon;
  return <Icon width={size} height={size} className={className} />;
}

/**
 * The glyph carries meaning, so screen readers get it as text and pointer
 * users as a native tooltip (cindyz: "顺手加一下"), like the server-name globe.
 */
function PublicChannelGlyph({ size, className }: { size: number; className?: string }) {
  const { formatMessage } = useIntl();
  return (
    <MeaningfulGlyph label={formatMessage({ id: "channel.publicPageReadable" })}>
      <HashGlobeIcon size={size} className={className} />
    </MeaningfulGlyph>
  );
}

/** A glyph that carries meaning: the label as a native tooltip and as text for screen readers. */
function MeaningfulGlyph({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center" title={label}>
      {children}
      {/* The comma keeps it a separate phrase before the channel name. */}
      <span className="sr-only">{`${label}, `}</span>
    </span>
  );
}

/**
 * One glyph, not two stacked icons (cindyz): a # with its bottom-right cell
 * given over to a globe, Raft's own hash-globe, its body as large as the
 * plain #, so the two align in a list.
 */
function HashGlobeIcon({ size, className }: { size: number; className?: string }) {
  return <RIcon name="hash-globe" width={size} height={size} className={className} data-on-public-page="" />;
}
