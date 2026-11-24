import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isHostShell } from "../../embed";
import { useIntl } from "react-intl";
import { Blocks, Bookmark, CircleHelp, Search, Settings, ListTodo, Inbox } from "lucide-react";
import { useFeedbackUnread } from "../../feedback/useFeedbackUnread";
import { useAuthStore } from "../../store/authStore";
import { useServerStore } from "../../store/serverStore";
import type { Server } from "../../store/serverStore";
import { useMessageStore } from "../../store/messageStore";
import { useInboxStore } from "../../store/inboxStore";
import { useChannelStore } from "../../store/channelStore";
import { useInboxForMeCount } from "../../features/thread/inboxForMe";
import { SERVER_NOTIFICATION_PREFS_UPDATED_EVENT } from "../../store/events/notificationPrefsEvents";
import type { RailMode } from "../../hooks/useSidebarTab";
import { useRailMode } from "../../hooks/useSidebarTab";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import { trackActivityOpen } from "../../analytics/activity";
import { trackNavEntrySelected } from "../../analytics/navigation";
import { OttieRailAvatar } from "../../assistant/OttieRailAvatar";
import { useRememberedAssistantShown } from "./useRememberedSidebarEntry";
import {
  hasCurrentServerActivityUnread,
  hasOtherServerActivityUnread,
} from "../../utils/serverUnreadSummary";
import { countMachinesNeedingAttention } from "../../utils/computerUpgradeIndicator";
import { useComputerAttentionDot, useMarkComputerAttentionSeen } from "../../hooks/useComputerAttentionDot";
import { useAppsPageAttention } from "./serverPagesAttention";
import { useArtifactsRailShown } from "./artifactsRailEntry";
import { PublicServerSwitcherTrigger } from "./PublicServerSwitcherTrigger";
import { RailTabButton } from "./RailTabButton";
import { TeamRailTab } from "./TeamRailTab";
import { useTeamAttentionMachines } from "../../utils/teamComputerAttention";
import AvatarSlot from "../ui/AvatarSlot";
import ServerSwitcherMenu from "../ui/ServerSwitcherMenu";
import {
  AppRailFooter,
  AppRailHeader,
  AppRailItem,
  AppRailItemAttention,
  AppRailItemIcon,
  AppRailNav,
  AppRailRoot,
  Popover,
  PopoverTrigger,
} from "@botiverse/raft-ui";
import { MessageIcon, ArtifactIcon } from "@botiverse/ricons";
import Tooltip from "../ui/Tooltip";
import { HelpMenu } from "./HelpMenu";
import { HELP_MENU_TRIGGER_ID } from "../../features/keyboard-shortcuts/shortcutHelpStore";
import { useFirstScreenDone } from "../../boot/deferredUi";
import { useShellPending } from "./shellPending";
import { isSidebarSlotHidden, setSidebarSlotHidden } from "./sidebarToggle";
import { SortableRailTabs } from "./SortableRailTabs";
import type { RailTab, RailTabDrag } from "./SortableRailTabs";
import { hasChatAttentionUnread, selectChatAttentionChannelIds } from "../../utils/chatAttentionUnread";
import { useShallow } from "zustand/react/shallow";
import { markMobileAppSeen, shouldShowMobileAppBadge } from "./mobileAppBadge";
import { useLongPress } from "../../hooks/useLongPress";
import { ThemeEditorPopover } from "../../features/theme-editor/ThemeEditorPopover";

// Narrow vertical rail to the left of the Sidebar. Hosts, top to bottom:
// 1. Server avatar / switcher button (clicking opens a flyout to switch servers)
// 2. Rail mode buttons. The selection derives from the URL.
//
// Rail mode is path-based, read through the route table
// (navigation/surfaces.ts). Clicking a rail button lands on that tab's place
// (hooks/placeMemory.ts: its last page with only the page's own params, never
// a pane), or on the tab's home with nothing remembered.
//
// Hidden on mobile root inline view: mobile already has its own bottom tab bar
// and the sidebar is the whole main area, so a second vertical rail there would
// just steal width.
const EMPTY_SERVER_UNREAD_COUNTS = {};

const TOOLTIP_CONTENT_PROPS = {
  left: { side: "left" },
  right: { side: "right" },
} as const;

// Double-clicking Activity jumps straight to the first unread entry.
export function focusFirstUnreadActivity() {
  useInboxStore.getState().setPendingFocusKind("first-unread");
  void useInboxStore.getState().loadInbox({ reset: true, reason: "manual" });
}

interface LeftRailProps {
  hidden?: boolean;
  /** The top bar owns the server switcher, search and notifications, so the rail drops them. */
  topBar?: boolean;
  publicProjection?: PublicLeftRailProjection;
}

export interface PublicLeftRailProjection {
  server: Pick<Server, "id" | "name" | "slug" | "avatarUrl">;
  authenticated: boolean;
  showHelp: boolean;
  activeMode: "chat" | "settings";
  onSelectMode: (mode: "chat" | "settings") => void;
  onSelectSettingsTab: (tab: "about" | "feedback") => void;
  onAnonymousServerSelection: () => void;
}

export function LeftRail({ hidden, topBar = false, publicProjection }: LeftRailProps) {
  // Display-language (react-intl) — layout namespace. Rail tab labels feed both
  // raft-ui Tooltip content and `aria-label`, so they must come from the catalog,
  // not literals.
  const { formatMessage } = useIntl();
  // A server still being resolved: the rail draws, but asks for and marks nothing.
  const pending = useShellPending();
  // Read once the first screen is done (boot/deferredUi).
  const firstScreenDone = useFirstScreenDone();
  const feedbackUnread = useFeedbackUnread(!hidden && !publicProjection && !pending && firstScreenDone);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const selfAvatarUrl = useAuthStore((s) => s.user?.avatarUrl ?? null);
  const selfName = useAuthStore((s) => s.user?.displayName || s.user?.name || "");
  const selfLabel = formatMessage({ id: "layout.leftRail.selfMenu" }, { name: selfName });
  const server = useServerStore((s) => s.current);
  const isGuest = server?.role === "guest";
  const servers = useServerStore((s) => s.servers);
  // Public discovery rows retain their gray row-level unread marker, but only
  // joined channels and DMs participate in the global pink Chat attention dot.
  // Keep the channel-id projection shallow so high-frequency channel activity
  // updates do not churn this rail subscription.
  // Muted rows show a quiet count, so they only light Chat where the row
  // itself does (a muted channel's @you marker; never a muted DM).
  const chatLoudChannelIds = useChannelStore(useShallow((s) =>
    selectChatAttentionChannelIds(s.channels, s.dmChannels).loud,
  ));
  const chatMutedChannelIds = useChannelStore(useShallow((s) =>
    selectChatAttentionChannelIds(s.channels, s.dmChannels).mutedChannels,
  ));
  const hasLocalChatUnread = useMessageStore((s) =>
    hasChatAttentionUnread({ loud: chatLoudChannelIds, mutedChannels: chatMutedChannelIds }, s.unreadCounts, s.mentionFlags),
  );
  // Keep this subscription on 0↔nonzero / accepted-window edges rather than
  // every count. Once Activity accepts a fresh server window, totalUnreadCount
  // owns the current-server dot; the cached cross-server summary remains only
  // a pre-load hint and cannot resurrect a read dot.
  const [hasAcceptedActivityWindow, hasActivityTotalUnread, hasPreloadActivityUnread] = useInboxStore(useShallow((s) => [
    s.hasAcceptedWindow,
    // Object rows (Artifacts) count apart from the conversations' (shared activityObjectsContract).
    s.totalUnreadCount + s.objectUnreadCount > 0,
    s.activeUnreadCount > 0,
  ] as const));
  // The Team page's attention rule (useTeamAttentionMachines): the same count as Needs you and the inbox.
  const teamAttentionMachines = useTeamAttentionMachines();
  const computerAttentionCount = countMachinesNeedingAttention(teamAttentionMachines);
  // Raft DS › Attention dots (raft-design #620): the dot marks an unseen
  // change; opening Computers sees it. The tooltip still counts the state.
  const showComputerAttentionDot = useComputerAttentionDot();
  const computerAttentionTooltip = showComputerAttentionDot && computerAttentionCount > 0
    // "1 computer needs attention" (Anna 11/16: "1 / 4" read as nothing).
    ? formatMessage({ id: "readiness.attention.computers" }, { count: computerAttentionCount })
    : undefined;
  const { railMode, currentMode, selectRailMode, savedPage } = useRailMode();
  const nav = useAppNavigate();
  // A Guest has no sidebar, so no Saved row in it (shellRouteLayout): its
  // Saved list has a rail entry of its own, selected on the Saved page in
  // place of Chat. A member's Saved stays the Chat sidebar's row.
  const guestSavedActive = isGuest && savedPage;
  const chatActive = railMode === "chat" && !guestSavedActive;
  const openGuestSaved = useCallback(() => {
    trackNavEntrySelected("saved", "rail", guestSavedActive);
    nav.toSaved();
  }, [guestSavedActive, nav]);
  // The Computers list is in view whenever the rail is in Computers mode
  // (the /computers root or a computer's detail): that sees its attention.
  useMarkComputerAttentionSeen(railMode === "computers" && !isGuest && !pending);
  // Apps (#proj-apps task #22): owners and admins see a dot while an App waits
  // for them; it goes out once that is handled (server computed), not on a visit.
  const appsAttention = useAppsPageAttention({ enabled: !hidden && !publicProjection && !pending && !isGuest });
  // Personal assistant (RFC 075): only where the server's flag is on; until
  // the assistant API answers, as last time here, so the icon does not land late.
  const showAssistant = useRememberedAssistantShown({ ask: !pending });
  const showArtifacts = useArtifactsRailShown(pending);

  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  // Single source of truth: the store owns the cross-server unread summary.
  const serverUnreadCounts = useServerStore((s) => s.serverUnreadCounts);
  const loadServerUnreadSummary = useServerStore((s) => s.loadServerUnreadSummary);

  // One-shot "there is a mobile app now" dot. Read from storage rather than
  // held in a store: it is per user and per device by construction (see
  // mobileAppBadge.ts), and `currentUserId` arrives after the first render on a
  // cold load, so the initial value has to be recomputed once it lands.
  //
  // Initialised lazily, and the effect below is a genuine no-op on mount.
  // Both halves are load-bearing against `leftRailActivityDotSubscription`,
  // which budgets the rail's commits:
  //   - `useState(false)` + effect  → the effect commits on every mount
  //   - identity-guarded setState   → still commits; a bailed-out setState is
  //                                   not a free one
  // Only skipping the call entirely is free. The effect still has to exist,
  // because on a cold load the auth store hydrates after the rail mounts — the
  // lazy value would then be computed with no user and the dot would never
  // appear for that session.
  const [showMobileAppBadge, setShowMobileAppBadge] = useState(
    () => shouldShowMobileAppBadge(currentUserId),
  );
  const badgeUserIdRef = useRef(currentUserId);
  useEffect(() => {
    if (badgeUserIdRef.current === currentUserId) return;
    badgeUserIdRef.current = currentUserId;
    setShowMobileAppBadge(shouldShowMobileAppBadge(currentUserId));
  }, [currentUserId]);
  const dismissMobileAppBadge = useCallback(() => {
    markMobileAppSeen(currentUserId);
    setShowMobileAppBadge(false);
  }, [currentUserId]);

  const _pathBase = useMemo(() => (server ? `/s/${server.slug}` : ""), [server]);

  useEffect(() => {
    if (publicProjection || pending) return;
    // No mount fetch here: App owns the single boot entry for the summary;
    // this effect keeps only the event triggers (prefs change, local-unread
    // edge via the dep below).
    const handleNotificationPrefsUpdated = () => {
      void loadServerUnreadSummary();
    };
    window.addEventListener(SERVER_NOTIFICATION_PREFS_UPDATED_EVENT, handleNotificationPrefsUpdated);
    return () => {
      window.removeEventListener(SERVER_NOTIFICATION_PREFS_UPDATED_EVENT, handleNotificationPrefsUpdated);
    };
    // The store coalesces concurrent calls, so this is a cheap trigger rather
    // than a second fetch. Refresh when local unread appears/clears (flip).
  }, [hasLocalChatUnread, publicProjection, pending, loadServerUnreadSummary]);

  const hasOtherServerUnread = useMemo(
    () => hasOtherServerActivityUnread(servers, server, serverUnreadCounts),
    [servers, server, serverUnreadCounts],
  );
  const currentServerActivityCount = server?.id
    ? serverUnreadCounts[server.id]?.activityUnreadCount
    : undefined;
  const hasActivityUnread = hasCurrentServerActivityUnread({
    hasAcceptedWindow: hasAcceptedActivityWindow,
    hasTotalUnread: hasActivityTotalUnread,
    hasPreloadActiveUnread: hasPreloadActivityUnread,
    summaryUnreadCount: currentServerActivityCount,
  });
  // Chat dot tracks unread in joined channels and DMs only; Activity has its
  // own rail entry, whose dot tracks the server-authoritative Activity count
  // independently of the selected Activity filter.
  const hasChatUnread = hasLocalChatUnread;

  // One rail popup at a time: opening the switcher closes Help.
  const handleServerMenuOpenChange = useCallback((open: boolean) => {
    if (open) setShowHelpMenu(false);
    setShowServerMenu(open);
  }, []);
  const closeServerMenu = useCallback(() => setShowServerMenu(false), []);
  // The switcher opens 8px right of the rail head, 4px below its top.
  const railHeaderRef = useRef<HTMLDivElement | null>(null);
  // Edit theme: a right-click or a long press on the server avatar opens it beside the rail head.
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const openThemeEditor = useCallback(() => {
    setShowServerMenu(false);
    setShowHelpMenu(false);
    setShowThemeEditor(true);
  }, []);
  const handleServerContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    openThemeEditor();
  }, [openThemeEditor]);
  const serverLongPress = useLongPress(openThemeEditor);
  const closeHelpMenu = useCallback(() => setShowHelpMenu(false), []);
  const railModeSelectors = useMemo(() => {
    const select = (mode: Exclude<RailMode, "activity">) => () => {
      trackNavEntrySelected(mode === "chat" ? "home" : mode, "rail", currentMode === mode);
      // Pressing the current tab again brings its folded column back (owner e563ebcc: a folded list with nothing open
      // beside it left no control to reopen it).
      if (mode === "chat" && currentMode === "chat" && isSidebarSlotHidden("sidebar")) setSidebarSlotHidden("sidebar", false);
      selectRailMode(mode);
    };
    return {
      search: select("search"),
      chat: select("chat"),
      tasks: select("tasks"),
      members: select("members"),
      apps: select("apps"),
      settings: select("settings"),
      assistant: select("assistant"),
      artifacts: select("artifacts"),
    };
  }, [currentMode, selectRailMode]);
  const handleClassicActivityClick = useCallback((event: React.MouseEvent) => {
    if (event.detail >= 2) return;
    trackActivityOpen("rail");
    trackNavEntrySelected("activity", "rail", currentMode === "activity");
    if (currentMode === "activity" && isSidebarSlotHidden("activityList")) setSidebarSlotHidden("activityList", false);
    selectRailMode("activity");
  }, [currentMode, selectRailMode]);
  // The navigation tabs this person can see, in no particular order:
  // SortableRailTabs lays them out in the person's saved order.
  // Team page: who is working shows on the Team tab itself (TeamRailTab's ring and preview).
  // The inbox badge counts what is waiting on me (the inbox's For me), not all Activity.
  const forMeCount = useInboxForMeCount();
  const railTabs = useMemo<RailTab[]>(() => {
    const tab = (id: RailTab["id"], label: string, button: (drag: RailTabDrag) => React.ReactNode): RailTab => ({ id, label, render: button });
    const tabs: RailTab[] = [];
    if (!topBar) {
      const label = formatMessage({ id: "layout.leftRail.tabSearch" });
      tabs.push(tab("search", label, ({ dragProps, guardClick }) => (
        <RailTabButton {...dragProps} icon={<Search size={18} />} label={label} active={railMode === "search"} onClick={guardClick(railModeSelectors.search)} testId="left-rail-tab-search" />
      )));
    }
    const chatLabel = formatMessage({ id: "layout.leftRail.tabChat" });
    tabs.push(tab("chat", chatLabel, ({ dragProps, guardClick }) => (
      <RailTabButton {...dragProps} icon={<MessageIcon width={18} height={18} />} label={chatLabel} active={chatActive} onClick={guardClick(railModeSelectors.chat)} showDot={hasChatUnread} dotInactiveOnly testId="left-rail-tab-chat" />
    )));
    // Layout redesign: Activity and the bell are one inbox, its unread counted on the rail.
    const activityLabel = formatMessage({ id: "layout.leftRail.tabInbox" });
    tabs.push(tab("activity", activityLabel, ({ dragProps, guardClick }) => (
      <RailTabButton
        {...dragProps}
        icon={<Inbox size={18} />}
        label={activityLabel}
        active={railMode === "activity"}
        showDot={hasActivityUnread}
        badgeCount={forMeCount}
        dotInactiveOnly
        onClick={guardClick(handleClassicActivityClick)}
        onDoubleClick={focusFirstUnreadActivity}
        testId="left-rail-tab-activity"
      />
    )));
    const tasksLabel = formatMessage({ id: "layout.leftRail.tabTasks" });
    tabs.push(tab("tasks", tasksLabel, ({ dragProps, guardClick }) => (
      <RailTabButton {...dragProps} icon={<ListTodo size={18} />} label={tasksLabel} active={railMode === "tasks"} onClick={guardClick(railModeSelectors.tasks)} testId="left-rail-tab-tasks" />
    )));
    if (showArtifacts) {
      const artifactsLabel = formatMessage({ id: "layout.leftRail.tabArtifacts" });
      tabs.push(tab("artifacts", artifactsLabel, ({ dragProps, guardClick }) => (
        <RailTabButton {...dragProps} icon={<ArtifactIcon width={18} height={18} />} label={artifactsLabel} active={railMode === "artifacts"} onClick={guardClick(railModeSelectors.artifacts)} testId="left-rail-tab-artifacts" />
      )));
    }
    if (!isGuest) {
      // Team (PRD 团队页 §4): Members and Computers are one tab, in Members' place (its saved order keeps the
      // "members" id); its pages are the Team page's tabs, so the tab is lit on either, and carries Computers' dot.
      tabs.push(tab("members", formatMessage({ id: "team.page.title" }), ({ dragProps, guardClick }) => (
        <TeamRailTab
          dragProps={dragProps}
          onClick={guardClick(railModeSelectors.members)}
          active={railMode === "members" || railMode === "computers"}
          attentionDot={showComputerAttentionDot}
          attentionTooltip={computerAttentionTooltip}
        />
      )));
      // The server's Apps, after Team; guests have none (#proj-apps task #22).
      const appsLabel = formatMessage({ id: "apps.page.title" });
      tabs.push(tab("apps", appsLabel, ({ dragProps, guardClick }) => (
        <RailTabButton
          {...dragProps}
          icon={<Blocks size={18} />}
          label={appsLabel}
          active={railMode === "apps"}
          showDot={appsAttention.lit}
          dotInactiveOnly
          dotTooltip={appsAttention.lit ? formatMessage({ id: "apps.page.needsReviewSummary" }) : undefined}
          onClick={guardClick(railModeSelectors.apps)}
          testId="left-rail-tab-apps"
        />
      )));
    }
    if (showAssistant) {
      const assistantLabel = formatMessage({ id: "layout.leftRail.tabAssistant" });
      tabs.push(tab("assistant", assistantLabel, ({ dragProps, guardClick }) => (
        <RailTabButton {...dragProps} icon={<OttieRailAvatar />} label={assistantLabel} active={railMode === "assistant"} onClick={guardClick(railModeSelectors.assistant)} testId="left-rail-tab-assistant" />
      )));
    }
    return tabs;
  }, [appsAttention.lit, chatActive, computerAttentionTooltip, formatMessage, handleClassicActivityClick, hasActivityUnread, hasChatUnread, isGuest, railMode, railModeSelectors, showArtifacts, showAssistant, showComputerAttentionDot, topBar, forMeCount]);
  const selectPublicChatMode = useCallback(() => publicProjection?.onSelectMode("chat"), [publicProjection]);
  const selectPublicSettingsMode = useCallback(() => publicProjection?.onSelectMode("settings"), [publicProjection]);
  const openPublicFeedback = useCallback(() => publicProjection?.onSelectSettingsTab("feedback"), [publicProjection]);
  const openPublicMobileApp = useCallback(() => publicProjection?.onSelectSettingsTab("about"), [publicProjection]);
  const handleAnonymousServerSelection = useCallback(() => {
    publicProjection?.onAnonymousServerSelection();
  }, [publicProjection]);

  const serverInitial = (server?.name || "S").trim().charAt(0).toUpperCase() || "S";

  if (hidden) return null;
  if (publicProjection) {
    // The public rail is the same raft-ui AppRail as the signed-in one.
    const publicServerTriggerLabel = formatMessage(
      { id: "layout.leftRail.switchServerAria" },
      { serverName: publicProjection.server.name },
    );
    // The avatar fills the button, so on selected it shrinks a step and the
    // selected card shows round it as a frame.
    const publicServerIcon = (
      <AppRailItemIcon>
        <AvatarSlot
          context="panel-header"
          type="server"
          serverAvatarUrl={publicProjection.server.avatarUrl}
          serverInitial={publicProjection.server.name}
          className="group-data-[selected=true]:!size-8 md:[@media(max-height:600px)]:!size-8 md:[@media(max-height:600px)]:group-data-[selected=true]:!size-7"
        />
      </AppRailItemIcon>
    );
    return (
      <AppRailRoot
        className="hidden shrink-0 pb-2 md:flex"
        data-testid="workspace-left-rail"
        data-otter-dock="rail"
        data-public-server-rail="true"
      >
        <AppRailHeader ref={railHeaderRef}>
          {publicProjection.authenticated ? (
            <Popover open={showServerMenu} onOpenChange={handleServerMenuOpenChange}>
              <Tooltip content={publicProjection.server.name} contentProps={TOOLTIP_CONTENT_PROPS.right}>
                <PopoverTrigger
                  render={<PublicServerSwitcherTrigger selected={showServerMenu} aria-label={publicServerTriggerLabel} />}
                >
                  {publicServerIcon}
                </PopoverTrigger>
              </Tooltip>
              <ServerSwitcherMenu
                onClose={closeServerMenu}
                serverUnreadCounts={EMPTY_SERVER_UNREAD_COUNTS}
                testId="desktop-server-switcher-menu"
                anchor={railHeaderRef}
                side="right"
                sideOffset={8}
                alignOffset={4}
                className="w-64"
              />
            </Popover>
          ) : (
            <Tooltip content={publicProjection.server.name} contentProps={TOOLTIP_CONTENT_PROPS.right}>
              <PublicServerSwitcherTrigger aria-label={publicServerTriggerLabel} onClick={handleAnonymousServerSelection}>
                {publicServerIcon}
              </PublicServerSwitcherTrigger>
            </Tooltip>
          )}
        </AppRailHeader>
        <AppRailNav>
          <RailTabButton
            icon={<MessageIcon width={18} height={18} />}
            label={formatMessage({ id: "layout.leftRail.tabChat" })}
            active={publicProjection.activeMode === "chat"}
            onClick={selectPublicChatMode}
            testId="left-rail-tab-chat"
          />
        </AppRailNav>
        <AppRailFooter>
          {publicProjection.showHelp ? (
            <Popover open={showHelpMenu} onOpenChange={setShowHelpMenu}>
              <div className="relative flex h-11 w-full items-center justify-center">
                <PopoverTrigger
                  openOnHover
                  delay={0}
                  closeDelay={120}
                  render={(
                    <RailTabButton
                      icon={<CircleHelp size={18} />}
                      label={formatMessage({ id: "layout.leftRail.tabHelp" })}
                      active={showHelpMenu}
                      onClick={closeServerMenu}
                      testId="left-rail-help"
                      ariaHasPopup="menu"
                      ariaExpanded={showHelpMenu}
                      showTooltip={false}
                      showDot={showMobileAppBadge}
                    />
                  )}
                />
                <HelpMenu
                  servers={servers}
                  serverSlugOverride={publicProjection.server.slug}
                  onClose={closeHelpMenu}
                  showMobileAppBadge={showMobileAppBadge}
                  onMobileAppOpened={dismissMobileAppBadge}
                  onOpenFeedback={openPublicFeedback}
                  onOpenMobileApp={openPublicMobileApp}
                />
              </div>
            </Popover>
          ) : null}
          <div className="flex h-11 w-full items-center justify-center">
            <RailTabButton
              icon={<Settings size={18} />}
              label={formatMessage({ id: "layout.leftRail.tabSettings" })}
              active={publicProjection.activeMode === "settings"}
              onClick={selectPublicSettingsMode}
              testId="left-rail-settings"
            />
          </div>
        </AppRailFooter>
      </AppRailRoot>
    );
  }
  // HOST-SHELL EMBED: the native WebView owns its chrome; this rail is global app
  // navigation and must not render inside it.
  //
  // Placed AFTER the hooks, not before: an early return ahead of them calls hooks
  // conditionally and breaks the Rules of Hooks (oxlint react-doctor caught exactly
  // that on my first attempt). It is still on the RENDER PATH — the very first frame
  // already returns null — so there is no flash. An effect would paint the rail on
  // frame 1 and delete it on frame 2, which the user sees and no "final DOM"
  // assertion can catch.
  if (isHostShell()) return null;

  return (
    <>
      <AppRailRoot
        className="hidden md:flex"
        data-testid="workspace-left-rail"
        data-otter-dock="rail"
      >
      {topBar ? null : (
      <>
      {/* Server switcher (top) */}
      <AppRailHeader ref={railHeaderRef}>
        <Popover open={showServerMenu} onOpenChange={handleServerMenuOpenChange}>
          <Tooltip
            content={server?.name || formatMessage({ id: "layout.leftRail.serverFallbackName" })}
            contentProps={TOOLTIP_CONTENT_PROPS.right}
          >
            <PopoverTrigger
              render={(
                <AppRailItem
                  selected={showServerMenu}
                  aria-label={formatMessage(
                    { id: "layout.leftRail.switchServerAria" },
                    { serverName: server?.name || formatMessage({ id: "layout.leftRail.serverFallbackName" }) },
                  )}
                  // The workspace block is a rail item: 40, 36 in short
                  // windows. No overflow-hidden: the avatar clips its own
                  // image, and the other-workspace unread dot sits on the
                  // button's corner. `group` lets the avatar read the item's
                  // selected state.
                  className="group size-(--rail-item) p-0 md:[@media(max-height:600px)]:size-9 md:pointer-fine:hover:bg-transparent md:pointer-fine:active:bg-transparent md:pointer-fine:data-[selected=true]:bg-transparent md:pointer-fine:cursor-pointer"
                  onContextMenu={handleServerContextMenu}
                  onTouchStart={serverLongPress.onTouchStart}
                  onTouchMove={serverLongPress.onTouchMove}
                  onTouchEnd={serverLongPress.onTouchEnd}
                  onTouchCancel={serverLongPress.onTouchCancel}
                  data-testid="left-rail-server"
                />
              )}
            >
              <AppRailItemIcon className="[&_[data-slot=app-rail-item-attention-mask]]:z-raised [&_[data-slot=app-rail-item-indicator]]:z-raised">
                {/* The avatar fills the button, so on selected it shrinks a
                    step and the selected card shows round it as a frame. */}
                <AvatarSlot
                  context="panel-header"
                  type="server"
                  serverAvatarUrl={server?.avatarUrl}
                  serverInitial={serverInitial}
                  // The desktop's 27 also by CSS: the boot shell, prerendered before any script reads the window,
                  // otherwise draws the phone's 35 (AvatarSlot picks `sm` with a media query).
                  className="md:pointer-fine:size-[27px] md:pointer-fine:*:text-[13px] group-data-[selected=true]:!size-8 md:[@media(max-height:600px)]:!size-8 md:[@media(max-height:600px)]:group-data-[selected=true]:!size-7"
                />
                {hasOtherServerUnread ? (
                  <AppRailItemAttention title={formatMessage({ id: "layout.leftRail.serverFallbackName" })} />
                ) : null}
              </AppRailItemIcon>
            </PopoverTrigger>
          </Tooltip>
          <ServerSwitcherMenu
            onClose={closeServerMenu}
            serverUnreadCounts={serverUnreadCounts}
            testId="desktop-server-switcher-menu"
            anchor={railHeaderRef}
            side="right"
            sideOffset={8}
            alignOffset={4}
            className="w-64"
          />
        </Popover>
        <ThemeEditorPopover open={showThemeEditor} onOpenChange={setShowThemeEditor} anchor={railHeaderRef} />
      </AppRailHeader>
      </>
      )}

      {/* Rail buttons (middle). Mutually-exclusive — at most one is
          highlighted at a time. */}
      <AppRailNav className="relative w-full">
        <SortableRailTabs tabs={railTabs} />
        {/* A Guest's Saved list (#triage:#551). Not one of the sortable tabs:
            only a Guest has it, so it follows them rather than taking a place
            in the account's one saved order (raft-shared RAIL_TAB_IDS). */}
        {isGuest ? (
          <div className="relative flex justify-center">
            <RailTabButton icon={<Bookmark size={18} />} label={formatMessage({ id: "layout.sidebar.saved" })} active={guestSavedActive} onClick={openGuestSaved} testId="left-rail-tab-saved" />
          </div>
        ) : null}
      </AppRailNav>

      {/* Raft redesign (Figma 精修 · 组件化): the footer is Settings, then your
          own avatar, whose menu holds Help (anxndsgn 11/20: Settings is a rail
          button above the avatar); the sidebar's collapse control leads the
          main area's head (SidebarToggleHeadAction). */}
      <AppRailFooter>
      {/* Layout redesign: the bell is part of the inbox (its head), not a rail button, loading or not (Figmama 11/21). */}
      <RailTabButton
        icon={<Settings size={18} />}
        label={formatMessage({ id: "layout.leftRail.tabSettings" })}
        active={railMode === "settings"}
        onClick={railModeSelectors.settings}
        showDot={feedbackUnread > 0}
        dotTooltip={feedbackUnread > 0 ? formatMessage({ id: "layout.systemNotifications.feedbackRepliesTitle" }) : undefined}
        testId="left-rail-settings"
      />

      <Popover open={showHelpMenu} onOpenChange={setShowHelpMenu}>
        <div className="relative flex w-full justify-center">
          <Tooltip content={selfLabel} contentProps={TOOLTIP_CONTENT_PROPS.right}>
            <PopoverTrigger
              render={(
                <AppRailItem
                  selected={false}
                  aria-label={selfLabel}
                  aria-haspopup="menu"
                  aria-expanded={showHelpMenu}
                  onClick={closeServerMenu}
                  data-testid="left-rail-self"
                  // Raft redesign (Figmama 11/21): a face shows no fill on hover or while its menu is open; the tooltip and the hand cursor say it is a button.
                  id={HELP_MENU_TRIGGER_ID}
                  className="size-(--rail-item) p-0 [@media(max-height:600px)]:h-9 [@media(max-height:600px)]:w-9 md:pointer-fine:hover:bg-transparent md:pointer-fine:active:bg-transparent md:pointer-fine:data-[selected=true]:bg-transparent md:pointer-fine:cursor-pointer"
                />
              )}
            >
              {/* On the round avatar the dot sits on its top right, 45° round, over its edge, with a 1px ring of the frame (Figmama 11/21). */}
              <AppRailItemIcon className="md:pointer-fine:[&_[data-slot=app-rail-item-indicator]]:top-px md:pointer-fine:[&_[data-slot=app-rail-item-indicator]]:right-px md:pointer-fine:[&_[data-slot=app-rail-item-indicator]]:ring-1 md:pointer-fine:[&_[data-slot=app-rail-item-indicator]]:ring-layer-frame">
                {/* Raft redesign (Figmama 11/20): with a mouse a 32px circle with no edge, as in a message. */}
                <AvatarSlot
                  context="compact-row"
                  type="human"
                  humanAvatarUrl={selfAvatarUrl}
                  className="md:pointer-fine:!size-8 md:pointer-fine:rounded-control md:pointer-fine:border-0 md:pointer-fine:shadow-none md:pointer-fine:[&_[data-slot=avatar-image]]:rounded-control md:pointer-fine:[&_[data-slot=avatar-fallback]]:rounded-control"
                />
                {showMobileAppBadge ? <AppRailItemAttention title={selfLabel} /> : null}
              </AppRailItemIcon>
            </PopoverTrigger>
          </Tooltip>
          <HelpMenu
            servers={servers}
            onClose={closeHelpMenu}
            showMobileAppBadge={showMobileAppBadge}
            onMobileAppOpened={dismissMobileAppBadge}
            keyboardShortcuts={!pending}
          />
        </div>
      </Popover>
      </AppRailFooter>
      </AppRailRoot>
    </>
  );
}

export default LeftRail;
