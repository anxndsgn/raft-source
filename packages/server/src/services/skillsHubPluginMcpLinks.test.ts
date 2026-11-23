import { describe, expect, it } from "vitest";
import { endpointKey, linkServers } from "./skillsHubPluginMcpLinks";

function app(id: string, endpointUrl: string, mode: "default" | "off", status: "ready" | "login_required" | "disabled", enabled = true) {
  return { id, endpointUrl, enabled, agentConnection: { mode, status, connectionName: null } } as never;
}

describe("endpointKey", () => {
  it("ignores host case, a trailing slash and the fragment", () => {
    expect(endpointKey("https://MCP.Cloudflare.com/mcp/")).toBe(endpointKey("https://mcp.cloudflare.com/mcp#x"));
    expect(endpointKey("https://a.example.com/mcp?client=x")).not.toBe(endpointKey("https://a.example.com/mcp"));
  });
});

describe("linkServers", () => {
  const server = (name: string, url: string) => ({ name, url, headerNames: [] });
  it("reports the App, whether the agent has it and whether it is ready", () => {
    const apps = new Map([
      [endpointKey("https://mcp.cloudflare.com/mcp"), app("cf", "https://mcp.cloudflare.com/mcp", "default", "ready")],
      [endpointKey("https://mcp.neon.tech/mcp"), app("neon", "https://mcp.neon.tech/mcp", "off", "login_required")],
      [endpointKey("https://off.example.com/mcp"), app("off", "https://off.example.com/mcp", "default", "disabled", false)],
    ]);
    expect(linkServers([
      server("cloudflare", "https://mcp.cloudflare.com/mcp/"),
      server("neon", "https://mcp.neon.tech/mcp"),
      server("off", "https://off.example.com/mcp"),
      server("new", "https://new.example.com/mcp"),
    ], apps).map(({ name, appId, appState, agentHasApp }) => ({ name, appId, appState, agentHasApp }))).toEqual([
      { name: "cloudflare", appId: "cf", appState: "ok", agentHasApp: true },
      { name: "neon", appId: "neon", appState: "needs_auth", agentHasApp: false },
      { name: "off", appId: "off", appState: "unreachable", agentHasApp: true },
      { name: "new", appId: null, appState: null, agentHasApp: false },
    ]);
  });
});
