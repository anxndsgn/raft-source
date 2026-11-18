import { useCallback, useContext, useMemo } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useIntl } from "react-intl";
import { Maximize2, MessagesSquare, Minimize2, X } from "lucide-react";
import { ArtifactIcon } from "@botiverse/ricons";
import { ConversationPanelTabs, PanelToggleAction, SortableTabsList, SortableTabsTab, Tabs, TabsLabel } from "@botiverse/raft-ui";
import type { ArtifactId } from "@botiverse/raft-shared";

import Tooltip from "../../components/ui/Tooltip";
import { useArtifactViewerStore } from "./artifactViewerStore";
import { ShellSidebarToggleContext, SidebarToggleHeadAction } from "../../components/layout/appPanelHead";

/**
 * Layout redesign §5 (anxndsgn 11/15, A): the workspace's first row, always, as tall as the channel's head and on
 * its line — raft-ui's Tabs (the shown one the sticker), sortable by drag (SortableTabsList, as an agent's panel
 * tabs), one per Artifact or thread; Expand at the end. raft-ui has no closable tab: the × is laid over the tab, a
 * sibling (as the built-in browser's BrowserTabStrip); Delete or a middle click closes too.
 */
export function WorkspaceTabStrip() {
  const tabs = useArtifactViewerStore((s) => s.tabs);
  const shownId = useArtifactViewerStore((s) => s.open?.id ?? null);
  const expanded = useArtifactViewerStore((s) => s.expanded);
  // Expanded over the conversation, this row is the leftmost island's head: the sidebar's control leads it.
  const sidebarToggle = useContext(ShellSidebarToggleContext);
  const { formatMessage } = useIntl();
  const ids = useMemo(() => tabs.map((t) => t.id as string), [tabs]);
  const select = useCallback((id: string) => useArtifactViewerStore.getState().activateTab(id as ArtifactId), []);
  const reorder = useCallback((next: string[]) => useArtifactViewerStore.getState().reorderTabs(next), []);
  const toggleExpanded = useCallback(() => {
    const store = useArtifactViewerStore.getState();
    store.setExpanded(!store.expanded);
  }, []);
  if (tabs.length === 0) return null;
  const expandLabel = formatMessage({ id: expanded ? "artifacts.viewer.restore" : "artifacts.viewer.expand" });
  return (
    // One line under it, this row's, the channel head's (raft-ui Tabs' own seam is off: border-b-0 below). On a
    // desktop its end buttons sit 6px from the island's edge, as far as from its top and bottom (anxndsgn 11/18).
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line-seam pr-2 md:pointer-fine:h-panel-header md:pointer-fine:pr-1.5" data-testid="workspace-tab-strip">
      {expanded && sidebarToggle ? <SidebarToggleHeadAction column={sidebarToggle} className="ml-(--column-margin) shrink-0 md:pointer-fine:ml-1.5" /> : null}
      <ConversationPanelTabs className="flex h-full min-w-0 flex-1 items-center border-b-0" render={<Tabs<string> value={shownId ?? ""} onValueChange={select} />}>
        <SortableTabsList<string> value={ids} onReorder={reorder} aria-label={formatMessage({ id: "workspace.tabs" })}>
          {tabs.map((tab) => <WorkspaceTab key={tab.id} id={tab.id} thread={!!tab.thread} shown={tab.id === shownId} />)}
        </SortableTabsList>
      </ConversationPanelTabs>
      <Tooltip content={expandLabel}>
        <PanelToggleAction className="shrink-0" aria-label={expandLabel} pressed={expanded} onPressedChange={toggleExpanded} data-testid="artifact-viewer-expand">
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </PanelToggleAction>
      </Tooltip>
    </div>
  );
}

function WorkspaceTab({ id, thread, shown }: { id: ArtifactId; thread: boolean; shown: boolean }) {
  const { formatMessage } = useIntl();
  const title = useArtifactViewerStore((s) => s.tabTitles[id]) ?? formatMessage({ id: "artifacts.card.loading" });
  const close = useCallback(() => useArtifactViewerStore.getState().closeTab(id), [id]);
  const closeByPointer = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    close();
  }, [close]);
  const closeByKey = useCallback((event: KeyboardEvent) => {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    event.preventDefault();
    close();
  }, [close]);
  const closeByMiddle = useCallback((event: MouseEvent) => {
    if (event.button !== 1) return;
    event.preventDefault();
    close();
  }, [close]);
  const Icon = thread ? MessagesSquare : ArtifactIcon;
  return (
    <span className="group/tab grid max-w-48 min-w-0 flex-[0_1_auto] items-center *:col-start-1 *:row-start-1" data-testid={`workspace-tab-${id}`}>
      <SortableTabsTab
        value={id}
        title={title}
        aria-keyshortcuts="Delete"
        onKeyDown={closeByKey}
        onAuxClick={closeByMiddle}
        className={`w-full min-w-0 justify-start *:data-[slot=tabs-tab-content]:min-w-0 *:data-[slot=tabs-tab-content]:flex-1 ${shown ? "pr-7" : ""}`}
        data-testid="workspace-tab"
      >
        <Icon aria-hidden className={shown ? undefined : "group-hover/tab:invisible"} />
        <TabsLabel className="block min-w-0 truncate">{title}</TabsLabel>
      </SortableTabsTab>
      <button
        type="button"
        tabIndex={-1}
        aria-label={formatMessage({ id: "artifacts.viewer.close" })}
        onClick={closeByPointer}
        // The shown tab's × stays at its end; a tab behind shows it in its icon's place under the pointer.
        className={shown
          ? "z-raised mr-1.5 flex size-5 cursor-pointer items-center justify-center justify-self-end rounded-sticker border-0 bg-transparent p-0 text-sticker-ink hover:bg-fill-medium"
          : "invisible z-raised ml-2 flex size-5 cursor-pointer items-center justify-center justify-self-start rounded-sticker border-0 bg-transparent p-0 text-foreground-muted group-hover/tab:visible hover:bg-fill-medium"}
        data-testid={`workspace-tab-close-${id}`}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
