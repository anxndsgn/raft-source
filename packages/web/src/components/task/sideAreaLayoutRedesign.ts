import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Layout redesign (anxndsgn/Figmama 11/15): the channel's side panel is one place — a thread takes it, Tasks, Files
 * and the details step aside until it closes. `open`: the side area's open sections, changed in place.
 */
export function threadTakesSidePanel(open: Set<string>): void {
  open.add("thread");
  open.delete("tasks");
  open.delete("files");
  open.delete("details");
}

/** Layout redesign (F3): an Artifact's own column is the workspace, beside the channel's header (the workspace slot). */
export function inWorkspace(slot: HTMLElement | null | undefined, sections: readonly string[], node: ReactNode): ReactNode {
  return slot && sections.length === 1 && sections[0] === "artifact" ? createPortal(node, slot, sections.join("+")) : node;
}

/** The channel's info holds the side panel's place too: open, Tasks and Files step aside. */
export function detailsTakeSidePanel(open: Set<string>): void {
  if (!open.has("details")) return;
  open.delete("tasks");
  open.delete("files");
}
