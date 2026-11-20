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
      "h-(--switch-height) w-(--switch-width) rounded-full border-[1.5px] border-line-strong bg-fill-muted p-[2.5px]",
      "duration-150",
      "data-checked:border-sticker-ink data-checked:bg-selected data-checked:ring-[1.5px] data-checked:ring-sticker-edge",
      "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-focus",
      "data-disabled:border-foreground-disabled data-disabled:bg-fill-muted",
      "data-checked:data-disabled:border-foreground-disabled data-checked:data-disabled:bg-fill-muted",
      // Raft redesign (Figmama 11/20): with a mouse a 32x18 round track with no
      // edge or shadow, fill-medium off and the ink on; the thumb 14, the
      // canvas, 2px in; only the thumb's position moves (150ms).
      "md:pointer-fine:[--switch-width:32px] md:pointer-fine:[--switch-height:18px] md:pointer-fine:transition-none",
      "md:pointer-fine:border-0 md:pointer-fine:p-0.5 md:pointer-fine:bg-fill-medium md:pointer-fine:data-checked:bg-foreground md:pointer-fine:data-checked:ring-0",
      "md:pointer-fine:data-disabled:bg-fill-medium md:pointer-fine:data-disabled:opacity-40 md:pointer-fine:data-checked:data-disabled:bg-foreground",
    ],
    thumb: [
      "pointer-events-none block",
      "transition-transform ease-out",
      "motion-reduce:transition-none",
      "size-[calc(var(--switch-height)-8px)] rounded-full bg-layer-card shadow-[0_0_0_1.5px_var(--line-strong)] data-checked:translate-x-[calc(var(--switch-width)-var(--switch-height))]",
      "duration-220 ease-slide",
      "data-checked:bg-sticker-paper data-checked:shadow-[0_0_0_1.5px_var(--sticker-ink)]",
      "data-disabled:bg-fill-muted data-disabled:shadow-[0_0_0_1.5px_var(--foreground-disabled)]",
      "data-checked:data-disabled:bg-fill-muted data-checked:data-disabled:shadow-[0_0_0_1.5px_var(--foreground-disabled)]",
      "md:pointer-fine:size-3.5 md:pointer-fine:bg-layer-canvas md:pointer-fine:shadow-none md:pointer-fine:duration-150 md:pointer-fine:ease-out",
      "md:pointer-fine:data-checked:bg-layer-canvas md:pointer-fine:data-checked:shadow-none md:pointer-fine:data-disabled:bg-layer-canvas md:pointer-fine:data-disabled:shadow-none",
      "md:pointer-fine:data-checked:data-disabled:bg-layer-canvas md:pointer-fine:data-checked:data-disabled:shadow-none",
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
