import { tv } from "../../lib/tv";
import type { VariantProps } from "../../lib/tv";

export const messageFooter = tv({
  slots: {
    savedIndicator: [
      "inline-flex min-w-0 max-w-full items-center gap-1 overflow-hidden whitespace-nowrap select-none",
      "[&_svg]:shrink-0",
      // Raft redesign (mobile spec 11/21: the saved mark was a grey chip): the
      // role tag's quiet line, 20px, Inter 12 muted on no fill with a 12px
      // icon; the subtle fill under the pointer or finger.
      "h-5 rounded-control px-1 -ml-1",
      "font-sans text-[12px] leading-4 font-normal text-foreground-muted",
      "bg-transparent hover:bg-fill-subtle active:bg-fill-subtle",
      "outline-none focus-visible:shadow-focus",
      "[&_svg]:size-3 [&_svg]:text-foreground-muted",
    ],
    readReceipt: [
      "ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap",
      "[&_svg]:shrink-0",
      "h-[22px] font-mono text-mono-meta text-foreground-hint [&_svg]:size-3",
    ],
    badge: [
      "inline-flex min-w-0 max-w-full items-center overflow-hidden whitespace-nowrap select-none",
      "transition-colors [&_svg]:shrink-0",
      "h-6 gap-1 rounded-chip border-0 px-2 shadow-none",
      "text-footnote font-bold text-foreground-muted",
      "bg-fill-muted hover:overlay-medium active:overlay-medium",
      "[&_svg]:size-3.5",
    ],
    badgeSeparator: ["text-foreground/45"],
  },
  variants: {
    badgeStatus: { read: {}, unread: { badge: ["text-foreground"] } },
    iconOnly: {
      true: {
        savedIndicator: [
          "justify-center p-0",
          "size-8 rounded-control bg-transparent",
          "[&_svg]:size-[18px] [&_svg]:text-foreground-muted",
        ],
      },
      false: {},
    },
  },
  defaultVariants: {
    iconOnly: false,
  },
});

export type MessageFooterVariantProps = VariantProps<typeof messageFooter>;
