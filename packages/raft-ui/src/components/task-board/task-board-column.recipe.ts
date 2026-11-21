import { tv } from "../../lib/tv";

export const taskBoardColumn = tv({
  slots: {
    root: [
      "group flex shrink-0 self-start flex-col",
      "w-[232px] grow rounded-container p-0",
      "data-[drop-collapsed=true]:data-[drop-state=allowed]:[outline:1.5px_dashed_var(--line-strong)] data-[drop-collapsed=true]:data-[drop-state=allowed]:outline-offset-4",
    ],
    trigger: [
      "group flex w-full touch-manipulation items-center justify-between text-left outline-none",
      "min-h-8 md:pointer-fine:min-h-control gap-2 rounded-control",
      "font-sans text-footnote font-bold text-foreground-muted",
      "data-[panel-open]:mb-2",
      // C13: with a mouse the column head is the status square, the name in
      // Semi Bold 13 ink, the count Inter 12 muted.
      "md:pointer-fine:text-[13px] md:pointer-fine:leading-[17px] font-semibold md:pointer-fine:font-semibold text-foreground md:pointer-fine:text-foreground",
      "focus-visible:shadow-focus",
    ],
    heading: ["flex min-w-0 items-center", "gap-2"],
    badge: [
      "inline-flex items-center gap-2 p-0",
      "font-sans text-footnote font-bold text-foreground-muted",
      "[&>svg]:shrink-0",
      "md:pointer-fine:text-[13px] md:pointer-fine:leading-[17px] font-semibold md:pointer-fine:font-semibold text-foreground md:pointer-fine:text-foreground",
    ],
    count: ["font-mono text-mono-meta font-normal text-foreground-hint", "text-foreground-muted md:pointer-fine:text-foreground-muted"],
    chevron: [
      "inline-flex shrink-0 -rotate-90 items-center transition-transform",
      "[&_svg]:size-3.5",
      "group-data-panel-open:rotate-0",
      "motion-reduce:transition-none",
      "text-foreground-hint",
      "group-hover:text-foreground",
    ],
    panel: ["data-ending-style:hidden"],
    items: ["flex flex-col", "gap-2"],
    empty: [
      "px-3",
      "group-data-[drop-state=allowed]:hidden",
      "flex min-h-16 items-center justify-center py-3",
      "rounded-container border border-dashed border-line-seam",
      "text-center text-footnote text-foreground-hint",
      "group-data-[drop-state=blocked]:text-foreground-muted",
      // C13: with a mouse an empty column has no fill and no frame, just its
      // line in Inter 12 hint, left on the status square, 12 under the head
      // (the open head's 8 margin and 4 here; a card dragged over still outlines it).
      "min-h-0 md:pointer-fine:min-h-0 border-0 md:pointer-fine:border-0 justify-start md:pointer-fine:justify-start text-left md:pointer-fine:text-left px-0 md:pointer-fine:px-0 pt-1 md:pointer-fine:pt-1 pb-0 md:pointer-fine:pb-0 text-[12px] md:pointer-fine:text-[12px] leading-4 md:pointer-fine:leading-4",
    ],
    emptyIdle: ["group-data-[drop-state=allowed]:hidden group-data-[drop-state=blocked]:hidden"],
    emptyAllowed: ["hidden group-data-[drop-state=allowed]:block"],
    emptyBlocked: ["hidden group-data-[drop-state=blocked]:block"],
  },
});
