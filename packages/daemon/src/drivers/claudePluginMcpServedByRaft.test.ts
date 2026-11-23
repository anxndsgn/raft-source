import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { nextDisabledList, servedServerNames, syncClaudePluginMcpServedByRaft } from "./claudePluginMcpServedByRaft";

describe("servedServerNames", () => {
  it("names servers the way Claude Code does", () => {
    expect(servedServerNames([
      { name: "cloudflare@claude-plugins-official", marketplaceSource: null, mcpServersServedByRaft: ["cloudflare"] },
      { name: "paddle@claude-community", marketplaceSource: null, mcpServersServedByRaft: ["paddle-live", "paddle-docs"] },
      { name: "figma@x", marketplaceSource: null },
    ])).toEqual(["plugin:cloudflare:cloudflare", "plugin:paddle:paddle-docs", "plugin:paddle:paddle-live"]);
  });
});

describe("nextDisabledList", () => {
  it("keeps a person's own entries, adds Raft's and drops Raft's stale ones", () => {
    expect(nextDisabledList(["mine", "plugin:a:a"], ["plugin:a:a"], ["plugin:b:b"])).toEqual(["mine", "plugin:b:b"]);
    expect(nextDisabledList(["mine", "plugin:b:b"], ["plugin:b:b"], ["plugin:b:b"])).toBeNull();
    expect(nextDisabledList(undefined, [], [])).toBeNull();
  });
});

describe("syncClaudePluginMcpServedByRaft", () => {
  function setup() {
    const home = mkdtempSync(path.join(os.tmpdir(), "raft-claude-json-"));
    const workspace = path.join(home, "ws");
    mkdirSync(workspace);
    writeFileSync(path.join(home, ".claude.json"), JSON.stringify({ other: 1, projects: { [workspace]: { lastSessionId: "s", disabledMcpServers: ["mine"] } } }));
    const read = () => JSON.parse(readFileSync(path.join(home, ".claude.json"), "utf8"));
    return { env: { HOME: home } as NodeJS.ProcessEnv, workspace, read };
  }
  const plugin = (served?: string[]) => [{ name: "cloudflare@m", marketplaceSource: null, ...(served ? { mcpServersServedByRaft: served } : {}) }];

  it("turns the served server off in the project, then back on", () => {
    const { env, workspace, read } = setup();
    expect(syncClaudePluginMcpServedByRaft({ workspace, plugins: plugin(["cloudflare"]), env })).toEqual({ changed: true, disabled: ["plugin:cloudflare:cloudflare"] });
    expect(read().projects[workspace]).toEqual({ lastSessionId: "s", disabledMcpServers: ["mine", "plugin:cloudflare:cloudflare"] });
    expect(read().other).toBe(1);
    expect(syncClaudePluginMcpServedByRaft({ workspace, plugins: plugin(["cloudflare"]), env }).changed).toBe(false);
    expect(syncClaudePluginMcpServedByRaft({ workspace, plugins: plugin(), env }).changed).toBe(true);
    expect(read().projects[workspace].disabledMcpServers).toEqual(["mine"]);
  });

  it("does nothing when Raft serves nothing and never did", () => {
    const { env, workspace } = setup();
    expect(syncClaudePluginMcpServedByRaft({ workspace, plugins: plugin(), env })).toEqual({ changed: false, disabled: [] });
    expect(existsSync(path.join(workspace, ".claude"))).toBe(false);
  });
});
