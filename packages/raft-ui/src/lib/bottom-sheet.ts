/**
 * A menu on a phone is a bottom sheet (Raft redesign, Figmama mobile spec
 * 11/21): the full width at the screen's bottom edge over a 40% black
 * backdrop that closes it; the canvas, its top corners the island radius
 * (0 in the square shape), a 1px hairline along its top, no shadow; a 36x4
 * handle 8px down; 8px and the safe area under its last row; as tall as its
 * rows up to 85% of the screen, then its list scrolls inside (a ScrollArea of
 * the menu's own, as Select's and a message's menu have). It slides up in 200ms
 * and down in 150ms. From 768px (a touch tablet, a mouse) a menu stays where
 * its trigger is. Shared by DropdownMenu, ContextMenu and Select.
 */

/** On the popup's positioner: Base UI places it with an inline style, so the sheet's place is `!`. */
export const sheetPositioner = [
  "max-md:fixed! max-md:inset-x-0! max-md:top-auto! max-md:bottom-0! max-md:left-0! max-md:right-0! max-md:w-full! max-md:transform-none!",
];

/** A backdrop drawn only on a phone. */
export const sheetBackdrop = [
  "fixed inset-0 z-popup bg-black/40 md:hidden",
  "transition-opacity duration-200 data-ending-style:duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0",
];

/** On the popup itself. */
export const sheetContent = [
  "max-md:relative max-md:max-h-[85dvh] max-md:w-full max-md:min-w-0",
  "max-md:rounded-none max-md:rounded-t-island max-md:border-t max-md:border-line-hairline max-md:bg-layer-canvas max-md:shadow-none max-md:ring-0",
  "max-md:px-0 max-md:pt-5 max-md:pb-[calc(8px+env(safe-area-inset-bottom,0px))]",
  "max-md:before:absolute max-md:before:top-2 max-md:before:left-1/2 max-md:before:h-1 max-md:before:w-9 max-md:before:-translate-x-1/2 max-md:before:rounded-full max-md:before:bg-[color-mix(in_oklch,var(--foreground)_15%,transparent)] max-md:before:content-['']",
  "max-md:transition-transform max-md:duration-200 max-md:ease-out max-md:data-ending-style:duration-150 max-md:data-starting-style:translate-y-full max-md:data-ending-style:translate-y-full",
];

/**
 * A row: 48 tall, 16px in, a 20px icon 12px from regular 16 text in the
 * foreground; a press is the subtle fill; the chosen one is only its check
 * (16, at the end), no fill and no weight.
 */
export const sheetRow = [
  // 12px above and below a 24px line make 48; a second line grows it with the same padding.
  "max-md:min-h-12 max-md:gap-3 max-md:rounded-none max-md:px-4 max-md:py-3",
  "max-md:text-[16px] max-md:leading-6 max-md:font-normal max-md:hover:bg-transparent max-md:data-highlighted:bg-transparent max-md:active:bg-fill-subtle",
  "max-md:data-checked:font-normal max-md:data-selected:font-normal",
  "max-md:[&>svg:not([class*='size-'])]:size-5 max-md:[&>svg]:text-foreground",
  // A destructive row (Delete, Archive: its text the danger ink) takes it for its icon too.
  "max-md:[&[class*='text-danger']>svg]:text-current",
];

/** A title over the rows: Semi Bold 16, 16px in, 8px under the handle, no line under it. */
export const sheetLabel = ["max-md:px-4 max-md:pt-0 max-md:pb-2 max-md:text-[16px] max-md:font-semibold max-md:text-foreground"];

/** The line between groups, 16px short of each side. */
export const sheetSeparator = ["max-md:mx-4"];
