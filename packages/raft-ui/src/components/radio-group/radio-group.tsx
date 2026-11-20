import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { tv } from "../../lib/tv";
import { cn } from "../../lib/cn";
import type { StyledProps } from "../../lib/styled-props";

const radioGroup = tv({
  slots: {
    root: [
      "grid w-full gap-2",
      "data-disabled:[&>label]:cursor-not-allowed data-disabled:[&>label]:text-foreground-disabled",
      "data-disabled:[&>label_*]:text-foreground-disabled",
      "font-sans [&>label]:font-semibold md:pointer-fine:[&>label]:font-normal md:pointer-fine:[&>label]:text-[14px]",
    ],
    item: [
      "relative inline-flex shrink-0 touch-manipulation items-center justify-center rounded-full outline-none",
      "data-disabled:cursor-not-allowed",
      "after:absolute after:-inset-x-3 after:-inset-y-2 after:content-['']",
      "pointer-coarse:after:-inset-y-[calc(--spacing(3)+1.5px)]",
      "[label>&]:my-[max(0px,calc((1lh-1.25rem)/2))]",
      "[label>&]:after:-inset-y-[calc(max(0px,(1lh-1.25rem)/2)+5.5px)] md:pointer-fine:[label>&]:after:-inset-y-[calc(max(0px,(1lh-1rem)/2)+5px)]",
      "size-5 border-[1.5px] border-line-strong bg-layer-card text-foreground",
      "focus-visible:shadow-focus",
      "data-disabled:border-foreground-disabled data-disabled:bg-fill-muted data-disabled:text-foreground-disabled",
      // Raft redesign (Figmama 11/21): with a mouse a 16px circle, a 1px line
      // of 25% ink on the canvas; chosen, an ink line round a 6px ink dot;
      // disabled the same at 40%.
      "md:pointer-fine:size-4 md:pointer-fine:border md:pointer-fine:border-[color-mix(in_oklch,var(--foreground)_25%,transparent)] md:pointer-fine:bg-layer-canvas",
      "md:pointer-fine:data-checked:border-foreground md:pointer-fine:[label>&]:my-[max(0px,calc((1lh-1rem)/2))]",
      "md:pointer-fine:data-disabled:bg-layer-canvas md:pointer-fine:data-disabled:text-foreground md:pointer-fine:data-disabled:opacity-40",
    ],
    indicator: ["pointer-events-none flex size-full items-center justify-center"],
    dot: ["block rounded-full bg-current", "size-2", "md:pointer-fine:size-1.5"],
  },
});

export type RadioGroupProps<T extends string = string> = StyledProps<BaseRadioGroup.Props<T>>;

export function RadioGroup<T extends string = string>({ className, ...props }: RadioGroupProps<T>) {
  const { root } = radioGroup();

  return <BaseRadioGroup data-slot="radio-group" className={root({ className })} {...props} />;
}

export type RadioGroupIndicatorProps = StyledProps<BaseRadio.Indicator.Props>;

export function RadioGroupIndicator({ className, children, ...props }: RadioGroupIndicatorProps) {
  const { indicator, dot } = radioGroup();

  return (
    <BaseRadio.Indicator
      data-slot="radio-group-indicator"
      className={indicator({ className })}
      {...props}
    >
      {children ?? <span data-slot="radio-group-dot" className={dot()} />}
    </BaseRadio.Indicator>
  );
}

export type RadioGroupItemProps<T extends string = string> = StyledProps<
  BaseRadio.Root.Props<T>
> & {
  appearance?: "default" | "none";
};

export function RadioGroupItem<T extends string = string>({
  appearance = "default",
  className,
  children,
  ...props
}: RadioGroupItemProps<T>) {
  const { item } = radioGroup();
  const itemClassName =
    appearance === "none"
      ? cn("sr-only", "data-disabled:cursor-not-allowed", className)
      : item({ className });

  return (
    <BaseRadio.Root data-slot="radio-group-item" className={itemClassName} {...props}>
      {children ?? (appearance === "default" ? <RadioGroupIndicator /> : null)}
    </BaseRadio.Root>
  );
}
