import type { McpAppListItem } from "@botiverse/raft-shared";
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import api from "../../../api/client";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { mcpAppErrorMessage } from "../../../components/settings/mcpApps/mcpAppApi";
import type { McpAppSectionId } from "../../../components/settings/mcpApps/mcpAppApi";
import type { InstalledConnectedApp } from "../connected-apps/connectedAppTypes";
import type { IntegrationOverviewItem } from "../connected-apps/oauthClientRecords";
import { InstalledAppsTable } from "./InstalledAppsTable";
import type { InstalledRow } from "./InstalledAppsTable";
import { McpAppDetailColumn } from "./McpAppDetailColumn";
import { QuickAddMcpDialog } from "./QuickAddMcpDialog";

/**
 * The Apps page's MCP parts (task #18): the Installed table, the detail column
 * beside it, the one-screen Add MCP and Remove's confirmation. IntegrationsSection
 * owns the lists and the full editor; this owns what is open.
 */
export function useAppsPageMcp({
  canManage,
  showDetail,
  mcpApps,
  shownMcpIds,
  installedApps,
  shownInstalledIds,
  integrationOverview,
  installedDetailId,
  reloadMcpApps,
  onMcpAppChanged,
  openEditor,
  openInstalledApp,
  requestUninstall,
  browseMcpMarketplace,
  clearError,
}: {
  canManage: boolean;
  /** The Installed tab is showing (the column sits beside its table only). */
  showDetail: boolean;
  mcpApps: McpAppListItem[];
  /** The MCP Apps and installed Apps that pass the toolbar's filters. */
  shownMcpIds: readonly string[];
  installedApps: InstalledConnectedApp[];
  shownInstalledIds: readonly string[];
  integrationOverview: IntegrationOverviewItem[];
  /** The installed App whose own detail dialog is open, for the row's selection. */
  installedDetailId: string | null;
  reloadMcpApps: () => void;
  onMcpAppChanged: () => void;
  openEditor: (appId: string | null, section?: McpAppSectionId) => void;
  openInstalledApp: (app: InstalledConnectedApp) => void;
  requestUninstall: (app: InstalledConnectedApp) => void;
  browseMcpMarketplace: () => void;
  clearError: () => void;
}) {
  const { formatMessage } = useIntl();
  const [detailMcpAppId, setDetailMcpAppId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<McpAppListItem | null>(null);

  const mcpKey = shownMcpIds.join(",");
  const installedKey = shownInstalledIds.join(",");
  const rows = useMemo((): InstalledRow[] => {
    // An installed App's Agents: those it is connected for now.
    const agentsByClient = new Map<string, Set<string>>();
    for (const item of integrationOverview) {
      if (item.type !== "active" || item.revokedAt) continue;
      const agents = agentsByClient.get(item.clientId) ?? new Set<string>();
      agents.add(item.agentName);
      agentsByClient.set(item.clientId, agents);
    }
    const mcpIds = new Set(mcpKey.split(","));
    const installedIds = new Set(installedKey.split(","));
    const custom = formatMessage({ id: "settings.connectedApps.mcp.custom" });
    const raft = formatMessage({ id: "settings.connectedApps.mcp.maintainedByRaft" });
    return [
      ...mcpApps.filter((app) => mcpIds.has(app.id)).map((app): InstalledRow => ({ kind: "mcp", app, developer: app.source.maintainedByRaft ? raft : custom })),
      ...installedApps.filter((app) => installedIds.has(app.id)).map((app): InstalledRow => ({ kind: "oauth", app, agentCount: agentsByClient.get(app.clientId)?.size ?? 0 })),
    ];
  }, [formatMessage, installedApps, installedKey, integrationOverview, mcpApps, mcpKey]);

  const selection = useMemo(() => (
    detailMcpAppId ? { kind: "mcp" as const, id: detailMcpAppId } : installedDetailId ? { kind: "oauth" as const, id: installedDetailId } : null
  ), [detailMcpAppId, installedDetailId]);

  const openRow = useCallback((row: InstalledRow) => {
    clearError();
    if (row.kind === "oauth") {
      setDetailMcpAppId(null);
      openInstalledApp(row.app);
    } else setDetailMcpAppId(row.app.id);
  }, [clearError, openInstalledApp]);
  // A Needs you row's one button: a lapsed sign-in or a missing key opens the editor on its
  // Connections (where signing in again lives); anything else opens the detail.
  const rowAction = useCallback((row: InstalledRow) => {
    if (row.kind === "mcp" && row.app.state === "needs_auth") {
      setDetailMcpAppId(row.app.id);
      openEditor(row.app.id, "connections");
      return;
    }
    openRow(row);
  }, [openEditor, openRow]);
  const removeRow = useCallback((row: InstalledRow) => {
    if (row.kind === "mcp") setRemoveTarget(row.app);
    else requestUninstall(row.app);
  }, [requestUninstall]);

  const openQuickAdd = useCallback(() => setQuickAddOpen(true), []);
  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);
  const quickAdded = useCallback((appId: string) => {
    setQuickAddOpen(false);
    reloadMcpApps();
    setDetailMcpAppId(appId);
  }, [reloadMcpApps]);
  const quickAddFullEditor = useCallback(() => {
    setQuickAddOpen(false);
    openEditor(null);
  }, [openEditor]);
  const quickAddMarketplace = useCallback(() => {
    setQuickAddOpen(false);
    browseMcpMarketplace();
  }, [browseMcpMarketplace]);

  const closeDetail = useCallback(() => setDetailMcpAppId(null), []);
  const detailEditor = useCallback((section?: McpAppSectionId) => {
    if (detailMcpAppId) openEditor(detailMcpAppId, section);
  }, [detailMcpAppId, openEditor]);
  const detailRemoved = useCallback(() => {
    setDetailMcpAppId(null);
    reloadMcpApps();
  }, [reloadMcpApps]);
  const closeRemove = useCallback(() => setRemoveTarget(null), []);
  const confirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    try {
      await api.delete(`/mcp/apps/${encodeURIComponent(removeTarget.id)}`);
    } catch (removeError) {
      throw new Error(mcpAppErrorMessage(removeError, formatMessage));
    }
    if (detailMcpAppId === removeTarget.id) setDetailMcpAppId(null);
    setRemoveTarget(null);
    reloadMcpApps();
  }, [detailMcpAppId, formatMessage, reloadMcpApps, removeTarget]);

  const table: ReactNode = (
    <InstalledAppsTable rows={rows} selected={selection} canManage={canManage} onOpen={openRow} onAction={rowAction} onRemove={removeRow} />
  );
  const detailColumn: ReactNode = detailMcpAppId && showDetail ? (
    <McpAppDetailColumn
      key={detailMcpAppId}
      appId={detailMcpAppId}
      canManage={canManage}
      onClose={closeDetail}
      onOpenEditor={detailEditor}
      onChanged={onMcpAppChanged}
      onRemoved={detailRemoved}
    />
  ) : null;
  const dialogs: ReactNode = canManage ? (
    <>
      {quickAddOpen ? (
        <QuickAddMcpDialog onClose={closeQuickAdd} onAdded={quickAdded} onOpenFullEditor={quickAddFullEditor} onBrowseMarketplace={quickAddMarketplace} />
      ) : null}
      {removeTarget ? (
        <ConfirmDialog
          title={formatMessage({ id: "settings.mcpApp.danger.deleteConfirmTitle" }, { name: removeTarget.name })}
          message={formatMessage({ id: "settings.mcpApp.danger.deleteConfirmMessage" }, { agents: removeTarget.enabledAgentCount, connections: removeTarget.status.connectionCount })}
          confirmLabel={formatMessage({ id: "apps.cap.action.remove" })}
          confirmTestId="apps-remove-mcp-confirm"
          onConfirm={confirmRemove}
          onClose={closeRemove}
          closeOnConfirm={false}
        />
      ) : null}
    </>
  ) : null;
  return { table, detailColumn, dialogs, openQuickAdd };
}
