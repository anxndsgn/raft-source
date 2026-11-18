import { createRequire } from "node:module";
import { resolve } from "node:path";

/**
 * Raft's own icon set (src/icons/raftIcons.tsx, drawn by Eva in the Raft
 * Icons file, page "Icons · 20") stands in for every lucide-react and
 * @botiverse/ricons glyph it has a counterpart for. raft-ui's components
 * import the same two packages, so they get the new icons too. Icons with no
 * counterpart fall through to the real packages.
 */
export function iconAliases(webRoot: string) {
  const require = createRequire(resolve(webRoot, "package.json"));
  return [
    { find: /^lucide-react$/, replacement: resolve(webRoot, "src/icons/lucideShim.tsx") },
    { find: /^@botiverse\/ricons\/real$/, replacement: require.resolve("@botiverse/ricons") },
    { find: /^@botiverse\/ricons$/, replacement: resolve(webRoot, "src/icons/riconsShim.tsx") },
  ];
}
