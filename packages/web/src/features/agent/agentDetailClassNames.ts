// The profile hero avatar is the trigger itself: no control frame around the
// sticker (it carries its own ink edge), a focus ring on keyboard focus.
export const PROFILE_AVATAR_BUTTON_CLASS = "group/avatar-edit relative shrink-0 rounded-sticker outline-none focus-visible:shadow-focus";
// DS runtime chip (`.rf-runtime`): the cyan-soft Badge in machine type, with a cpu icon.
// Raft redesign (Figmama 11/21): with a mouse the runtime chip is the role tag: 16 high, 4 in, Inter Medium
// 11/14 muted on 5% ink, its icon 12.
export const RUNTIME_CHIP_CLASS = "font-mono text-mono-meta font-normal md:pointer-fine:h-4 md:pointer-fine:gap-1 md:pointer-fine:px-1 md:pointer-fine:bg-fill-medium md:pointer-fine:font-sans md:pointer-fine:text-[11px] md:pointer-fine:leading-[14px] md:pointer-fine:font-medium md:pointer-fine:text-foreground-muted md:pointer-fine:[&_svg]:size-3";
// The 14px info icon answers a bigger target than it draws: a transparent
// ::after reaching 44px on touch and the 28px bar button with a mouse (stdrc,
// 2026-11-05); the drawing is unchanged.
export const INFO_ICON_BUTTON_CLASS = "relative shrink-0 rounded-sticker text-foreground-muted transition-colors hover:bg-fill-medium hover:text-foreground after:absolute after:-inset-[15px] md:pointer-fine:after:-inset-[7px]";
