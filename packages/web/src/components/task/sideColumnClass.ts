import type { SideCardsMode } from "./sideCardsLayout";

/** The channel's side column's box (ChannelSideArea): in the row, floating, or covering the panel. */
export function columnClass(kind: SideCardsMode, inIsland = false): string {
  switch (kind) {
    case "overlay":
      return "absolute inset-0 z-cover flex bg-layer-canvas";
    case "float":
      // Over the right of the messages, flat against the panel's top and
      // right edges and stopping above the composer (bottom set inline).
      // Flat like a column, raised by the shadow alone. At most 58% of the
      // panel and 360px, so part of the messages stays readable. The column
      // always draws its bottom edge; a folded head at the bottom draws no
      // line of its own (data-stack-end), so the two don't double.
      return "absolute top-0 right-0 z-float flex border-b border-l border-line-seam bg-layer-canvas shadow-float [width:min(360px,max(280px,58%),calc(100%-24px))]";
    case "beside":
      // Full height in the row, a seam on its left like the thread column's.
      // Its width is its basis; it gives way to its minimum before the
      // channel drops under 360px (index.css), and floats past that.
      // In the workspace island no seam (the island's ring is its edge), the island's corners.
      return inIsland ? "relative flex shrink rounded-island bg-layer-canvas" : "relative flex shrink border-l border-line-seam bg-layer-canvas";
  }
}
