// Task #22: a plugin's remote MCP servers, signed in once in Raft as MCP Apps.
//
// Under an enabled plugin, each remote server the plugin declares shows where
// it stands for this agent: served by Raft, or signed in on each computer.
// One "Sign in" saves an MCP App for the address (labelled with the plugin),
// gives it to this agent and opens the provider's sign-in, all in one click.
// Once the App is ready, the agent's runtime stops starting the plugin's own
// copy (on its next start).

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

/** Save the plugin server as an App for this agent (or give the agent the existing one); returns its id. */
async function ensureAppForAgent(agentId: string, pluginName: string, link: SkillsHubPluginMcpLink, describe: (plugin: string) => string): Promise<{ appId: string; auth: "oauth" | "none" }> {
  if (link.appId) {
    await setPluginAppsForAgent(agentId, [link], true);
    return { appId: link.appId, auth: link.appState === "ok" ? "none" : "oauth" };
  }
  const { data: probe } = await api.post<McpProbeResult>("/mcp/probe", { endpointUrl: link.url });
  if (probe.outcome === "unreachable" || probe.outcome === "headers") throw new PluginMcpProbeError(probe.outcome, link.name);
  const auth = probe.outcome === "oauth" ? "oauth" : "none";
  const { data } = await api.post<McpAppView>("/mcp/apps", {
    source: { kind: "url", endpointUrl: link.url },
    profile: { name: link.name, description: describe(pluginName) },
    authKind: auth,
    agentIds: [agentId],
  });
  return { appId: data.id, auth };
}

class PluginMcpProbeError extends Error {
  constructor(readonly outcome: "unreachable" | "headers", readonly serverName: string) {
    super(outcome);
  }
}

/**
 * One button (Anna 5110322f): it saves the App and gives it to the agent if needed, then opens the
 * provider's sign-in, all from the same click. A sign-in closed half-way leaves the App, so the next
 * click picks up from there. A server that needs no sign-in is just connected.
 */
function SignInButton({ agentId, pluginName, link, onDone }: {
  agentId: string;
  pluginName: string;
  link: SkillsHubPluginMcpLink;
  onDone: (error: string | null) => void;
}) {
  const { formatMessage } = useIntl();
  const handleOutcome = useCallback((outcome: McpOAuthOutcome) => {
    onDone(outcome.kind === "connected" ? null : formatMessage({ id: outcome.kind === "closed" ? "apps.cap.add.signInClosed" : "apps.cap.add.signInFailed" }));
  }, [formatMessage, onDone]);
  const handleStartError = useCallback((error: unknown) => {
    if (error instanceof PluginMcpProbeError) {
      onDone(formatMessage({ id: error.outcome === "headers" ? "skillsHub.pluginMcp.needsKey" : "skillsHub.pluginMcp.unreachable" }, { name: error.serverName }));
    } else if (error instanceof NoSignInNeeded) {
      onDone(null);
    } else {
      onDone(mcpAppErrorMessage(error, formatMessage));
    }
  }, [formatMessage, onDone]);
  const { start, openSignInPage, blockedUrl, waiting, starting } = useMcpOAuthSignIn({ appId: link.appId ?? "", onOutcome: handleOutcome, onStartError: handleStartError });
  const describe = useCallback((plugin: string) => formatMessage({ id: "skillsHub.pluginMcp.fromPlugin" }, { plugin }), [formatMessage]);
  if (blockedUrl) {
    return <Button type="button" variant="outline" size="sm" onClick={openSignInPage}>{formatMessage({ id: "apps.cap.add.openSignIn" })}</Button>;
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={waiting || starting}
      onClick={() => void start({ name: link.name, makeDefault: true }, async () => {
        const { appId, auth } = await ensureAppForAgent(agentId, pluginName, link, describe);
        if (auth === "none") throw new NoSignInNeeded();
        return appId;
      })}
      data-testid={`plugin-mcp-signin-${link.name}`}
    >
      {waiting || starting ? <Spinner size="sm" aria-hidden="true" /> : null}
      {formatMessage({ id: waiting ? "apps.cap.add.signingIn" : link.appState === "ok" ? "skillsHub.pluginMcp.connect" : "skillsHub.pluginMcp.signIn" })}
    </Button>
  );
}

/** Not an error: the server needed no sign-in, so saving the App was all there was to do. */
class NoSignInNeeded extends Error {}

export function PluginMcpConnections({ agentId, pluginName, links, canManage, onChanged }: {
  agentId: string;
  pluginName: string;
  links: SkillsHubPluginMcpLink[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const { formatMessage } = useIntl();
  const [error, setError] = useState<string | null>(null);
  const done = useCallback((message: string | null) => {
    setError(message);
    onChanged();
  }, [onChanged]);

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
                {formatMessage({ id: served ? "skillsHub.pluginMcp.served" : "skillsHub.pluginMcp.fromPluginOnly" })}
              </span>
            </span>
            {served
              ? <CheckCircle2 size={14} className="shrink-0 text-success-strong" aria-hidden="true" />
              : canManage && <SignInButton agentId={agentId} pluginName={pluginName} link={link} onDone={done} />}
          </div>
        );
      })}
      {error && <div className="text-caption text-danger" role="alert">{error}</div>}
    </div>
  );
}
