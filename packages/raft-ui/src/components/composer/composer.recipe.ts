import { tv } from "../../lib/tv";
import { barButtonDesktop } from "../../lib/head-edges";

export const composer = tv({
  slots: {
    root: [
      "flex w-full flex-col gap-2 p-2",
      "rounded-container border-[1.5px] px-3 pt-3 pb-[calc(var(--control-embedded-inset)-1px)]",
      "border-line-field bg-layer-card text-foreground shadow-none",
      // Raft redesign (Figma Composer; by touch too, mobile spec 11/21): the
      // canvas with a 1px hairline, 10px top and bottom, 12px sides, 10px between its rows.
      // While the caret is in it the line is the foreground, 1px, clicked into
      // or tabbed to; never a thicker ring (Figmama 11/21, 250d9559).
      "has-[[data-slot=composer-input]:focus]:border-foreground",
      "gap-2.5 md:pointer-fine:gap-2.5 border md:pointer-fine:border border-line-hairline md:pointer-fine:border-line-hairline bg-layer-canvas md:pointer-fine:bg-layer-canvas",
      // anxndsgn 11/20 (Figmama): the buttons 8px from the left, right and
      // bottom edges (inside the 1px line: 7px), the text 14px in.
      "md:pointer-fine:px-[7px] md:pointer-fine:pt-2.5 md:pointer-fine:pb-[7px]",
    ],
    inputFrame: ["w-full min-w-0", "[--r-scroll-area-resize-grip-size:0px]"],
    input: [
      "max-h-32 w-full resize-none bg-transparent outline-none",
      "field-sizing-content",
      "min-h-6 px-0.5 md:pointer-fine:px-1.5",
      // The DS composer input is `text-body` regular wherever it is hosted:
      // it states its weight rather than inheriting one (a thread footer's
      // caption type at 500 made its text and placeholder medium).
      "font-sans text-body font-normal text-foreground",
      "placeholder:text-foreground-hint",
    ],
    toolbar: [
      "flex items-center justify-between",
      "mx-[calc(var(--control-embedded-inset)-0.75rem-1px)] gap-embedded-inset",
      "md:pointer-fine:mx-0",
    ],
    actions: ["flex items-center gap-embedded-inset"],
    meta: ["flex items-center", "gap-embedded-inset"],
    iconButton: [
      "size-8 rounded-chip text-foreground-muted",
      barButtonDesktop,
      "disabled:border-transparent disabled:bg-transparent",
      "aria-disabled:border-transparent aria-disabled:bg-transparent",
      "[&_svg:not([class*='size-'])]:size-4.5",
      // Raft redesign: 16px icons on a desktop (anxndsgn 11/18: 24 in the rail, 16 everywhere else).
      "md:pointer-fine:[&_svg:not([class*='size-'])]:size-4",
    ],
    submit: [
      "rounded-chip",
      // A 36px send button on a phone (mobile spec 11/21).
      "max-md:size-9",
      // Raft redesign (Figmama 11/18): the send button is an ink square; with
      // nothing to send it is the 5% fill with a muted icon, not faded.
      "disabled:bg-fill-medium md:pointer-fine:disabled:bg-fill-medium disabled:text-foreground-muted md:pointer-fine:disabled:text-foreground-muted disabled:opacity-100 md:pointer-fine:disabled:opacity-100",
      "aria-disabled:bg-fill-medium md:pointer-fine:aria-disabled:bg-fill-medium aria-disabled:text-foreground-muted md:pointer-fine:aria-disabled:text-foreground-muted aria-disabled:opacity-100 md:pointer-fine:aria-disabled:opacity-100",
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
