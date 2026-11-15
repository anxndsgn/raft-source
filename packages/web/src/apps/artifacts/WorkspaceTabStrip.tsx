import { useCallback } from "react";
import { useIntl } from "react-intl";
import { X } from "lucide-react";
import type { ArtifactId } from "@botiverse/raft-shared";

import { useArtifactViewerStore } from "./artifactViewerStore";

/**
 * Layout redesign (workspace tabs, anxndsgn 11/15): above the viewer while
 * more than one Artifact is open in the workspace — one tab each, the shown
 * one marked; a tab shows it, its × closes it.
 */
const TAB_DRAG_TYPE = "application/x-raft-workspace-tab";

const allowTabDrop = (e: React.DragEvent) => {
  if (e.dataTransfer.types.includes(TAB_DRAG_TYPE)) e.preventDefault();
};

const dropAtEnd = (e: React.DragEvent) => {
  const from = e.dataTransfer.getData(TAB_DRAG_TYPE);
  if (!from) return;
  e.preventDefault();
  useArtifactViewerStore.getState().moveTab(from as ArtifactId, null);
};

export function WorkspaceTabStrip() {
  const tabs = useArtifactViewerStore((s) => s.tabs);
  const shownId = useArtifactViewerStore((s) => s.open?.id ?? null);
  if (tabs.length < 2) return null;
  return (
    <div className="flex h-9 shrink-0 items-end gap-1 overflow-hidden border-b border-line-hairline bg-fill-muted px-2" data-testid="workspace-tab-strip" onDragOver={allowTabDrop} onDrop={dropAtEnd}>
      {tabs.map((tab) => <WorkspaceTab key={tab.id} id={tab.id} shown={tab.id === shownId} />)}
    </div>
  );
}

function WorkspaceTab({ id, shown }: { id: ArtifactId; shown: boolean }) {
  const { formatMessage } = useIntl();
  const title = useArtifactViewerStore((s) => s.tabTitles[id]) ?? formatMessage({ id: "artifacts.card.loading" });
  const activate = useCallback(() => useArtifactViewerStore.getState().activateTab(id), [id]);
  const close = useCallback(() => useArtifactViewerStore.getState().closeTab(id), [id]);
  // Doc §5: a tab dragged onto another goes before it (onto the strip's end: last).
  const dragStart = useCallback((e: React.DragEvent) => { e.dataTransfer.setData(TAB_DRAG_TYPE, id); e.dataTransfer.effectAllowed = "move"; }, [id]);
  const drop = useCallback((e: React.DragEvent) => {
    const from = e.dataTransfer.getData(TAB_DRAG_TYPE);
    if (!from) return;
    e.preventDefault();
    e.stopPropagation();
    useArtifactViewerStore.getState().moveTab(from as ArtifactId, id);
  }, [id]);
  return (
    <div
      draggable
      onDragStart={dragStart}
      onDragOver={allowTabDrop}
      onDrop={drop}
      className={`group flex h-8 max-w-48 min-w-0 items-center gap-1 rounded-t-control border border-b-0 px-2 text-footnote ${shown ? "border-line-hairline bg-layer-canvas font-semibold text-foreground" : "border-transparent text-foreground-muted hover:bg-fill-medium"}`}
      data-testid={`workspace-tab-${id}`}
    >
      <button type="button" aria-pressed={shown} className="min-w-0 flex-1 truncate text-left outline-none" onClick={activate}>
        {title}
      </button>
      <button
        type="button"
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-control text-foreground-hint hover:text-foreground"
        aria-label={formatMessage({ id: "artifacts.viewer.close" })}
        onClick={close}
        data-testid={`workspace-tab-close-${id}`}
      >
        <X size={12} aria-hidden />
      </button>
    </div>
  );
}
