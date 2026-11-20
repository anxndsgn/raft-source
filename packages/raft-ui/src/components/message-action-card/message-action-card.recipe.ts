import { tv } from "../../lib/tv";

export const messageActionCard = tv({
  slots: {
    // The width is an item card's (MessageEmbed size="item").
    root: ["group/action-card mt-2"],
    // Top-aligned: a title can wrap, and a folded card carries a description
    // line under it, so the icon, status and toggle line up with the title's
    // first line instead of floating between lines.
    // The card's inset and the card title's type come from messageCard; the
    // header keeps 8px under it while the card is open.
    header: ["flex items-start", "gap-2 pb-2 group-data-closed/action-card:pb-3"],
    headerIcon: [
      "flex shrink-0 items-center justify-center",
      "[&>svg]:shrink-0",
      "size-[27px] rounded-chip bg-fill-muted text-foreground-muted",
      "[&>svg]:size-3.5",
      // Raft redesign (B7): with a mouse the card's icon is a plain 16 muted glyph, no tile.
      "md:pointer-fine:size-5 md:pointer-fine:bg-transparent md:pointer-fine:[&>svg]:size-4",
    ],
    headerTitle: ["min-w-0 flex-1", "pt-[calc((27px-1lh)/2)]", "md:pointer-fine:pt-[calc((20px-1lh)/2)]"],
    // What happened (Done, Declined) or why you cannot act (View only), shown
    // under the title so it stays visible while the card is folded.
    headerDescription: ["block", "mt-0.5 text-footnote font-normal text-foreground-muted"],
    // The time a resolved card records, a note in Space Mono at the hint
    // tier: its own line under the title, or the end of the description's
    // line when placed inside it ("Approved by Martin · 10:51").
    headerMeta: [
      "block in-data-[slot=message-action-card-header-description]:inline",
      "mt-0.5 in-data-[slot=message-action-card-header-description]:mt-0",
      "font-mono text-mono-meta font-normal tabular-nums text-foreground-hint",
    ],
    headerStatus: [
      "ml-auto shrink-0",
      "mt-[calc((27px-1lh)/2)] text-caption font-semibold text-foreground-muted",
      "md:pointer-fine:mt-[calc((20px-1lh)/2)]",
    ],
    status: [
      "inline-flex h-auto items-center gap-1.5 rounded-none border-0 bg-transparent p-0 shadow-none",
      "text-caption font-semibold text-foreground-muted",
      "before:size-2.5 before:shrink-0 before:rounded-[2px] before:border-[1.5px] before:border-sticker-ink before:content-['']",
      // B7: with a mouse the status is the 8px square of the task bar, no edge.
      "md:pointer-fine:before:size-2 md:pointer-fine:before:rounded-none md:pointer-fine:before:border-0",
    ],
    collapseTrigger: [
      "flex shrink-0 cursor-pointer items-center justify-center",
      "[&>svg]:transition-transform [&>svg]:duration-200 motion-reduce:[&>svg]:transition-none",
      "data-panel-open:[&>svg]:rotate-180",
      "focus-visible:keyboard:outline-2 focus-visible:keyboard:outline-offset-1",
      "my-0 -mr-1 size-[27px] rounded-chip text-foreground-muted",
      "md:pointer-fine:size-6 md:pointer-fine:rounded-control md:pointer-fine:hover:bg-fill-subtle",
      "hover:bg-fill-medium hover:text-foreground active:bg-fill-medium",
      "focus-visible:outline-none focus-visible:shadow-focus",
      "[&>svg]:size-4",
    ],
  },
  variants: {
    tone: {
      neutral: { status: ["before:bg-inactive", "md:pointer-fine:before:bg-foreground-hint"] },
      primary: { status: ["before:bg-presence-busy"] },
      information: { status: ["before:bg-info"] },
      accent: { status: ["before:bg-attention"] },
      success: { status: ["before:bg-success"] },
      warning: { status: ["before:bg-warning"] },
      danger: { status: ["before:bg-danger"] },
    },
  },
});

export type MessageActionCardStatusTone =
  | "neutral"
  | "primary"
  | "information"
  | "accent"
  | "success"
  | "warning"
  | "danger";
