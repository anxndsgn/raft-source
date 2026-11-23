// Task #22: a Skills Hub plugin's remote MCP server that an MCP App serves in
// Raft must not also start from the plugin, or the agent sees the service
// twice and the plugin's copy asks for its own sign-in.
//
// Claude Code names a plugin's servers `plugin:<plugin>:<server>` and turns
// one off for a project through `disabledMcpServers` in that project's entry
// of `.claude.json` (what `/mcp disable` writes; verified with
// `claude mcp list` -> "Disabled for this project"). The workspace's
// `.claude/settings*.json` does not carry it. So before a launch the daemon
// sets the agent's project entry: Raft's names are added, the ones Raft added
// last time and no longer wants are removed, and anything a person disabled
// themselves is left alone. What Raft added is kept in the workspace.
//
// `.claude.json` is Claude Code's own file and other sessions write it too.
// It is re-read right before the write and replaced atomically (temp file +
// rename, as Claude Code does), and only when something changes.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SkillsHubLaunchPlugin } from "@botiverse/raft-shared";

const OWNED_FILE = path.join(".claude", ".raft-mcp-served-by-raft.json");

/** `.claude.json`: in `CLAUDE_CONFIG_DIR` when set, else in the home directory. */
export function claudeJsonPath(env: NodeJS.ProcessEnv): string {
  const configured = env.CLAUDE_CONFIG_DIR?.trim();
  return configured ? path.join(configured, ".claude.json") : path.join(env.HOME || os.homedir(), ".claude.json");
}

/** Claude Code's names for the plugin servers Raft serves. */
export function servedServerNames(plugins: SkillsHubLaunchPlugin[]): string[] {
  const names: string[] = [];
  for (const plugin of plugins) {
    const bare = plugin.name.split("@")[0] ?? plugin.name;
    for (const server of plugin.mcpServersServedByRaft ?? []) names.push(`plugin:${bare}:${server}`);
  }
  return [...new Set(names)].sort();
}

function readOwned(workspace: string): string[] {
  try {
    const parsed = JSON.parse(readFileSync(path.join(workspace, OWNED_FILE), "utf8")) as { disabledMcpServers?: unknown };
    return Array.isArray(parsed.disabledMcpServers) ? parsed.disabledMcpServers.filter((n): n is string => typeof n === "string") : [];
  } catch {
    return [];
  }
}

/** The project's new list: the person's own entries, then Raft's. Null when unchanged. */
export function nextDisabledList(current: unknown, owned: string[], wanted: string[]): string[] | null {
  const list = Array.isArray(current) ? current.filter((n): n is string => typeof n === "string") : [];
  const ownedSet = new Set(owned);
  const next = list.filter((name) => !ownedSet.has(name) || wanted.includes(name));
  for (const name of wanted) if (!next.includes(name)) next.push(name);
  const same = next.length === list.length && next.every((name, index) => name === list[index]);
  return same ? null : next;
}

/**
 * Bring the workspace's project entry in `.claude.json` in line with `plugins`.
 * Returns what changed, for the log; never throws (a failure leaves the plugin's own servers on).
 */
export function syncClaudePluginMcpServedByRaft(input: {
  workspace: string;
  plugins: SkillsHubLaunchPlugin[];
  env: NodeJS.ProcessEnv;
}): { changed: boolean; disabled: string[]; error?: string } {
  const wanted = servedServerNames(input.plugins);
  const owned = readOwned(input.workspace);
  if (wanted.length === 0 && owned.length === 0) return { changed: false, disabled: [] };
  const file = claudeJsonPath(input.env);
  try {
    if (!existsSync(file)) {
      if (wanted.length === 0) return { changed: false, disabled: [] };
      throw new Error(`${file} does not exist yet`);
    }
    const config = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const projects = (typeof config.projects === "object" && config.projects !== null ? config.projects : {}) as Record<string, Record<string, unknown>>;
    const key = path.resolve(input.workspace);
    const entry = projects[key] ?? {};
    const next = nextDisabledList(entry.disabledMcpServers, owned, wanted);
    if (next !== null) {
      projects[key] = { ...entry, disabledMcpServers: next };
      config.projects = projects;
      const tmp = `${file}.raft-${process.pid}-${Date.now()}`;
      writeFileSync(tmp, JSON.stringify(config, null, 2), { mode: 0o600 });
      renameSync(tmp, file);
    }
    if (wanted.length !== owned.length || wanted.some((name, index) => name !== owned[index])) {
      mkdirSync(path.join(input.workspace, ".claude"), { recursive: true });
      writeFileSync(path.join(input.workspace, OWNED_FILE), `${JSON.stringify({ disabledMcpServers: wanted }, null, 2)}\n`);
    }
    return { changed: next !== null, disabled: wanted };
  } catch (error) {
    return { changed: false, disabled: [], error: error instanceof Error ? error.message : String(error) };
  }
}
