import { useCallback } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/**
 * A drawer over one region (raft-design drawer.md › A drawer over one region): not modal — it covers one region (the
 * timeline), leaving the ones around it usable, so it has no scrim over the window and doesn't trap focus. Open, it
 * stands at the region's right edge with the float elevation on its leading edge, and `layer-veil` over the strip
 * of the region still visible; a press on that strip, or Escape inside it, collapses it. Collapsing keeps what it
 * holds. Put it in the region's box (`position: relative`). `width`: its own (the column's default), capped at 92%.
 */
export function RegionDrawer({ onCollapse, collapseLabel, width = 560, className, children, ...props }: {
  onCollapse: () => void;
  /** The veil's name: what pressing it does ("Collapse the workspace"). */
  collapseLabel: string;
  width?: number;
  className?: string;
  children: ReactNode;
  "data-testid"?: string;
}) {
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    onCollapse();
  }, [onCollapse]);
  return (
    <>
      <button type="button" aria-label={collapseLabel} onClick={onCollapse} className="absolute inset-0 z-cover cursor-default bg-layer-veil" data-testid="region-drawer-veil" />
      <div
        {...props}
        onKeyDown={onKeyDown}
        style={{ width: `min(${width}px, 92%)` }}
        className={`absolute inset-y-0 right-0 z-cover flex border-l border-line-seam bg-layer-canvas shadow-float ${className ?? ""}`}
      >
        {children}
      </div>
    </>
  );
}

/**
 * The collapsed drawer's handle at the region's right edge: its name and a count in Space Mono ("Workspace 2"); a
 * press slides the drawer back.
 */
export function RegionDrawerHandle({ label, count, onExpand, ...props }: {
  label: string;
  count: number;
  onExpand: () => void;
  "data-testid"?: string;
}) {
  return (
    <button
      type="button"
      {...props}
      aria-label={`${label} ${count}`}
      onClick={onExpand}
      className="absolute top-1/2 right-0 z-cover flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-container border border-r-0 border-line-seam bg-layer-canvas px-1.5 py-3 text-footnote font-semibold text-foreground shadow-float hover:bg-fill-medium"
    >
      <ChevronLeft size={14} aria-hidden />
      <span className="[writing-mode:vertical-rl]">{label} <span className="font-mono">{count}</span></span>
    </button>
  );
}
