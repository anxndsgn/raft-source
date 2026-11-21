import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useHasChildElements, useWorkspaceExpandLayout } from "./workspaceExpand";
import { ShellPendingContext } from "./shellPending";
import { DESKTOP_SHELL_QUERY } from "./desktopShell";
import type { ReactNode } from "react";
import { AppShellIsland, AppShellIslandRow, AppShellMainSlot, AppShellRailSlot, AppShellRoot } from "@botiverse/raft-ui";
import { ShellWorkspaceIslandContext } from "./rowColumnSlot";
import { ShellSidebarToggleContext } from "./sidebarToggle";
import type { SidebarSlotColumn } from "./sidebarToggle";
import { useArtifactViewerStore } from "../../apps/artifacts/artifactViewerStore";
import { ShellTopBar } from "../topbar/ShellTopBar";
import PwaInstallPrompt from "../pwa/PwaInstallPrompt";
import { shouldShowTopBar } from "../topbar/topBarVisibility";
import { useTopBarHost } from "../topbar/topBarHostContext";
import { isHostShell } from "../../embed";
import { systemBarFill, useSystemBarSurface } from "../../theme/systemBarColor";
import type { SystemBarSurface } from "../../theme/systemBarColor";
import { useReleaseFocusOnUnmount } from "../../hooks/useReleaseFocusOnUnmount";

const SAFE_AREA_TOP = "env(safe-area-inset-top, 0px)";

/**
 * Desktop vs phone, on Tailwind's md breakpoint (768px), as the shell lays out.
 * A host-shell embed (embed.ts) is a phone at any width: the App's WebView on a
 * tablet or in the Compose desktop app is wide, but the native shell draws the
 * navigation, so a settings tab shows only that tab, never web's own sidebar
 * beside it (as ComputersRoute and ArtifactStandalonePage already do).
 */
export function useIsDesktopShell(): boolean {
  // No matchMedia (a test's DOM): a desktop.
  const [isDesktop, setIsDesktop] = useState(() => typeof window.matchMedia !== "function" || window.matchMedia(DESKTOP_SHELL_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(DESKTOP_SHELL_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop && !isHostShell();
}

/**
 * Whether the window shows the top bar (workspace switcher and search): at
 * desktop width, unless the host embed draws its own chrome; at
 * any width when a shell hands its chrome to it (topBarHostContext.ts).
 */
export function useShowsTopBar(isDesktop: boolean): boolean {
  const host = useTopBarHost();
  return shouldShowTopBar({
    hosted: host !== null,
    hostDesktopWidthOnly: host?.desktopWidthOnly === true,
    desktopWidth: isDesktop,
    hostShell: isHostShell(),
  });
}

export interface ShellFrameProps {
  isDesktop: boolean;
  /**
   * Whether the top bar shows; "md" leaves it to the stylesheet (from 768px
   * up), for the boot shell prerendered before any script knows the width.
   */
  showTopBar: boolean | "md";
  /** The surface at the top edge on a phone: the route's own header, or the frame. */
  topEdgeSurface: SystemBarSurface;
  sidebarCollapsible: boolean;
  sidebarOpen: boolean;
  /** The sidebar column a head's collapse control toggles (SidebarToggleHeadAction), or null where there is none. */
  sidebarToggle?: SidebarSlotColumn | null;
  onSidebarOpenChange?: (open: boolean) => void;
  /** The frame of a server still being resolved: drawn, not interactive, asks for nothing (ShellPendingContext). */
  pending?: boolean;
  /** Announced as loading (aria-busy); defaults to `pending`. The offline frame is pending but not loading. */
  busy?: boolean;
  /** A strip about the whole window, across its full width under the top bar (the open-in-app offers). */
  topStrip?: ReactNode;
  /**
   * A strip about the whole window at its bottom on a phone, in flow under the panes and above
   * the tab bar (the first thing in `after`): the open-in-app row, within thumb reach.
   */
  bottomStrip?: ReactNode;
  /** The rail's content (LeftRail). */
  rail: ReactNode;
  /** The sidebar slot, or null for routes without one. */
  sidebar: ReactNode;
  /** Hide the main column (a phone's master page, where the sidebar is the page). */
  mainHidden: boolean;
  /** The main column's content: the conversation and the thread column. */
  main: ReactNode;
  /** After the panes: the phone's tab bar, dialogs, overlays. */
  after?: ReactNode;
}

/**
 * The app's frame on a server: top bar, rail, sidebar and main column, the
 * same boxes whether the server's data is there (MainLayout) or still on its
 * way (PendingServerLayout). Layout only; whatever loads, loads inside it.
 */
export function ShellFrame({
  isDesktop,
  showTopBar,
  topEdgeSurface,
  sidebarCollapsible,
  sidebarOpen,
  sidebarToggle = null,
  onSidebarOpenChange,
  pending = false,
  busy = pending,
  topStrip,
  bottomStrip,
  rail,
  sidebar,
  mainHidden,
  main,
  after,
}: ShellFrameProps) {
  // The workspace island: ConversationFrame hands it to the channel's side area, which portals the open Artifact's column into it.
  const [workspaceIsland, setWorkspaceIsland] = useState<HTMLElement | null>(null);
  const [conversationMain, setConversationMain] = useState<HTMLElement | null>(null);
  // The workspace (an open Artifact) expanded, only while this page shows it: an Artifact left open in a channel
  // must not hide another page (an empty island and a hidden conversation left only the frame, anxndsgn 11/21).
  const workspaceShown = useHasChildElements(workspaceIsland);
  const viewerExpanded = useArtifactViewerStore((s) => s.expanded && s.open !== null) && isDesktop;
  const workspaceExpanded = viewerExpanded && workspaceShown;
  // Expanded, the workspace takes the channel list's room; the conversation keeps its width (Raft redesign 11/21).
  const heldConversationWidth = useWorkspaceExpandLayout({ shown: workspaceExpanded, expanded: viewerExpanded, conversationMain });
  const islandRowStyle = heldConversationWidth === null ? undefined : ({ "--ws-conversation-width": `${heldConversationWidth}px` } as CSSProperties);
  useSystemBarSurface(topEdgeSurface);
  // MainLayout is keyed by server: leaving one removes this whole shell, often with the composer focused.
  useReleaseFocusOnUnmount("[data-slot='app-shell-root']");
  const topEdgeFill = systemBarFill(topEdgeSurface);
  const shellStyle = useMemo(
    () => isDesktop
      // Tablet / desktop: only the inset strip wears the top bar's frame; the
      // rest of the shell stays canvas under the panes.
      ? {
        paddingTop: SAFE_AREA_TOP,
        backgroundImage: `linear-gradient(${topEdgeFill}, ${topEdgeFill})`,
        backgroundSize: `100% ${SAFE_AREA_TOP}`,
        backgroundRepeat: "no-repeat",
      }
      // Phone: the whole wrapper wears the route's top surface.
      : { paddingTop: SAFE_AREA_TOP, backgroundColor: topEdgeFill },
    [isDesktop, topEdgeFill],
  );

  return (
    <AppShellRoot
      // iOS standalone first-principles contract:
      // - browsers/PWA manifests default to theme yellow when route-level chrome
      //   cannot be applied reliably
      // - mobile detail routes still update theme-color and this wrapper to match
      //   their white top surface
      className="min-h-0 flex-1 flex-col font-display"
      framed
      // Standalone: the wrapper above the safe-area inset paints the route's
      // top-edge surface itself at every width, so the status-bar strip
      // matches `meta[theme-color]` (tasks #638, #140; ios-standalone-chrome spec).
      style={shellStyle}
      sidebarCollapsible={sidebarCollapsible}
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={onSidebarOpenChange}
      inert={pending || undefined}
      aria-busy={busy || undefined}
    >
      <ShellPendingContext.Provider value={pending}>
      <ShellSidebarToggleContext.Provider value={sidebarToggle}>
        {pending ? null : <PwaInstallPrompt />}

        {showTopBar === "md" ? (
          <div className="contents max-md:hidden"><ShellTopBar /></div>
        ) : showTopBar ? <ShellTopBar /> : null}

        {topStrip}

        <div className="flex min-h-0 flex-1">
          {/* Left rail — desktop only. Hosts the sidebar tab icons and Settings.
              On mobile the equivalent surfaces live in the in-Sidebar server
              header and the bottom MobileTabBar. */}
          <AppShellRailSlot>{rail}</AppShellRailSlot>

          {/* Raft redesign (Figma 精修 · 组件化): from 768px the sidebar and the
              conversation stand on the frame as one island, and the workspace
              (an open Artifact) as another beside it; empty, it is not drawn. */}
          <AppShellIslandRow data-workspace-expanded={workspaceExpanded ? "true" : undefined} style={islandRowStyle}>
            <AppShellIsland data-testid="conversation-island" inert={workspaceExpanded || undefined}>
              {sidebar}

              {/* The main slot's box. A collapsible shell positions the main
                  area absolutely inside it, sliding it left over the sidebar when
                  collapsed; it is always rendered so toggling never remounts the
                  routes. */}
              {/* data-otter-dock: an edge the assistant's otter can be dragged to (assistantOtterDock.ts). */}
              <div ref={setConversationMain} className={`relative min-h-0 min-w-0 flex-1 ${mainHidden ? "hidden" : "flex"}`} data-otter-dock="main" data-testid="conversation-island-main">
                <AppShellMainSlot
                  overlay
                  className={`relative ${mainHidden ? "hidden" : "flex"}`}
                >
                  <ShellWorkspaceIslandContext.Provider value={workspaceIsland}>
                    {main}
                  </ShellWorkspaceIslandContext.Provider>
                </AppShellMainSlot>
              </div>
            </AppShellIsland>
            {/* Visible overflow: its column's resize handle stands in the gap before it (ColumnResizeHandle gap). */}
            <AppShellIsland ref={setWorkspaceIsland} data-testid="workspace-island" className="flex-none empty:hidden md:overflow-visible" />
          </AppShellIslandRow>
        </div>

        {bottomStrip}

        {after}
      </ShellSidebarToggleContext.Provider>
      </ShellPendingContext.Provider>
    </AppShellRoot>
  );
}
