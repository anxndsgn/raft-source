import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import Tooltip from "../../components/ui/Tooltip";

/**
 * A channel's name in its head: it opens the channel's info and settings, as in other chat apps (raft-design
 * channel.md), and reads as a button: a chevron, a fill on hover (Figmama 11/15). On a desktop the channel's glyph is
 * inside it, so the hover fill covers "# name ⌄" as one block: 32 high, 6px each side, fill-subtle (Raft redesign,
 * anxndsgn 11/18).
 */
export function ChannelHeadTitleButton({ name, icon, label, open, onOpen }: {
  name: string;
  /** The channel's glyph, given on a desktop; on a phone it stays the head's own icon. */
  icon?: ReactNode;
  label: string;
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onOpen}
        className={icon
          ? "flex h-8 shrink-0 items-center gap-0.5 rounded-control px-1.5 text-left outline-none hover:bg-fill-subtle focus-visible:shadow-focus [&>svg:first-child]:size-5"
          : "flex shrink-0 items-center gap-1 rounded-control px-1 -mx-1 text-left outline-none hover:bg-fill-medium focus-visible:shadow-focus"}
        aria-expanded={open}
        data-testid="channel-header-title-button"
      >
        {icon}
        <span className="whitespace-nowrap">{name}</span>
        <ChevronDown size={14} aria-hidden className={`shrink-0 text-foreground-hint${icon ? " ml-0.5" : ""}`} />
      </button>
    </Tooltip>
  );
}
