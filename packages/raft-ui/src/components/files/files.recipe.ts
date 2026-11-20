import { tv } from "../../lib/tv";

export const files = tv({
  slots: {
    panel: ["flex min-h-0 flex-1 flex-col", "bg-layer-canvas text-foreground"],
    viewport: ["min-h-0 flex-1"],
    list: ["flex flex-col gap-2 px-(--surface-inset) py-3", "max-md:px-4", "md:pointer-fine:gap-0.5 md:pointer-fine:px-2 md:pointer-fine:py-2"],
    row: [
      "group/file-row flex w-full min-w-0 gap-3 px-3",
      "transition-colors",
      "items-center rounded-container border border-line-hairline bg-layer-card py-2.5 pr-1.5 pl-2.5 shadow-none",
      // The hover is on a child (the open button), so `hover:` cannot express it;
      // the explicit media query keeps it off touch screens, like `hover:` does.
      "[@media(hover:hover)]:has-[[data-slot=file-row-open]:hover]:overlay-subtle has-[[data-slot=file-row-open]:active]:overlay-medium",
      "has-data-popup-open:overlay-subtle",
      "has-[[data-slot=file-row-open]:focus-visible]:shadow-focus",
      // Raft redesign (Figmama 11/21): with a mouse an item card: no edge or
      // fill at rest, 8/10 inside, the card corner; the subtle fill on hover.
      "md:pointer-fine:gap-2.5 md:pointer-fine:border-transparent md:pointer-fine:bg-transparent md:pointer-fine:px-2.5 md:pointer-fine:py-2",
      "md:pointer-fine:[@media(hover:hover)]:has-[[data-slot=file-row-open]:hover]:bg-fill-subtle md:pointer-fine:[@media(hover:hover)]:has-[[data-slot=file-row-open]:hover]:bg-none",
    ],
    rowOpen: [
      "flex min-w-0 flex-1 gap-3 text-left",
      "focus-visible:outline-2 focus-visible:outline-offset-2",
      "items-center outline-none",
      "focus-visible:outline-none",
    ],
    thumbnail: [
      "flex shrink-0 items-center justify-center overflow-hidden",
      "[&_svg]:size-4.5 [&_svg]:shrink-0",
      "has-data-[slot=file-preview]:overflow-visible has-data-[slot=file-preview]:border-0 has-data-[slot=file-preview]:bg-transparent",
      "size-9 rounded-chip border-0 bg-fill-muted text-foreground-muted",
      "has-[[data-slot=file-preview]]:size-9",
      // A 32px tile of 5% ink at the control corner, a 16px icon (or a 32px thumbnail).
      "md:pointer-fine:size-8 md:pointer-fine:rounded-control md:pointer-fine:bg-fill-medium md:pointer-fine:[&_svg]:size-4 md:pointer-fine:has-[[data-slot=file-preview]]:size-8",
    ],
    image: [
      "block size-full",
      "data-[fit=contain]:object-contain data-[fit=cover]:object-cover",
      "bg-layer-card",
    ],
    content: ["flex min-w-0 flex-1 flex-col", "justify-center gap-0.5"],
    name: ["block truncate", "font-sans text-callout font-semibold text-foreground", "md:pointer-fine:text-[14px] md:pointer-fine:font-normal"],
    meta: [
      "flex min-w-0 flex-wrap items-center gap-y-1",
      "mt-0 gap-x-1.5 font-mono text-mono-meta text-foreground-hint",
      // "v1 · Nov 15" / "631 B · Nov 15": Inter 12 muted, the parts joined by a dot, no icons.
      "md:pointer-fine:gap-x-0 md:pointer-fine:font-sans md:pointer-fine:text-[12px] md:pointer-fine:text-foreground-muted",
    ],
    metaItem: [
      "inline-flex items-center gap-1 [&_svg]:size-3 [&_svg]:shrink-0",
      "md:pointer-fine:[&_svg]:hidden md:pointer-fine:not-first:before:content-['_·_'] md:pointer-fine:not-first:before:whitespace-pre",
    ],
    // With a mouse the More button shows while the row is hovered or its menu is open.
    actions: ["flex shrink-0 self-center items-center gap-1.5", "md:pointer-fine:[&_[data-slot=button]]:size-6 md:pointer-fine:opacity-0 md:pointer-fine:group-hover/file-row:opacity-100 md:pointer-fine:has-data-popup-open:opacity-100 md:pointer-fine:focus-within:opacity-100"],
  },
});
