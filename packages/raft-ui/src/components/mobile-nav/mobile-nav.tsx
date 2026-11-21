import { Button as BaseButton } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { SlotElementProps } from "../../lib/data-attributes";
import { useTapActivation } from "../../lib/tap-activation";
import { tv } from "../../lib/tv";

const mobileNav = tv({
  slots: {
    // Raft redesign (Figmama mobile spec 11/21): the canvas with a hairline
    // over it, 56 tall plus the safe area.
    root: [
      "grid w-full flex-none grid-flow-col auto-cols-fr items-stretch gap-0",
      "border-t border-line-seam bg-layer-canvas px-2 pt-0 text-foreground-muted",
      "pb-[min(env(safe-area-inset-bottom,0px),34px)]",
    ],
    // A 20px icon over an 11px label. The selected tab is its filled icon and
    // a Semi Bold label in the foreground, with no fill or sticker behind it;
    // the others are muted. A press is the subtle fill.
    item: [
      "relative inline-flex h-14 shrink-0 items-center outline-none",
      "disabled:pointer-events-none disabled:opacity-45",
      "[&_svg]:shrink-0",
      "isolate min-w-0 flex-col justify-center gap-1 border-0 px-0 py-0",
      "font-sans text-[11px]/[14px] font-normal text-foreground-muted",
      "*:relative *:z-raised [&_svg]:size-5",
      "active:bg-fill-subtle",
      "data-[selected=true]:font-semibold data-[selected=true]:text-foreground",
      "rounded-control focus-visible:shadow-focus",
    ],
    itemLabel: ["min-w-0 truncate", "max-w-full"],
  },
});

export type MobileNavRootProps = useRender.ComponentProps<"nav">;

export function MobileNavRoot({ className, render, ...props }: MobileNavRootProps) {
  const { root } = mobileNav();
  const defaultProps: SlotElementProps<"nav"> = {
    "data-slot": "mobile-nav-root",
    className: root({ className }),
  };

  return useRender({
    defaultTagName: "nav",
    render,
    props: mergeProps<"nav">(defaultProps, props),
  });
}

export type MobileNavItemProps = useRender.ComponentProps<"button"> & {
  nativeButton?: boolean;
  selected?: boolean;
};

export function MobileNavItem({
  nativeButton = true,
  selected,
  className,
  render,
  ref,
  ...props
}: MobileNavItemProps) {
  const { item } = mobileNav();
  // A tab bar item switches when the finger lifts, so a tap that stops a
  // scrolling page still switches (design/patterns/navigation.md#switching-on-finger-lift).
  const tapRef = useTapActivation<HTMLButtonElement>();
  const defaultProps: SlotElementProps<"button"> = {
    type: nativeButton ? "button" : undefined,
    "aria-pressed": nativeButton ? selected : undefined,
    "data-slot": "mobile-nav-item",
    "data-selected": selected ? "true" : undefined,
    className: item({ className }),
  };

  return useRender({
    render: render ?? <BaseButton />,
    ref: ref ? [ref, tapRef] : tapRef,
    props: mergeProps<"button">(defaultProps, props),
  });
}

export type MobileNavLabelProps = useRender.ComponentProps<"span">;

export function MobileNavLabel({ className, render, ...props }: MobileNavLabelProps) {
  const { itemLabel } = mobileNav();
  const defaultProps: SlotElementProps<"span"> = {
    "data-slot": "mobile-nav-item-label",
    className: itemLabel({ className }),
  };

  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(defaultProps, props),
  });
}
