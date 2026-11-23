import { describe, expect, it } from "vitest";
import { pluginPlace, readPluginRemoteMcpServers, remoteServersIn } from "./skillsHubPluginMcp";

function fakeGithub(files: Record<string, unknown>) {
  const asked: string[] = [];
  const fetchText = async (url: string) => {
    asked.push(url);
    const key = url.replace("https://raw.githubusercontent.com/", "");
    return key in files ? JSON.stringify(files[key]) : null;
  };
  return { fetchText, asked };
}

describe("remoteServersIn", () => {
  it("keeps https http servers, drops local, sse and templated ones", () => {
    expect(remoteServersIn({
      mcpServers: {
        live: { type: "http", url: "https://mcp.paddle.com/mcp" },
        untyped: { url: "https://mcp.example.com/mcp", headers: { Authorization: "Bearer x", "X-Bundle": "1" } },
        sse: { type: "sse", url: "https://sse.example.com/sse" },
        local: { command: "npx", args: ["thing"] },
        plain: { type: "http", url: "http://insecure.example.com/mcp" },
        templated: { type: "http", url: "https://${HOST}/mcp" },
        query: { type: "http", url: "https://mcp.context7.com/mcp?client=claude-code-plugin" },
        "bad name!": { type: "http", url: "https://x.example.com/mcp" },
      },
    })).toEqual([
      { name: "live", url: "https://mcp.paddle.com/mcp", headerNames: [] },
      { name: "untyped", url: "https://mcp.example.com/mcp", headerNames: ["Authorization", "X-Bundle"] },
    ]);
  });

  it("accepts a bare server map", () => {
    expect(remoteServersIn({ cf: { type: "http", url: "https://mcp.cloudflare.com/mcp" } }).map((s) => s.name)).toEqual(["cf"]);
  });
});

describe("pluginPlace", () => {
  const market = { owner: "o", repo: "m", ref: "HEAD", path: "" };
  it("resolves relative, pluginRoot, github and url sources", () => {
    expect(pluginPlace(market, {}, { source: "./plugins/neon" })).toEqual({ ...market, path: "plugins/neon" });
    expect(pluginPlace(market, { metadata: { pluginRoot: "plugins" } }, { source: "neon" })).toEqual({ ...market, path: "plugins/neon" });
    expect(pluginPlace(market, {}, { source: { source: "github", repo: "a/b" } })).toEqual({ owner: "a", repo: "b", ref: "HEAD", path: "" });
    expect(pluginPlace(market, {}, { source: { source: "url", url: "https://github.com/cloudflare/skills.git", sha: "abc" } }))
      .toEqual({ owner: "cloudflare", repo: "skills", ref: "abc", path: "" });
  });
  it("refuses paths that leave the repository and non-GitHub sources", () => {
    expect(pluginPlace(market, {}, { source: "../../etc" })).toBeNull();
    expect(pluginPlace(market, {}, { source: { source: "url", url: "https://gitlab.com/a/b.git" } })).toBeNull();
  });
});

describe("readPluginRemoteMcpServers", () => {
  it("reads inline, plugin.json and .mcp.json servers, first name wins", async () => {
    const { fetchText } = fakeGithub({
      "o/m/HEAD/.claude-plugin/marketplace.json": {
        name: "m",
        plugins: [{ name: "cloudflare", source: "./cf", mcpServers: { a: { type: "http", url: "https://a.example.com/mcp" } } }],
      },
      "o/m/HEAD/cf/.claude-plugin/plugin.json": { name: "cloudflare", mcpServers: "./servers.json" },
      "o/m/HEAD/cf/servers.json": { mcpServers: { b: { type: "http", url: "https://b.example.com/mcp" } } },
      "o/m/HEAD/cf/.mcp.json": { mcpServers: { a: { type: "http", url: "https://other.example.com/mcp" }, c: { command: "x" } } },
    });
    const servers = await readPluginRemoteMcpServers({ source: "github", repo: "o/m" }, "cloudflare", fetchText);
    expect(servers).toEqual([
      { name: "a", url: "https://a.example.com/mcp", headerNames: [] },
      { name: "b", url: "https://b.example.com/mcp", headerNames: [] },
    ]);
  });

  it("returns nothing for an unknown plugin or a missing manifest", async () => {
    const { fetchText } = fakeGithub({ "o/m/HEAD/.claude-plugin/marketplace.json": { name: "m", plugins: [] } });
    expect(await readPluginRemoteMcpServers({ source: "github", repo: "o/m" }, "x", fetchText)).toEqual([]);
    expect(await readPluginRemoteMcpServers({ source: "github", repo: "o/none" }, "x", fetchText)).toEqual([]);
  });
});
