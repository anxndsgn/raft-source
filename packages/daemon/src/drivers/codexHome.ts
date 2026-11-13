import { existsSync } from "node:fs";
import { lstat, mkdir, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CODEX_HOME_ENV, hydrateRuntimeConfig, runtimeConfigToLaunchFields, type AgentConfig } from "@botiverse/raft-shared";

function readConfiguredCodexHome(env: Record<string, string | undefined>): string | null {
  // The one env var the Codex home depends on (RUNTIME_SESSION_HOME_ENV_KEYS).
  const raw = env[CODEX_HOME_ENV];
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
}

export function resolveCodexHomeRootFromEnv(
  env: Record<string, string | undefined> = process.env,
  opts: { defaultHomeDir?: string; cwd?: string } = {},
): string {
  const raw = readConfiguredCodexHome(env);
  if (raw) {
    return path.resolve(opts.cwd ?? process.cwd(), raw);
  }
  return path.join(opts.defaultHomeDir ?? os.homedir(), ".codex");
}

export function hasConfiguredCodexHome(
  config: AgentConfig | null | undefined,
  baseEnv: Record<string, string | undefined> = process.env,
): boolean {
  const launchRuntimeFields = config ? runtimeConfigToLaunchFields(hydrateRuntimeConfig(config)) : null;
  return Boolean(readConfiguredCodexHome({
    ...baseEnv,
    ...(launchRuntimeFields?.envVars || {}),
  }));
}

export function resolveCodexHomeRootFromConfig(
  config: AgentConfig,
  defaultHomeDir: string,
  cwd: string,
  baseEnv: Record<string, string | undefined> = process.env,
  _opts: { agentId?: string; slockHome?: string } = {},
): string {
  const launchRuntimeFields = runtimeConfigToLaunchFields(hydrateRuntimeConfig(config));
  const env = {
    ...baseEnv,
    ...(launchRuntimeFields.envVars || {}),
  };
  return resolveCodexHomeRootFromEnv(env, { defaultHomeDir, cwd });
}

export function codexStateRootCandidates(homeDirOrCodexRoot: string): string[] {
  return [
    homeDirOrCodexRoot,
    path.join(homeDirOrCodexRoot, ".codex"),
  ];
}

export function codexSessionRootCandidates(homeDirOrCodexRoot: string): string[] {
  return codexStateRootCandidates(homeDirOrCodexRoot).map((root) => path.join(root, "sessions"));
}

/** The agent's own Codex home when it must not use the computer's Codex config (Skills Hub "use this computer's config" off). */
export const ISOLATED_CODEX_HOME_DIR = ".codex-home";

/**
 * Entries of the computer's Codex home an isolated home links to: the login
 * (so it stays signed in and token refreshes are shared) and the session
 * history (so a thread started before isolation still resumes). Everything
 * else (config.toml with its MCP servers and profiles, skills, prompts,
 * plugins) is left out.
 */
const SHARED_CODEX_HOME_ENTRIES = [
  { name: "auth.json", dir: false },
  { name: "sessions", dir: true },
  { name: "archived_sessions", dir: true },
] as const;

/**
 * Create (idempotently) an isolated Codex home under the agent workspace and
 * return its path. Shared entries are symlinks into `hostHome`; an entry that
 * already exists in the isolated home (link or not) is left as it is.
 */
export async function prepareIsolatedCodexHome(hostHome: string, workingDirectory: string): Promise<string> {
  const home = path.join(workingDirectory, ISOLATED_CODEX_HOME_DIR);
  await mkdir(home, { recursive: true });
  for (const entry of SHARED_CODEX_HOME_ENTRIES) {
    const target = path.join(hostHome, entry.name);
    const link = path.join(home, entry.name);
    const present = await lstat(link).then(() => true, () => false);
    if (present) continue;
    if (entry.dir) await mkdir(target, { recursive: true });
    else if (!existsSync(target)) continue;
    await symlink(target, link, entry.dir ? "dir" : "file");
  }
  return home;
}
