import { tv } from "../../lib/tv";
import { barButtonDesktop } from "../../lib/head-edges";

export const composer = tv({
  slots: {
    root: [
      "flex w-full flex-col gap-2 p-2",
      "rounded-container border-[1.5px] px-3 pt-3 pb-[calc(var(--control-embedded-inset)-1px)]",
      "border-line-field bg-layer-card text-foreground shadow-none",
      "has-focus-visible:shadow-focus",
      // Raft redesign (Figma Composer): on a desktop the canvas with a 1px
      // hairline, 10px top and bottom, 12px sides, 10px between its rows.
      "md:pointer-fine:gap-2.5 md:pointer-fine:border md:pointer-fine:border-line-hairline md:pointer-fine:bg-layer-canvas",
      "md:pointer-fine:px-3 md:pointer-fine:py-2.5",
    ],
    inputFrame: ["w-full min-w-0", "[--r-scroll-area-resize-grip-size:0px]"],
    input: [
      "max-h-32 w-full resize-none bg-transparent outline-none",
      "field-sizing-content",
      "min-h-6 px-0.5",
      // The DS composer input is `text-body` regular wherever it is hosted:
      // it states its weight rather than inheriting one (a thread footer's
      // caption type at 500 made its text and placeholder medium).
      "font-sans text-body font-normal text-foreground",
      "placeholder:text-foreground-hint",
    ],
    toolbar: [
      "flex items-center justify-between",
      "mx-[calc(var(--control-embedded-inset)-0.75rem-1px)] gap-embedded-inset",
      "md:pointer-fine:mx-[calc((var(--control-icon-size)-var(--bar-button-size))/2)]",
    ],
    actions: ["flex items-center gap-embedded-inset"],
    meta: ["flex items-center", "gap-embedded-inset"],
    iconButton: [
      "size-8 rounded-chip text-foreground-muted",
      barButtonDesktop,
      "disabled:border-transparent disabled:bg-transparent",
      "aria-disabled:border-transparent aria-disabled:bg-transparent",
      "[&_svg:not([class*='size-'])]:size-4.5",
      // Raft redesign: 20px icons on a desktop, the grid they are drawn on.
      "md:pointer-fine:[&_svg:not([class*='size-'])]:size-5",
    ],
    submit: [
      "rounded-chip",
      // Raft redesign (Figmama 11/18): the send button is an ink square; with
      // nothing to send it is the 5% fill with a muted icon, not faded.
      "md:pointer-fine:disabled:bg-fill-medium md:pointer-fine:disabled:text-foreground-muted md:pointer-fine:disabled:opacity-100",
      "md:pointer-fine:aria-disabled:bg-fill-medium md:pointer-fine:aria-disabled:text-foreground-muted md:pointer-fine:aria-disabled:opacity-100",
    ],
  },
  variants: {
    // An icon-only send button is one of the composer's icons: a bar button
    // on a desktop.
    icon: {
      true: { submit: barButtonDesktop },
      false: {},
    },
  },
});
