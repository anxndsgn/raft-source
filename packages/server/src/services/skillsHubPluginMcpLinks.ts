// Plugins' remote MCP servers matched to this server's MCP Apps (task #22).
//
// A plugin's remote server is "served by Raft" for an agent when an MCP App on
// this server has the same endpoint, the agent has that App, and the App is
// ready for it. Then the runtime must not also start the plugin's own copy
// (which would ask for its own sign-in on each computer). When the App is not
// ready the plugin keeps its server, so nothing an agent could use is lost.
//
// Apps are matched by endpoint, not by a stored link: the same service enabled
// through two plugins, or added by hand before, is one App and one sign-in.

import type {
  ManagedMcpAgentCatalogResponse,
  SkillsHubAgentCatalogResponse,
  SkillsHubLaunchProjection,
  SkillsHubPluginMcpLink,
  SkillsHubPluginRemoteMcpServer,
} from "@botiverse/raft-shared";
import { listAgentManagedMcpCatalog } from "./managedMcpService";
import { pluginRemoteMcpServers } from "./skillsHubPluginMcp";

/** Launch must not wait long on GitHub: past this, plugins keep their own servers this time. */
const LAUNCH_LOOKUP_TIMEOUT_MS = 3_000;

/** One spelling per endpoint: lower-case host, no trailing slash, no fragment. */
export function endpointKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const text = parsed.toString();
    return text.endsWith("/") ? text.slice(0, -1) : text;
  } catch {
    return url.trim();
  }
}

type AgentApp = ManagedMcpAgentCatalogResponse["servers"][number];

function appState(app: AgentApp): SkillsHubPluginMcpLink["appState"] {
  const status = app.agentConnection?.status;
  if (!app.enabled || status === "disabled") return "unreachable";
  if (status === "ready") return "ok";
  return "needs_auth";
}

function agentHas(app: AgentApp): boolean {
  return (app.agentConnection?.mode ?? "off") !== "off";
}

/** The App per endpoint, preferring one this agent already has. */
function appsByEndpoint(catalog: ManagedMcpAgentCatalogResponse): Map<string, AgentApp> {
  const byEndpoint = new Map<string, AgentApp>();
  for (const app of catalog.servers) {
    const key = endpointKey(app.endpointUrl);
    const seen = byEndpoint.get(key);
    if (!seen || (!agentHas(seen) && agentHas(app))) byEndpoint.set(key, app);
  }
  return byEndpoint;
}

export function linkServers(servers: SkillsHubPluginRemoteMcpServer[], apps: Map<string, AgentApp>): SkillsHubPluginMcpLink[] {
  return servers.map((server) => {
    const app = apps.get(endpointKey(server.url)) ?? null;
    return {
      ...server,
      appId: app?.id ?? null,
      appState: app ? appState(app) : null,
      agentHasApp: app ? agentHas(app) : false,
    };
  });
}

/** Add each plugin's remote MCP servers and their Apps to an agent's hub catalog. */
export async function withPluginMcpLinks(
  serverId: string,
  agentId: string,
  catalog: SkillsHubAgentCatalogResponse,
): Promise<SkillsHubAgentCatalogResponse> {
  const plugins = catalog.items.filter((item) => item.kind === "plugin");
  if (plugins.length === 0) return catalog;
  const [apps, serversByItem] = await Promise.all([
    listAgentManagedMcpCatalog(serverId, agentId).then(appsByEndpoint),
    Promise.all(plugins.map(async (item) => [item.id, await pluginRemoteMcpServers(item.marketplaceSource, item.name)] as const)),
  ]);
  const servers = new Map(serversByItem);
  return {
    ...catalog,
    items: catalog.items.map((item) => {
      const found = servers.get(item.id);
      return found && found.length > 0 ? { ...item, remoteMcp: linkServers(found, apps) } : item;
    }),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

/** Mark, per enabled plugin, the servers a ready MCP App serves for this agent. */
export async function withMcpServersServedByRaft(
  serverId: string,
  agentId: string,
  projection: SkillsHubLaunchProjection,
): Promise<SkillsHubLaunchProjection> {
  if (projection.plugins.length === 0) return projection;
  const lookup = async (): Promise<SkillsHubLaunchProjection> => {
    const [apps, serversByPlugin] = await Promise.all([
      listAgentManagedMcpCatalog(serverId, agentId).then(appsByEndpoint),
      Promise.all(projection.plugins.map((plugin) => pluginRemoteMcpServers(plugin.marketplaceSource, plugin.name))),
    ]);
    return {
      ...projection,
      plugins: projection.plugins.map((plugin, index) => {
        const served = linkServers(serversByPlugin[index] ?? [], apps)
          .filter((link) => link.agentHasApp && link.appState === "ok")
          .map((link) => link.name);
        return served.length > 0 ? { ...plugin, mcpServersServedByRaft: served } : plugin;
      }),
    };
  };
  return withTimeout(lookup(), LAUNCH_LOOKUP_TIMEOUT_MS, projection);
}
