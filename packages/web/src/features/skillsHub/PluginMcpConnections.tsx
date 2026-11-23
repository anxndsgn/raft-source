// Task #22: a plugin's remote MCP servers, signed in once in Raft as MCP Apps.
//
// Under an enabled plugin, each remote server the plugin declares shows where
// it stands for this agent: served by Raft, waiting for a sign-in, or not yet
// in Raft. "Connect in Raft" saves an MCP App for the address (labelled with
// the plugin) and gives it to this agent; the sign-in then opens from the
// person's own click, as on the Apps page. Once the App is ready, the agent's
// runtime stops starting the plugin's own copy (on its next start).

import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { CheckCircle2, Plug } from "lucide-react";
import type { SkillsHubPluginMcpLink } from "@botiverse/raft-shared";
import api from "../../api/client";
import { Button, Spinner } from "@botiverse/raft-ui";
import { useMcpOAuthSignIn, type McpOAuthOutcome } from "../../components/settings/mcpApps/useMcpOAuthSignIn";
import { mcpAppErrorMessage, type McpAppView, type McpProbeResult } from "../../components/settings/mcpApps/mcpAppApi";

/** The agent gets (or loses) the plugin's Apps with the plugin. */
export async function setPluginAppsForAgent(agentId: string, links: SkillsHubPluginMcpLink[], enabled: boolean): Promise<void> {
  for (const link of links) {
    if (!link.appId || link.agentHasApp === enabled) continue;
    await api.put(`/mcp/agents/${encodeURIComponent(agentId)}/assignments/${encodeURIComponent(link.appId)}`, { enabled });
  }
}

function SignInButton({ appId, label, onDone, onError }: { appId: string; label: string; onDone: () => void; onError: (message: string) => void }) {
  const { formatMessage } = useIntl();
  const handleOutcome = useCallback((outcome: McpOAuthOutcome) => {
    if (outcome.kind === "connected") onDone();
    else onError(formatMessage({ id: outcome.kind === "closed" ? "apps.cap.add.signInClosed" : "apps.cap.add.signInFailed" }));
  }, [formatMessage, onDone, onError]);
  const handleStartError = useCallback((error: unknown) => onError(mcpAppErrorMessage(error, formatMessage)), [formatMessage, onError]);
  const { start, openSignInPage, blockedUrl, waiting, starting } = useMcpOAuthSignIn({ appId, onOutcome: handleOutcome, onStartError: handleStartError });
  if (blockedUrl) {
    return <Button type="button" variant="outline" size="sm" onClick={openSignInPage}>{formatMessage({ id: "apps.cap.add.openSignIn" })}</Button>;
  }
  return (
    <Button type="button" variant="outline" size="sm" disabled={waiting || starting} onClick={() => void start({ name: label, makeDefault: true })} data-testid={`plugin-mcp-signin-${label}`}>
      {waiting || starting ? <Spinner size="sm" aria-hidden="true" /> : null}
      {formatMessage({ id: waiting ? "apps.cap.add.signingIn" : "skillsHub.pluginMcp.signIn" })}
    </Button>
  );
}

export function PluginMcpConnections({ agentId, pluginName, links, canManage, onChanged }: {
  agentId: string;
  pluginName: string;
  links: SkillsHubPluginMcpLink[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const { formatMessage } = useIntl();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (link: SkillsHubPluginMcpLink) => {
    setBusy(link.name);
    setError(null);
    try {
      if (link.appId) {
        await setPluginAppsForAgent(agentId, [link], true);
      } else {
        const { data: probe } = await api.post<McpProbeResult>("/mcp/probe", { endpointUrl: link.url });
        if (probe.outcome === "unreachable" || probe.outcome === "headers") {
          setError(formatMessage({ id: probe.outcome === "headers" ? "skillsHub.pluginMcp.needsKey" : "skillsHub.pluginMcp.unreachable" }, { name: link.name }));
          return;
        }
        await api.post<McpAppView>("/mcp/apps", {
          source: { kind: "url", endpointUrl: link.url },
          profile: { name: link.name, description: formatMessage({ id: "skillsHub.pluginMcp.fromPlugin" }, { plugin: pluginName }) },
          authKind: probe.outcome === "oauth" ? "oauth" : "none",
          agentIds: [agentId],
        });
      }
      onChanged();
    } catch (connectError) {
      setError(mcpAppErrorMessage(connectError, formatMessage));
    } finally {
      setBusy(null);
    }
  }, [agentId, formatMessage, onChanged, pluginName]);

  if (links.length === 0) return null;
  return (
    <div className="stack-y-1 pb-2 pl-[34px] pr-3" data-testid={`plugin-mcp-${pluginName}`}>
      {links.map((link) => {
        const served = link.appId && link.agentHasApp && link.appState === "ok";
        return (
          <div key={link.name} className="flex items-center gap-2 text-caption">
            <Plug size={12} className="shrink-0 text-foreground-hint" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-foreground-muted">
              {link.name}
              <span className="ml-2 text-foreground-hint">
                {formatMessage({
                  id: served ? "skillsHub.pluginMcp.served"
                    : link.appId && link.agentHasApp ? "skillsHub.pluginMcp.needsSignIn"
                      : link.appId ? "skillsHub.pluginMcp.inRaftNotGranted"
                        : "skillsHub.pluginMcp.fromPluginOnly",
                })}
              </span>
            </span>
            {served ? <CheckCircle2 size={14} className="shrink-0 text-success-strong" aria-hidden="true" /> : canManage && (
              link.appId && link.agentHasApp
                ? <SignInButton appId={link.appId} label={link.name} onDone={onChanged} onError={setError} />
                : (
                  <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void connect(link)} data-testid={`plugin-mcp-connect-${link.name}`}>
                    {busy === link.name ? <Spinner size="sm" aria-hidden="true" /> : null}
                    {formatMessage({ id: "skillsHub.pluginMcp.connect" })}
                  </Button>
                )
            )}
          </div>
        );
      })}
      {error && <div className="text-caption text-danger" role="alert">{error}</div>}
    </div>
  );
}
