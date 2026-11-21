import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { tv } from "../../lib/tv";

// EmptyState family: a quiet "nothing here yet" surface — muted icon, muted
// title, optional description + action. Composed from a centered root, a
// content group, and slot parts (`EmptyStateIcon`, `EmptyStateTitle`,
// `EmptyStateDescription`, `EmptyStateActions`). All parts share one `tv()`
// slots config. The title is sentence-case (callers pass the literal string).
const emptyState = tv({
  slots: {
    // Its sides: 24px, the page inset (16px) with a mouse on a desktop (stdrc, 2026-11-05).
    root: [
      "flex w-full min-w-0 flex-col items-center justify-center px-6 md:pointer-fine:px-(--page-inset) py-12 text-center",
    ],
    content: [
      "flex w-full max-w-sm min-w-0 flex-col items-center gap-2 text-center",
      "[&>[data-slot=empty-state-icon]]:mb-0",
      "[&>[data-slot=empty-state-title]]:mb-0",
    ],
    icon: [
      "mb-4 inline-flex items-center justify-center [&_svg]:shrink-0",
      "text-foreground-hint [&_svg]:size-9",
      // Raft redesign (Figmama 11/21): with a mouse a 24px muted icon, 12px over the title.
      "mb-3 md:pointer-fine:mb-3 text-foreground-muted md:pointer-fine:text-foreground-muted [&_svg]:size-6 md:pointer-fine:[&_svg]:size-6",
    ],
    title: [
      "mb-2 w-full max-w-full text-center text-balance",
      "font-sans text-headline font-bold text-foreground-muted",
      "mb-1 md:pointer-fine:mb-1 md:pointer-fine:text-[14px] md:pointer-fine:leading-5 font-semibold md:pointer-fine:font-semibold text-foreground md:pointer-fine:text-foreground",
    ],
    description: [
      "mx-auto w-full text-center text-pretty",
      "[&>a]:font-semibold [&>a]:decoration-[1.5px] [&>a]:underline-offset-[3px]",
      "[&>a]:hover:text-foreground [&>a]:hover:underline",
      "max-w-[300px] text-callout text-foreground-hint",
      "md:pointer-fine:text-[13px] md:pointer-fine:leading-[18px] text-foreground-muted md:pointer-fine:text-foreground-muted line-clamp-2 md:pointer-fine:line-clamp-2",
    ],
    actions: ["mt-5", "md:pointer-fine:mt-3"],
  },
});

type EmptyStateSlotProps = useRender.ElementProps<"div"> & {
  "data-slot": string;
};

export type EmptyStateProps = useRender.ComponentProps<"div">;

// Root: a centered, padded column. Compose `EmptyStateContent` and
// `EmptyStateActions` as children. Flat icon/title/description children are
// still supported for legacy callsites.
export function EmptyState({ render, className, ...props }: EmptyStateProps) {
  const { root } = emptyState();
  const defaultProps: EmptyStateSlotProps = {
    "data-slot": "empty-state",
    className: root({ className }),
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
    state: {
      slot: "empty-state",
    },
  });
}

export type EmptyStateContentProps = useRender.ComponentProps<"div">;

// Content: groups media, title, and description so empty-state copy keeps a
// stable measure and balanced line breaks.
export function EmptyStateContent({ render, className, ...props }: EmptyStateContentProps) {
  const { content } = emptyState();
  const defaultProps: EmptyStateSlotProps = {
    "data-slot": "empty-state-content",
    className: content({ className }),
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
    state: {
      slot: "empty-state-content",
    },
  });
}

export type EmptyStateIconProps = useRender.ComponentProps<"div">;

// Muted icon slot. The slot owns the default SVG size; callers can still
// override it with className for custom media.
export function EmptyStateIcon({ render, className, ...props }: EmptyStateIconProps) {
  const { icon } = emptyState();
  const defaultProps: EmptyStateSlotProps = {
    "data-slot": "empty-state-icon",
    // Decorative: the title says what is empty.
    "aria-hidden": true,
    className: icon({ className }),
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
    state: {
      slot: "empty-state-icon",
    },
  });
}

export type EmptyStateTitleProps = useRender.ComponentProps<"div">;

// Muted, sentence-case title line. Pass `render` to override the element (e.g. a
// real heading for landmark semantics).
export function EmptyStateTitle({ render, className, ...props }: EmptyStateTitleProps) {
  const { title } = emptyState();
  const defaultProps: EmptyStateSlotProps = {
    "data-slot": "empty-state-title",
    className: title({ className }),
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
    state: {
      slot: "empty-state-title",
    },
  });
}

export type EmptyStateDescriptionProps = useRender.ComponentProps<"div">;

// Optional supporting copy, capped to ~32ch for a tidy measure. Pass `render` to
// override the element.
export function EmptyStateDescription({ render, className, ...props }: EmptyStateDescriptionProps) {
  const { description } = emptyState();
  const defaultProps: EmptyStateSlotProps = {
    "data-slot": "empty-state-description",
    className: description({ className }),
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
    state: {
      slot: "empty-state-description",
    },
  });
}

export type EmptyStateActionsProps = useRender.ComponentProps<"div">;

// Optional action slot rendered below the copy. Pass `render` to override the
// element.
export function EmptyStateActions({ render, className, ...props }: EmptyStateActionsProps) {
  const { actions } = emptyState();
  const defaultProps: EmptyStateSlotProps = {
    "data-slot": "empty-state-actions",
    className: actions({ className }),
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
    state: {
      slot: "empty-state-actions",
    },
  });
}
