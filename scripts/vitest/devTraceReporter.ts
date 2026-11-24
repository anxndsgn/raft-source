// Raft customized: the source release ships this reporter without
// scripts/devtrace/ (Raft's own development-process trace upload), so the
// configs that import it could not even be bundled. This stand-in keeps their
// lazy import working and records nothing.
export function devTracePlugin(_packageName: string): { name: string } {
  return { name: "raft-dev-trace-disabled" };
}
