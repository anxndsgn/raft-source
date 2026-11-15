import { forwardRef, useCallback } from "react";
import { AppRailItem, AppRailItemAttention, AppRailItemBadge, AppRailItemIcon, AppRailItemLabel } from "@botiverse/raft-ui";

import { WorkingRing } from "@botiverse/raft-ui-ext";

import Tooltip from "../ui/Tooltip";

/** A rail item's tooltip goes beside the rail, on the side away from it. */
const TOOLTIP_CONTENT_PROPS = {
  left: { side: "left" },
  right: { side: "right" },
} as const;

/**
 * One of the rail's navigation buttons (LeftRail): its icon, its name in a
 * tooltip to its right, the attention dot, the selected sticker.
 */
type RailTabButtonProps = Omit<
  React.ComponentPropsWithoutRef<"button">,
  "children" | "onClick" | "onDoubleClick" | "aria-label" | "aria-haspopup" | "aria-expanded"
> & {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  showDot?: boolean;
  /** Agents at work (the Team tab, PRD 团队页 §4): a turning dashed ring round the item and their number, no fill. */
  working?: number;
  /** A count instead of the dot (the inbox's unread). */
  badgeCount?: number;
  dotInactiveOnly?: boolean;
  dotTooltip?: string;
  tooltipSide?: "left" | "right";
  onClick: (event: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  testId?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
  ariaHasPopup?: "menu";
  ariaExpanded?: boolean;
  showTooltip?: boolean;
};

export const RailTabButton = forwardRef<HTMLButtonElement, RailTabButtonProps>(function RailTabButton({
  icon,
  label,
  active,
  showDot,
  working = 0,
  badgeCount,
  dotInactiveOnly,
  dotTooltip,
  tooltipSide = "right",
  onClick,
  onDoubleClick,
  testId,
  onPointerDown,
  buttonRef,
  ariaHasPopup,
  ariaExpanded,
  showTooltip = true,
  className = "",
  ...buttonProps
}, forwardedRef) {
  const dotVisible = Boolean(showDot && (!dotInactiveOnly || !active));
  const setButtonRefs = useCallback((node: HTMLButtonElement | null) => {
    setReactRef(buttonRef, node);
    setReactRef(forwardedRef, node);
  }, [buttonRef, forwardedRef]);
  const button = (
    <AppRailItem
      {...buttonProps}
      ref={setButtonRefs}
      selected={active}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-label={label}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      data-testid={testId}
      onPointerDown={onPointerDown}
      // Raft Design System › Rail: 40×40 items, 36×36 when the window is
      // under 600 tall (the heads shrink to 48 with them).
      className={`relative size-(--rail-item) [@media(max-height:600px)]:h-9 [@media(max-height:600px)]:w-9 ${className}`}
    >
      <AppRailItemIcon className="relative">
        {icon}
        {badgeCount && badgeCount > 0 ? (
          <AppRailItemBadge data-testid={testId ? `${testId}-badge` : undefined}>{Math.min(badgeCount, 99)}</AppRailItemBadge>
        ) : dotVisible ? (
          <AppRailItemAttention title={dotTooltip ?? label} />
        ) : null}
      </AppRailItemIcon>
      <WorkingRing count={working} data-testid={testId && working > 0 ? `${testId}-working` : undefined} />
      <AppRailItemLabel>{label}</AppRailItemLabel>
    </AppRailItem>
  );

  return showTooltip ? (
    <Tooltip
      content={dotVisible && dotTooltip ? dotTooltip : label}
      contentProps={TOOLTIP_CONTENT_PROPS[tooltipSide]}
    >
      {button}
    </Tooltip>
  ) : button;
});

function setReactRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else ref.current = value;
}

