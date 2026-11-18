import { tv } from "../../lib/tv";

export const appRail = tv({
  slots: {
    root: [
      "flex size-full  flex-col items-center select-none",
      // On the frame, beside the islands: no seam of its own on a desktop
      // (Raft redesign); a phone and a touch screen keep theirs.
      "w-(--rail-width) border-r border-line-seam md:pointer-fine:border-r-0",
      "bg-layer-frame text-foreground-on-frame",
      // Rail icons draw 1.5px lines, heavier than the 1px in content (owner 11-18).
      "[--icon-stroke:1.5px]",
      "[@media(max-height:600px)]:w-(--rail-width-short)",
    ],
    header: [
      "relative flex w-full shrink-0 items-center justify-center",
      "h-(--shell-header-height,var(--header-height)) border-b border-line-seam",
      "[@media(max-height:600px)]:h-(--header-height-short)",
      // Raft redesign (Figma 精修 · 组件化, Rail), on a desktop: no head row and
      // no seam. The workspace switcher is the rail's first item, its 32px
      // tile 14px from the top (a 36px item 12px down), and the nav follows a
      // gap below. A phone and a touch screen keep the head row.
      "md:pointer-fine:h-auto md:pointer-fine:border-b-0 md:pointer-fine:pt-3",
      "md:pointer-fine:[@media(max-height:600px)]:h-auto",
    ],
    nav: [
      "flex w-full flex-1 flex-col items-center py-2", // Raft DS › Rail: `rail-item` items, 40px 6px apart on a touch
      // screen. Under the rail head the first item starts 10px below its seam
      // (the head's 4px margin plus the 6px gap). With no head (a top bar
      // above the rail takes the workspace switcher) the rail's side inset
      // frames it instead: 8px (a 40px item in the 56px rail), as at the
      // bottom. With a mouse the items are 36, 4 apart, and the inset 6 (a
      // 36px item in the 48px rail); short windows use the same 36 and 6.
      "gap-1.5 pt-2.5 pb-2 first:pt-2",
      "[@media(max-height:600px)]:pt-1.5 [@media(max-height:600px)]:first:pt-1.5",
      // Raft redesign: with a mouse the items are 36, 6 apart, the first 6
      // under the switcher's tile (4 under its item box).
      "md:pointer-fine:gap-1.5 md:pointer-fine:pt-1 md:pointer-fine:first:pt-3",
      "after:mt-auto after:h-28 after:min-h-0 after:w-12 after:shrink after:content-[''] after:frame-decor-rail",
    ],
    footer: [
      "flex w-full shrink-0 flex-col items-center justify-center",
      "h-auto gap-1.5 pb-2 [@media(max-height:600px)]:pb-1.5",
      "md:pointer-fine:gap-1.5 md:pointer-fine:pb-1.5",
    ],
    item: [
      "relative inline-flex shrink-0 items-center justify-center",
      "outline-none",
      "disabled:pointer-events-none disabled:opacity-45",
      "[&_svg]:shrink-0",
      "size-(--rail-item) rounded-control border-[1.5px] border-transparent",
      // Icons 24 in the rail (Figma size/icon-rail), 20 everywhere else.
      "text-foreground-on-frame [&_svg]:size-5 md:pointer-fine:[&_svg]:size-6",
      "hover:bg-fill-frame-medium active:bg-fill-frame-medium",
      // "You are here": the canvas square behind the icon (Raft redesign), no edge.
      "data-[selected=true]:border-line-frame-active data-[selected=true]:bg-layer-frame-active",
      "data-[selected=true]:text-foreground-on-frame-active",
      "focus-visible:shadow-focus",
      "[@media(max-height:600px)]:size-(--rail-item-short)",
    ],
    itemIcon: ["relative inline-flex items-center justify-center"],
    itemLabel: ["sr-only"],
    itemBadge: [
      "absolute -right-1 -top-1 inline-flex items-center justify-center",
      "h-4 min-w-4 rounded-sticker px-1",
      "bg-attention-400 text-sticker-ink inset-ring-[1.5px] inset-ring-sticker-ink ring-[1.5px] ring-sticker-edge",
      "font-mono text-[10px] font-bold leading-4 tabular-nums",
    ],
    // The attention dot (Raft redesign, Figma 精修 · 组件化 Rail): 8px of the
    // unread colour, no edge, at the icon's top right corner.
    itemIndicator: ["pointer-events-none absolute", "top-0 -right-0.5", "border-0 rounded-sticker"],
  },
});
