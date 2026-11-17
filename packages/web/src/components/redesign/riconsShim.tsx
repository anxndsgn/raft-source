/**
 * Redesign test (task #20): the thread glyph from @botiverse/ricons drawn
 * with Raft's own icon set (also inside raft-ui). Wired in vite.config.ts.
 */
import type { SVGProps } from "react";
import { RIcon } from "./icons";

// @ts-expect-error vite alias to the real package (redesign test)
export * from "@botiverse/ricons/real";

export function ThreadIcon(props: SVGProps<SVGSVGElement>) {
  return <RIcon {...props} name="thread" />;
}
