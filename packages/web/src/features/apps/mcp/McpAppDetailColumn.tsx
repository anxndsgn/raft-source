import { Badge, Button, ListRow, ListRowBody, ListRowChevron, ListRowGroup, ListRowTitle, ListRowValue, ScrollArea, Skeleton } from "@botiverse/raft-ui";
import { Maximize2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import api from "../../../api/client";
import { McpTag } from "../../../components/apps/AppsListParts";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { ConnectedAppLogo } from "../../../components/settings/ConnectedAppLogo";
import { mcpAppErrorMessage } from "../../../components/settings/mcpApps/mcpAppApi";
import type { McpAppSectionId, McpAppView } from "../../../components/settings/mcpApps/mcpAppApi";
import Banner from "../../../components/ui/Banner";
import AppTooltip from "../../../components/ui/Tooltip";
import { CONNECTED_APP_CATEGORY_LABEL_ID } from "../connected-apps/connectedAppCatalog";
import { McpAppAgentsEditor } from "./McpAppAgentsEditor";

function endpointHost(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * An MCP App's detail beside the Installed list (task #18, Figmama C1): its
 * state and Test, which Agents use it (checkable, Enable all / Turn all off),
 * its connection in three rows that open the full editor, and Remove.
 */
export function McpAppDetailColumn({ appId, canManage, onClose, onOpenEditor, onChanged, onRemoved }: {
  appId: string;
  canManage: boolean;
  onClose: () => void;
  /** The full editor, at a section (the head's Expand, the connection rows). */
  onOpenEditor: (section?: McpAppSectionId) => void;
  /** Anything the list shows changed (agents, state, tools). */
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const { formatMessage } = useIntl();
  // The parent keys this column by appId, so a new App starts from empty state.
  const [loaded, setLoaded] = useState<{ view: McpAppView | null; error: string }>({ view: null, error: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "failed" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const view = loaded.view;
  const error = loaded.error;
  const setView = useCallback((next: McpAppView) => setLoaded({ view: next, error: "" }), []);

  useEffect(() => {
    let cancelled = false;
    api.get<McpAppView>(`/mcp/apps/${encodeURIComponent(appId)}`)
      .then(({ data }) => { if (!cancelled) setLoaded({ view: data, error: "" }); })
      .catch((loadError: unknown) => { if (!cancelled) setLoaded({ view: null, error: mcpAppErrorMessage(loadError, formatMessage) }); });
    return () => { cancelled = true; };
  }, [appId, formatMessage]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post<McpAppView>(`/mcp/apps/${encodeURIComponent(appId)}/refresh`);
      setView(data);
      setTestResult(data.server.health.status === "unreachable" ? "failed" : "ok");
      onChanged();
    } catch {
      setTestResult("failed");
    } finally {
      setTesting(false);
    }
  }, [appId, onChanged, setView]);

  const handleRemove = useCallback(async () => {
    try {
      await api.delete(`/mcp/apps/${encodeURIComponent(appId)}`);
    } catch (removeError) {
      throw new Error(mcpAppErrorMessage(removeError, formatMessage));
    }
    setConfirmRemove(false);
    onRemoved();
  }, [appId, formatMessage, onRemoved]);

  const openEndpoint = useCallback(() => onOpenEditor("mcp_server"), [onOpenEditor]);
  const openConnections = useCallback(() => onOpenEditor("connections"), [onOpenEditor]);
  const openProfile = useCallback(() => onOpenEditor("profile"), [onOpenEditor]);
  const openEditor = useCallback(() => onOpenEditor(), [onOpenEditor]);
  const askRemove = useCallback(() => setConfirmRemove(true), []);
  const closeRemove = useCallback(() => setConfirmRemove(false), []);

  const name = view?.profile.name ?? "";
  const defaultConnection = view?.connections.find((connection) => connection.id === view.defaultConnectionId) ?? view?.connections[0] ?? null;
  const signInLapsed = view ? view.server.authKind !== "none" && (!defaultConnection || defaultConnection.status !== "ready") : false;
  const stateWord = !view ? "" : signInLapsed
    ? formatMessage({ id: view.server.authKind === "headers" ? "apps.cap.state.needsKey" : "apps.cap.state.needsSignIn" })
    : view.server.health.status === "unreachable" ? formatMessage({ id: "apps.cap.state.unreachable" }) : formatMessage({ id: "apps.cap.state.ok" });
  const stateVariant = !view ? "muted" : signInLapsed ? "warning" : view.server.health.status === "unreachable" ? "danger" : "success";
  const authValue = !view ? "" : view.server.authKind === "oauth"
    ? (defaultConnection?.accountLabel ?? formatMessage({ id: "apps.cap.detail.authOAuth" }))
    : view.server.authKind === "headers"
      ? (defaultConnection ? formatMessage({ id: "apps.cap.detail.authKeySet" }) : formatMessage({ id: "apps.cap.detail.authKeyMissing" }))
      : formatMessage({ id: "apps.cap.detail.authNone" });
  const category = view ? formatMessage({ id: CONNECTED_APP_CATEGORY_LABEL_ID[view.profile.category ?? "Other"] ?? "settings.connectedApps.categoryOther" }) : "";
  const source = view ? formatMessage({ id: view.source.maintainedByRaft ? "settings.connectedApps.mcp.maintainedByRaft" : "settings.connectedApps.mcp.custom" }) : "";

  return (
    <aside
      className="flex h-full min-h-0 w-[400px] shrink-0 flex-col border-l border-line-hairline bg-layer-canvas max-md:fixed max-md:inset-0 max-md:z-40 max-md:w-full max-md:border-l-0 max-md:safe-bottom"
      aria-label={formatMessage({ id: "apps.cap.detail.label" }, { name })}
      data-testid="apps-detail-column"
    >
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line-hairline px-4">
        <h2 className="mr-auto min-w-0 truncate text-body font-bold" data-testid="apps-detail-title">{name}</h2>
        {canManage ? (
          <AppTooltip content={formatMessage({ id: "apps.cap.detail.openEditor" })}>
            <Button type="button" size="icon-md" variant="ghost" aria-label={formatMessage({ id: "apps.cap.detail.openEditor" })} onClick={openEditor} data-testid="apps-detail-expand">
              <Maximize2 aria-hidden />
            </Button>
          </AppTooltip>
        ) : null}
        <AppTooltip content={formatMessage({ id: "apps.cap.detail.close" })}>
          <Button type="button" size="icon-md" variant="ghost" aria-label={formatMessage({ id: "apps.cap.detail.close" })} onClick={onClose} data-testid="apps-detail-close">
            <X aria-hidden />
          </Button>
        </AppTooltip>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {error ? <div className="px-4 pt-3"><Banner intent="warning" density="sm" data-testid="apps-detail-error">{error}</Banner></div> : null}
        {!view ? (
          error ? null : (
            <div className="stack-y-3 p-4" aria-busy="true">
              <Skeleton variant="line" className="w-40" />
              <Skeleton variant="line" className="w-56" />
              <Skeleton variant="line" className="w-32" />
            </div>
          )
        ) : (
          <>
            <section className="stack-y-3 border-b border-line-hairline p-4" data-testid="apps-detail-summary">
              <div className="flex items-center gap-3">
                <ConnectedAppLogo name={name} logoUrl={view.profile.logoUrl} seed={view.id} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-body font-bold">{name}</span>
                    <McpTag />
                  </div>
                  <p className="truncate text-footnote text-foreground-muted">{[category, source].join(" · ")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge appearance="soft" variant={stateVariant} data-testid="apps-detail-state">{stateWord}</Badge>
                <span className="font-mono text-mono-meta text-foreground-hint">
                  {view.server.toolCount > 0 ? formatMessage({ id: "apps.cap.tools.count" }, { count: view.server.toolCount }) : "–"}
                </span>
                {canManage ? (
                  <Button type="button" size="sm" variant="ghost" className="ml-auto" disabled={testing} onClick={handleTest} data-testid="apps-detail-test">
                    {formatMessage({ id: testing ? "apps.cap.detail.testing" : "apps.cap.detail.test" })}
                  </Button>
                ) : null}
              </div>
              {testResult ? (
                <p className={testResult === "ok" ? "text-footnote text-foreground-muted" : "text-footnote text-danger-strong"} data-testid="apps-detail-test-result">
                  {formatMessage({ id: testResult === "ok" ? "apps.cap.detail.testOk" : "apps.cap.detail.testFailed" })}
                </p>
              ) : null}
            </section>
            <div className="border-b border-line-hairline p-4">
              <McpAppAgentsEditor appId={appId} canManage={canManage} onChanged={onChanged} testId="apps-detail-agents" />
            </div>
            <section className="border-b border-line-hairline px-4 py-3" data-testid="apps-detail-connection">
              <h4 className="pb-2 text-footnote font-bold text-foreground-hint">{formatMessage({ id: "apps.cap.detail.connection" })}</h4>
              <ListRowGroup>
                <ListRow onClick={openEndpoint} disabled={!canManage} data-testid="apps-detail-endpoint">
                  <ListRowBody><ListRowTitle>{formatMessage({ id: "apps.cap.detail.endpoint" })}</ListRowTitle></ListRowBody>
                  <ListRowValue className="max-w-[200px] truncate font-mono text-mono-meta" title={view.server.endpointUrl}>{endpointHost(view.server.endpointUrl)}</ListRowValue>
                  <ListRowChevron />
                </ListRow>
                <ListRow onClick={openConnections} disabled={!canManage} data-testid="apps-detail-auth">
                  <ListRowBody><ListRowTitle>{formatMessage({ id: "apps.cap.detail.auth" })}</ListRowTitle></ListRowBody>
                  <ListRowValue className="max-w-[200px] truncate">{authValue}</ListRowValue>
                  <ListRowChevron />
                </ListRow>
                <ListRow onClick={openProfile} disabled={!canManage} data-testid="apps-detail-more">
                  <ListRowBody><ListRowTitle>{formatMessage({ id: "apps.cap.detail.more" })}</ListRowTitle></ListRowBody>
                  <ListRowValue className="max-w-[200px] truncate">{formatMessage({ id: "apps.cap.detail.moreHint" })}</ListRowValue>
                  <ListRowChevron />
                </ListRow>
              </ListRowGroup>
            </section>
            {canManage ? (
              <div className="p-4">
                <Button type="button" size="md" variant="danger" onClick={askRemove} data-testid="apps-detail-remove">
                  <Trash2 size={16} aria-hidden />
                  {formatMessage({ id: "apps.cap.action.remove" })}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </ScrollArea>
      {confirmRemove && view ? (
        <ConfirmDialog
          title={formatMessage({ id: "settings.mcpApp.danger.deleteConfirmTitle" }, { name })}
          message={formatMessage({ id: "settings.mcpApp.danger.deleteConfirmMessage" }, { agents: view.agentsSummary.total, connections: view.connections.length })}
          confirmLabel={formatMessage({ id: "apps.cap.action.remove" })}
          confirmTestId="apps-detail-remove-confirm"
          onConfirm={handleRemove}
          onClose={closeRemove}
          closeOnConfirm={false}
        />
      ) : null}
    </aside>
  );
}
