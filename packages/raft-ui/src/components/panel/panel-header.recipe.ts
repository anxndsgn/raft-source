import { barEdgePull, barIconInset, headEdges } from "../../lib/head-edges";
import { tv } from "../../lib/tv";

/**
 * Where a head's edge controls sit, shared by every head (panel, section,
 * drawer, thread): see lib/head-edges.ts. Both sides pad by the content
 * margin (16px on a phone, 20px from 768px by touch, 16px with a mouse), so a filled thing (a sticker,
 * a pill, a filled Button) puts its shape on it, and the first and last
 * frameless icon button are pulled out by their icon inset so their icon box
 * lands on it, mirrored at the two ends.
 */
export const panelHeadEdges = headEdges;

/**
 * A head's trailing actions, 2px apart (4px on a desktop). The group declares
 * its PanelActions' icon inset, so the head pulls the group, not its last
 * button: an action hidden at some width (a thread's Close below 1024px) then
 * leaves the next one on the edge.
 */
export const panelHeadActions = [
  "flex shrink-0 items-center gap-0.5 md:pointer-fine:gap-1",
  barIconInset,
];

/**
 * `header` and `sectionHeader` share one bar, expressed through
 * `compoundSlots`: a header-height row (the shell header height, 56px on a
 * phone and 44px on a desktop) with a seam under it.
 * On a phone the section head is on the canvas too, as every top bar (Raft
 * redesign, Figmama mobile spec 11/21).
 */
export const panelHeader = tv({
  slots: {
    header: [],
    sectionHeader: [],
    headerIcon: [
      "flex size-auto shrink-0 items-center justify-center",
      // Raft redesign: no sticker at any width. A phone and a touch screen show
      // the channel's # as a muted 16px glyph right before the title (Figmama
      // mobile spec 11/21: SB16 title, the # a muted character, 2px off);
      // a desktop draws it in the title's colour (Figma Channel Header,
      // anxndsgn 11/18).
      "border-0 bg-transparent text-foreground-muted ring-0 max-md:not-data-[icon-kind=avatar]:-me-1.5",
      "not-data-[icon-kind=avatar]:[&_svg]:size-4 not-data-[icon-kind=avatar]:[&_svg]:stroke-2",
      "md:pointer-fine:text-foreground",
    ],
    // From 768px a head is one line, with a mouse or by touch: a subtitle
    // (PanelMeta) follows the title on its line and gives up its room first.
    // A phone stacks them, the subtitle under the name.
    headerContent: [
      "flex min-w-0 flex-1 flex-col justify-center",
      "md:flex-row md:items-baseline md:justify-start md:gap-2",
    ],
    heading: "flex min-w-0 items-center gap-2",
    // Raft redesign: Inter Semi Bold 15/18 on a desktop (Figma Channel Header).
    // Raft redesign: Semi Bold everywhere; 16 on a phone and a touch screen
    // (Figmama mobile spec 11/21), Inter Semi Bold 15/18 on a desktop (Figma Channel Header).
    title: "truncate font-sans text-[16px]/[22px] font-semibold text-foreground md:pointer-fine:text-head-title",
    meta: [
      "min-w-0 truncate font-sans text-caption text-foreground-hint",
      "md:flex-1 md:shrink-1000",
    ],
    status: [
      "inline-flex shrink-0 items-center gap-1 border-0 bg-transparent p-0",
      "font-sans text-caption font-medium normal-case text-foreground-hint",
      "[&_svg]:size-3.5 [&_svg]:shrink-0",
    ],
    activity: [
      "inline-flex shrink-0 items-center gap-1.5",
      "font-sans text-caption text-foreground-hint",
      "[&_svg]:size-3.5 [&_svg]:shrink-0",
      "*:data-[slot=status]:lead-dot",
    ],
    actions: panelHeadActions,
  },
  variants: {
    size: {
      sm: {},
      md: { meta: ["text-footnote"] },
    },
  },
  compoundSlots: [
    {
      slots: ["header", "sectionHeader"],
      class: [
        "flex h-(--shell-header-height,var(--header-height)) shrink-0 items-center gap-3 max-md:gap-2",
        panelHeadEdges,
        // Raft redesign (Figma Channel Header): on a desktop text sits 14px in
        // and an icon button at either end 6px from the edge, as far as from
        // the head's top and bottom (32 in 44); 2px between its parts.
        "md:pointer-fine:gap-0.5 md:pointer-fine:px-3.5",
        ...barEdgePull,
        "border-b border-line-seam bg-layer-canvas text-foreground",
        "max-md:sticky max-md:top-0 max-md:z-chrome",
      ],
    },
  ],
});
