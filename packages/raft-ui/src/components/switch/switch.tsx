import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { tv } from "../../lib/tv";
import type { StyledProps } from "../../lib/styled-props";

const switchRecipe = tv({
  slots: {
    root: [
      "relative inline-flex shrink-0 touch-manipulation items-center outline-none",
      "transition-[background-color,box-shadow,transform] ease-out",
      "motion-reduce:transition-none",
      "not-data-disabled:cursor-pointer",
      "data-disabled:cursor-not-allowed",
      "after:absolute after:-inset-x-3 after:-inset-y-[calc((44px-var(--switch-height))/2+1.5px)] after:content-['']",
      "focus-visible:ring-line-strong focus-visible:ring-offset-layer-sidebar",
      // Raft redesign (Figmama 11/20; by touch too, mobile spec 11/21): a round
      // track with no edge or shadow, 15% ink off (Figmama 11/21: fill-medium
      // was too faint) and the ink on; the thumb the canvas, 2px in; only the
      // thumb's position moves (150ms). With a mouse 32x18.
      "h-(--switch-height) w-(--switch-width) rounded-full border-0 p-0.5 duration-150",
      "bg-[color-mix(in_oklch,var(--foreground)_15%,transparent)] data-checked:bg-foreground",
      "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-focus",
      "data-disabled:opacity-40",
      "md:pointer-fine:[--switch-width:32px] md:pointer-fine:[--switch-height:18px] md:pointer-fine:transition-none",
    ],
    thumb: [
      "pointer-events-none block",
      "transition-transform motion-reduce:transition-none duration-150 ease-out",
      "size-[calc(var(--switch-height)-4px)] rounded-full bg-layer-canvas shadow-none data-checked:translate-x-[calc(var(--switch-width)-var(--switch-height))]",
    ],
  },
});

export type SwitchProps = StyledProps<BaseSwitch.Root.Props>;

export function Switch({ className, children, ...props }: SwitchProps) {
  const { root } = switchRecipe();

  return (
    <BaseSwitch.Root data-slot="switch" className={root({ className })} {...props}>
      {children ?? <SwitchThumb />}
    </BaseSwitch.Root>
  );
}

export type SwitchThumbProps = StyledProps<BaseSwitch.Thumb.Props>;

export function SwitchThumb({ className, ...props }: SwitchThumbProps) {
  const { thumb } = switchRecipe();

  return <BaseSwitch.Thumb data-slot="switch-thumb" className={thumb({ className })} {...props} />;
}
