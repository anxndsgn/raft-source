import type { ReactNode } from "react";

/**
 * The row under a tab bar that says where the tab's content came from (raft-design tabs.md › Where a tab's content
 * came from): the source on the left in caption, muted, cut with an ellipsis; the content's actions on the right,
 * "View in channel ›" last. As tall as the side panel's header beside it (`h-12`, `h-panel-header` with a mouse), so
 * the lines under the two meet; its line is `line-seam`.
 */
export function SourceBar({ className, children, ...props }: { className?: string; children: ReactNode; "data-testid"?: string }) {
  return (
    <div {...props} className={`flex h-12 shrink-0 items-center gap-2 border-b border-line-seam px-(--column-margin,16px) md:pointer-fine:h-panel-header ${className ?? ""}`}>
      {children}
    </div>
  );
}

/** The source: `来自 #general · Anna · v2 · 3 条评论`. */
export function SourceBarText({ children }: { children: ReactNode }) {
  return <span className="min-w-0 flex-1 truncate text-caption text-foreground-muted">{children}</span>;
}

/** The actions, at the end: icon buttons (raft-ui PanelAction), then View in channel. */
export function SourceBarActions({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-1">{children}</div>;
}
