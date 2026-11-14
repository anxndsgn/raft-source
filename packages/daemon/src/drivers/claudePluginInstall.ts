// Skills Hub plugins for Claude Code. The hub only enables a plugin
// (`enabledPlugins` in the workspace's .claude/settings.json); Claude Code
// does not download a missing plugin when a headless session starts, it
// silently skips it. So before a launch, install every enabled plugin that is
// not on this computer yet with `claude plugin install`.

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  SKILLS_HUB_PLUGIN_NAME_PATTERN,
  type AgentConfig,
  type SkillsHubLaunchPlugin,
} from "@botiverse/raft-shared";
import { buildClaudeSpawnSpec } from "./claudeLaunch";

/** One plugin install may clone a marketplace; give it time, but bound it. */
export const CLAUDE_PLUGIN_INSTALL_TIMEOUT_MS = 120_000;

/** Claude Code's config dir: `CLAUDE_CONFIG_DIR`, else `~/.claude`. */
export function claudeConfigDir(env: NodeJS.ProcessEnv): string {
  const configured = env.CLAUDE_CONFIG_DIR?.trim();
  return configured ? configured : path.join(env.HOME || os.homedir(), ".claude");
}

/**
 * Plugin ids Claude Code has installed on this computer (any scope) whose
 * files are still on disk, from `<config>/plugins/installed_plugins.json`.
 */
export function readInstalledClaudePlugins(
  configDir: string,
  deps: { readFile?: (file: string) => string; exists?: (file: string) => boolean } = {},
): Set<string> {
  const readFile = deps.readFile ?? ((file: string) => readFileSync(file, "utf8"));
  const exists = deps.exists ?? existsSync;
  const installed = new Set<string>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFile(path.join(configDir, "plugins", "installed_plugins.json")));
  } catch {
    return installed;
  }
  const plugins = (parsed as { plugins?: unknown } | null)?.plugins;
  if (!plugins || typeof plugins !== "object" || Array.isArray(plugins)) return installed;
  for (const [id, entries] of Object.entries(plugins)) {
    if (!Array.isArray(entries)) continue;
    const onDisk = entries.some((entry) => {
      const installPath = (entry as { installPath?: unknown } | null)?.installPath;
      return typeof installPath === "string" && exists(installPath);
    });
    if (onDisk) installed.add(id);
  }
  return installed;
}

/** Enabled hub plugins that are not installed on this computer. */
export function missingClaudePlugins(config: AgentConfig, installed: Set<string>): SkillsHubLaunchPlugin[] {
  const plugins = config.skillsHub?.plugins ?? [];
  return plugins.filter((plugin) => SKILLS_HUB_PLUGIN_NAME_PATTERN.test(plugin.name) && !installed.has(plugin.name));
}

/**
 * `claude plugin install` arguments. Project scope records the install against
 * the workspace and writes the same `enabledPlugins` key the hub already
 * wrote, so turning the plugin off in the hub still removes it. A plugin with
 * a marketplace source names that source, so a marketplace this computer has
 * not added yet is added first.
 */
export function buildClaudePluginInstallArgs(plugin: SkillsHubLaunchPlugin): string[] {
  const source = plugin.marketplaceSource;
  if (source) {
    const at = plugin.name.lastIndexOf("@");
    const bare = at > 0 ? plugin.name.slice(0, at) : plugin.name;
    const location = source.source === "github" ? source.repo : source.url;
    return ["plugin", "install", bare, "--marketplace", location, "--scope", "project", "--json"];
  }
  return ["plugin", "install", plugin.name, "--scope", "project", "--json"];
}

export interface ClaudePluginInstallOutcome {
  plugin: string;
  ok: boolean;
  detail: string;
}

type RunInstall = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; signal?: AbortSignal; timeout: number },
) => Promise<{ ok: boolean; detail: string }>;

const runInstallWithExecFile: RunInstall = (command, args, options) => new Promise((resolve) => {
  execFile(command, args, { ...options, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
    const output = `${stdout ?? ""}${stderr ?? ""}`.trim().split("\n").filter(Boolean).pop() ?? "";
    resolve({ ok: !error, detail: error ? (output || error.message) : output });
  });
});

/**
 * Install the enabled hub plugins missing on this computer, one at a time.
 * Never throws: a plugin that fails to install is reported and the agent
 * starts without it, as it did before.
 */
export async function installMissingClaudePlugins(input: {
  config: AgentConfig;
  claudeCommand: string | null;
  workspace: string;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  deps?: { installed?: Set<string>; run?: RunInstall };
}): Promise<ClaudePluginInstallOutcome[]> {
  const installed = input.deps?.installed ?? readInstalledClaudePlugins(claudeConfigDir(input.env));
  const missing = missingClaudePlugins(input.config, installed);
  const run = input.deps?.run ?? runInstallWithExecFile;
  const outcomes: ClaudePluginInstallOutcome[] = [];
  for (const plugin of missing) {
    if (input.signal?.aborted) break;
    const spec = buildClaudeSpawnSpec(input.claudeCommand, buildClaudePluginInstallArgs(plugin));
    const result = await run(spec.command, spec.args, {
      cwd: input.workspace,
      env: input.env,
      signal: input.signal,
      timeout: CLAUDE_PLUGIN_INSTALL_TIMEOUT_MS,
    });
    outcomes.push({ plugin: plugin.name, ...result });
  }
  return outcomes;
}
