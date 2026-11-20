import { tv } from "../../lib/tv";

// The date line sits a section step (24px) from the text on both sides,
// measured to its rule: its padding gives back the row inset of the row above
// and the lead of the turn below (design/foundations/spacing.md#timeline-rhythm).
// The end fade lies over the list's bottom edge, beside the list in its
// positioned parent: the panel's colour fades to transparent upward over the
// section step, so a message scrolled under the edge softens instead of being
// cut, and over the empty end of the list it shows nothing. At `z-raised`:
// over the list, under the jump controls (`z-float`) and the line of who is
// about to post.
// The notice is a row of its own: a row's lead above it, the row inset under
// it.
export const messageList = tv({
  slots: {
    root: ["relative h-full min-h-0"],
    viewport: ["size-full min-h-0 min-w-0 overscroll-none"],
    content: ["flex min-h-full w-full min-w-0 flex-col"],
    dateDividerRoot: [
      "flex select-none items-center",
      "gap-2 px-4",
      "pt-[calc(var(--spacing-timeline-section)-var(--spacing-timeline-row)-var(--text-mono-meta--line-height)/2)]",
      "pb-[calc(var(--spacing-timeline-section)-var(--spacing-timeline-lead)-var(--text-mono-meta--line-height)/2)]",
    ],
    dateDividerRule: ["flex-1", "min-w-3 border-t border-line-hairline"],
    dateDividerChip: [
      "inline-flex items-center",
      "font-mono text-mono-meta whitespace-nowrap text-foreground-hint",
    ],
    endFade: [
      "pointer-events-none absolute inset-x-0 bottom-0 z-raised",
      "h-timeline-section",
      "bg-linear-to-t from-layer-canvas to-transparent",
    ],
    notice: ["text-center", "pt-timeline-lead pb-timeline-row font-mono text-mono-meta"],
    historyLimited: [
      "inline-flex items-center",
      "h-[22px] gap-1 rounded-chip px-1.5",
      "font-mono text-mono-meta text-foreground-muted",
      "inset-ring inset-ring-line-hairline",
      "[&_svg]:size-3",
    ],
  },
  variants: {
    tone: {
      faint: {
        notice: ["text-foreground-hint"],
      },
      muted: {
        notice: ["text-foreground-muted"],
      },
    },
  },
  defaultVariants: {
    tone: "faint",
  },
});

// The jump controls float over the list, centred, 12px from its edge and 8px
// apart. At the bottom they rise by `--message-list-bottom-inset`, the height
// of what else floats on that edge (the line of who is about to post), so they
// never cover it. The pills are Buttons at `outline md`, from the Button
// recipe, so their type, icon and height can't drift from it. Two that don't
// fit side by side (a phone) stack 12px apart, so their 44px hit areas don't
// overlap, the first one nearest the edge.
export const messageListJump = tv({
  slots: {
    controls: [
      "absolute inset-x-0 z-float mx-auto",
      "flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-center gap-x-2 gap-y-3",
    ],
    group: [
      "inline-flex shrink-0 items-stretch",
      "*:data-[slot=message-list-jump-pill]:rounded-e-none",
      // Raft redesign (Figmama 11/18): on a desktop the group is one pill: one
      // 1px floating line round the whole, the two buttons draw none, and the
      // one under the pointer takes the subtle fill, its half of the pill's
      // round ends with it.
      // No overflow clip: it would cut the 44px hit areas. The parts round
      // their own outer ends instead.
      "md:pointer-fine:rounded-pill md:pointer-fine:border md:pointer-fine:border-line-floating md:pointer-fine:bg-layer-canvas",
      "md:pointer-fine:*:data-[slot=message-list-jump-pill]:h-[27px] md:pointer-fine:*:data-[slot=message-list-jump-pill]:border-0",
      "md:pointer-fine:*:data-[slot=message-list-jump-pill]:bg-transparent md:pointer-fine:*:data-[slot=message-list-jump-pill]:hover:bg-fill-subtle",
    ],
    // Raft redesign (Figma Typing pill, the floating pill): on a desktop a
    // 29px canvas pill with a 1px floating line, no ink edge or shadow.
    pill: [
      "md:pointer-fine:h-[29px] md:pointer-fine:rounded-pill md:pointer-fine:border md:pointer-fine:border-line-floating",
      "md:pointer-fine:bg-layer-canvas md:pointer-fine:shadow-none md:pointer-fine:ring-0 md:pointer-fine:pr-3 md:pointer-fine:pl-2",
      // A 29px pill (27px inside the group) still keeps a 44px hit area.
      "md:pointer-fine:after:-inset-y-[9px]",
    ],
    dismiss: [
      // On a desktop it draws no border of its own (the group's pill does):
      // one 1px floating line before it, 6px short of the top and bottom.
      "md:pointer-fine:h-[27px] md:pointer-fine:w-[29px] md:pointer-fine:rounded-e-pill md:pointer-fine:border-0",
      "md:pointer-fine:bg-transparent md:pointer-fine:hover:bg-fill-subtle md:pointer-fine:shadow-none md:pointer-fine:ring-0",
      "md:pointer-fine:before:absolute md:pointer-fine:before:inset-y-1.5 md:pointer-fine:before:left-0 md:pointer-fine:before:w-px md:pointer-fine:before:bg-line-floating md:pointer-fine:before:content-['']",
      "rounded-s-none border-s-0",
      "text-foreground-muted hover:text-foreground",
      "[&_svg:not([class*='size-'])]:size-4",
      "after:-inset-y-[calc(--spacing(1.5)+1.5px)] after:right-[calc(-0.75rem-1.5px)] after:left-0",
      // Desktop with a mouse: 34px controls, so 5px reaches 44.
      // The redesign's 27px dismiss reaches 9px up and down, 17px past its end.
      "md:pointer-fine:after:-inset-y-[9px]",
      "md:pointer-fine:after:-right-[17px] md:pointer-fine:after:left-0",
    ],
  },
  variants: {
    side: {
      bottom: {
        controls: [
          "bottom-[calc(--spacing(3)+var(--message-list-bottom-inset,0px))]",
          "flex-wrap-reverse",
        ],
      },
      top: { controls: ["top-3"] },
    },
  },
  defaultVariants: {
    side: "bottom",
  },
});
