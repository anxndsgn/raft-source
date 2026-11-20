import { tv } from "../../lib/tv";

export const messageTranslation = tv({
  slots: {
    translationOriginal: [
      "not-italic", "mt-1",
      // Raft redesign (B9): with a mouse no fill, a 2px line of 15% ink.
      "md:pointer-fine:border-[color-mix(in_oklch,var(--foreground)_15%,transparent)] md:pointer-fine:bg-transparent",
    ],
    translationOriginalLabel: [
      "mb-0.5 font-mono text-mono-meta text-foreground-hint",
      // B9: with a mouse its label is the role tag: 16 high, 4 in, Medium 11/14 muted on 5% ink.
      "md:pointer-fine:mb-1 md:pointer-fine:flex md:pointer-fine:h-4 md:pointer-fine:w-fit md:pointer-fine:items-center md:pointer-fine:rounded-chip md:pointer-fine:bg-fill-medium md:pointer-fine:px-1",
      "md:pointer-fine:font-sans md:pointer-fine:text-[11px] md:pointer-fine:leading-[14px] md:pointer-fine:font-medium md:pointer-fine:text-foreground-muted",
    ],
    translationStatus: [
      "inline-flex items-center gap-1.5",
      "mt-1 font-mono text-mono-meta text-foreground-hint [&_svg]:size-3",
    ],
    translationFailedStatus: [
      "inline-flex items-center gap-1.5",
      "mt-1 font-mono text-mono-meta text-warning-strong",
      "[&_svg]:size-3",
    ],
    translationProgressTrack: ["h-1"],
    translationAction: [
      "inline-flex items-center gap-1",
      "rounded-[2px] font-sans text-caption font-semibold text-foreground",
      "decoration-[1.5px] underline-offset-[3px] hover:underline",
      "outline-none focus-visible:shadow-focus",
    ],
    translationRetryAction: [
      "inline-flex items-center gap-1",
      "rounded-[2px] font-sans text-caption font-semibold text-foreground",
      "decoration-[1.5px] underline-offset-[3px] hover:underline",
      "outline-none focus-visible:shadow-focus",
    ],
  },
});
