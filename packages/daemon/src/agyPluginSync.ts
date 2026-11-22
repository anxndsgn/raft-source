// Skills Hub plugins for Antigravity (`agy`). Hub plugins are Claude Code
// plugin ids (`<plugin>@<marketplace>`); `agy` does not read Claude's
// .claude/settings.json, but it loads any plugin directory placed in the
// workspace's `.agents/plugins/`, for that workspace only. So before a launch,
// each enabled hub plugin is fetched from its marketplace, converted by `agy`
// itself (`agy plugin install <dir>`, run against a throwaway HOME so the
// computer's own ~/.gemini/config is never touched) and moved into the
// agent's `.agents/plugins/<name>`. A plugin removed from the hub is removed
// from the workspace; a directory there the hub did not write is left alone.
//
// Never throws: a plugin that cannot be fetched or installed is reported and
// the agent starts without it.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ambientProcessEnv } from "./processEnvPatch";
import {
  SKILLS_HUB_PLUGIN_NAME_PATTERN,
  SKILLS_HUB_SKILL_NAME_PATTERN,
  skillsHubPluginMarketplace,
  type SkillsHubLaunchPlugin,
  type SkillsHubLaunchProjection,
  type SkillsHubMarketplaceSource,
} from "@botiverse/raft-shared";

/** Workspace-relative directory `agy` scans for workspace plugins. */
export const AGY_WORKSPACE_PLUGIN_ROOT = path.join(".agents", "plugins");
/** A clone or an install may take a while; bound each step. */
export const AGY_PLUGIN_STEP_TIMEOUT_MS = 120_000;

/** Marketplaces Claude Code knows without being told where they are. */
const BUILTIN_MARKETPLACES: Record<string, SkillsHubMarketplaceSource> = {
  "claude-plugins-official": { source: "github", repo: "anthropics/claude-plugins-official" },
};

export interface AgyPluginOutcome {
  plugin: string;
  ok: boolean;
  detail: string;
}

export interface AgyPluginSyncResult {
  /** Hub plugins now in the workspace (bare names = directory names). */
  plugins: string[];
  changed: boolean;
  outcomes: AgyPluginOutcome[];
}

type Run = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout: number },
) => Promise<{ ok: boolean; detail: string }>;

const runWithExecFile: Run = (command, args, options) => new Promise((resolve) => {
  execFile(command, args, {
    cwd: options.cwd,
    env: options.env ?? ambientProcessEnv(),
    timeout: options.timeout,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  }, (error, stdout, stderr) => {
    const output = `${stdout ?? ""}${stderr ?? ""}`.trim().split("\n").filter(Boolean).pop() ?? "";
    resolve({ ok: !error, detail: error ? (output || error.message) : output });
  });
});

export interface AgyPluginSyncDeps {
  run?: Run;
  /** Where fetched marketplaces and plugin sources are kept between launches. */
  cacheDir?: string;
  /** Claude Code's config dir, to reuse marketplaces it already cloned. */
  claudeConfigDir?: string;
}

function bareName(id: string): string {
  const at = id.lastIndexOf("@");
  return at > 0 ? id.slice(0, at) : id;
}

function defaultCacheDir(): string {
  return path.join(os.homedir(), ".cache", "raft", "agy-plugins");
}

function defaultClaudeConfigDir(): string {
  const configured = process.env.CLAUDE_CONFIG_DIR?.trim();
  return configured ? configured : path.join(os.homedir(), ".claude");
}

function hashKey(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 16);
}

function insideDir(root: string, rel: string): string | null {
  const resolved = path.resolve(root, rel);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

async function isDir(target: string): Promise<boolean> {
  try {
    return (await lstat(target)).isDirectory();
  } catch {
    return false;
  }
}

function gitUrl(source: SkillsHubMarketplaceSource): string {
  return source.source === "github" ? `https://github.com/${source.repo}.git` : source.url;
}

interface Ctx {
  run: Run;
  cacheDir: string;
  claudeConfigDir: string;
  gitEnv: NodeJS.ProcessEnv;
}

/**
 * A git checkout in the cache: `sha` pins it (fetched once, then reused);
 * without one the default branch (or `ref`) is cloned once and reused.
 */
async function checkout(ctx: Ctx, url: string, ref: string | null, sha: string | null): Promise<string> {
  const dir = path.join(ctx.cacheDir, "sources", hashKey(url, ref ?? "", sha ?? ""));
  if (await isDir(path.join(dir, ".git"))) return dir;
  const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(path.dirname(dir), { recursive: true });
  const git = async (args: string[], cwd?: string) => {
    const result = await ctx.run("git", args, { cwd, env: ctx.gitEnv, timeout: AGY_PLUGIN_STEP_TIMEOUT_MS });
    if (!result.ok) throw new Error(`git ${args[0]} ${url}: ${result.detail}`);
  };
  try {
    if (sha) {
      await mkdir(tmp, { recursive: true });
      await git(["init", "-q"], tmp);
      await git(["remote", "add", "origin", url], tmp);
      await git(["fetch", "-q", "--depth", "1", "origin", sha], tmp);
      await git(["checkout", "-q", "FETCH_HEAD"], tmp);
    } else {
      await git(["clone", "-q", "--depth", "1", ...(ref ? ["--branch", ref] : []), url, tmp]);
    }
    await git(["submodule", "update", "-q", "--init", "--recursive", "--depth", "1"], tmp);
    await rm(dir, { recursive: true, force: true });
    await rename(tmp, dir);
    return dir;
  } catch (error) {
    await rm(tmp, { recursive: true, force: true });
    throw error;
  }
}

/** The marketplace's checkout: Claude Code's own clone if it has one, else ours. */
async function marketplaceDir(ctx: Ctx, marketplace: string, declared: SkillsHubMarketplaceSource | null): Promise<string> {
  try {
    const known = JSON.parse(readFileSync(path.join(ctx.claudeConfigDir, "plugins", "known_marketplaces.json"), "utf8")) as Record<string, { installLocation?: unknown }>;
    const location = known?.[marketplace]?.installLocation;
    if (typeof location === "string" && existsSync(path.join(location, ".claude-plugin", "marketplace.json"))) return location;
  } catch {
    // No Claude Code on this computer, or nothing known: fetch it ourselves.
  }
  const source = declared ?? BUILTIN_MARKETPLACES[marketplace] ?? null;
  if (!source) throw new Error(`marketplace ${marketplace} has no known source`);
  return checkout(ctx, gitUrl(source), null, null);
}

/** The plugin's own directory, from its marketplace entry. */
export async function resolvePluginSourceDir(ctx: Ctx, plugin: SkillsHubLaunchPlugin): Promise<string> {
  const marketplace = skillsHubPluginMarketplace(plugin.name);
  const name = bareName(plugin.name);
  const mpDir = await marketplaceDir(ctx, marketplace, plugin.marketplaceSource);
  const catalog = JSON.parse(readFileSync(path.join(mpDir, ".claude-plugin", "marketplace.json"), "utf8")) as {
    plugins?: Array<{ name?: unknown; source?: unknown }>;
    metadata?: { pluginRoot?: unknown };
  };
  const entry = catalog.plugins?.find((candidate) => candidate?.name === name);
  if (!entry) throw new Error(`${name} is not in marketplace ${marketplace}`);
  const source = entry.source;
  if (typeof source === "string") {
    const root = typeof catalog.metadata?.pluginRoot === "string" && !source.startsWith("./") ? catalog.metadata.pluginRoot : "";
    const dir = insideDir(mpDir, path.join(root, source));
    if (!dir || !(await isDir(dir))) throw new Error(`${name}: source ${source} is not a directory in ${marketplace}`);
    return dir;
  }
  if (source && typeof source === "object") {
    const spec = source as { source?: unknown; repo?: unknown; url?: unknown; path?: unknown; ref?: unknown; sha?: unknown };
    const ref = typeof spec.ref === "string" ? spec.ref : null;
    const sha = typeof spec.sha === "string" ? spec.sha : null;
    let url: string | null = null;
    if (spec.source === "github" && typeof spec.repo === "string") url = `https://github.com/${spec.repo}.git`;
    else if ((spec.source === "url" || spec.source === "git-subdir" || spec.source === "git") && typeof spec.url === "string") url = spec.url;
    if (url) {
      const repoDir = await checkout(ctx, url, ref, sha);
      const sub = typeof spec.path === "string" ? spec.path : "";
      const dir = insideDir(repoDir, sub);
      if (!dir || !(await isDir(dir))) throw new Error(`${name}: path ${sub} not found in ${url}`);
      return dir;
    }
  }
  throw new Error(`${name}: unsupported plugin source in ${marketplace}`);
}

/** Convert with `agy plugin install` into a throwaway HOME, return the staged plugin dir. */
async function stageWithAgy(ctx: Ctx, agyCommand: string, sourceDir: string, stageHome: string): Promise<string> {
  const result = await ctx.run(agyCommand, ["plugin", "install", sourceDir], {
    env: { ...ctx.gitEnv, HOME: stageHome, USERPROFILE: stageHome, NO_COLOR: "1" },
    timeout: AGY_PLUGIN_STEP_TIMEOUT_MS,
  });
  if (!result.ok) throw new Error(`agy plugin install: ${result.detail}`);
  const pluginsDir = path.join(stageHome, ".gemini", "config", "plugins");
  const staged = (await readdir(pluginsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  if (staged.length !== 1) throw new Error(`agy plugin install staged ${staged.length} plugins`);
  return path.join(pluginsDir, staged[0]!.name);
}

/**
 * Bring `.agents/plugins/` in line with the hub. `previous` are the bare names
 * the hub wrote on an earlier launch (from the hub manifest).
 */
export async function syncAgyPlugins(input: {
  workspace: string;
  hub: SkillsHubLaunchProjection;
  previous: string[];
  agyCommand: string;
  env?: NodeJS.ProcessEnv;
  deps?: AgyPluginSyncDeps;
}): Promise<AgyPluginSyncResult> {
  const ctx: Ctx = {
    run: input.deps?.run ?? runWithExecFile,
    cacheDir: input.deps?.cacheDir ?? defaultCacheDir(),
    claudeConfigDir: input.deps?.claudeConfigDir ?? defaultClaudeConfigDir(),
    gitEnv: { ...(input.env ?? ambientProcessEnv()), GIT_TERMINAL_PROMPT: "0" },
  };
  const root = path.join(input.workspace, AGY_WORKSPACE_PLUGIN_ROOT);
  const owned = new Set(input.previous.filter((name) => SKILLS_HUB_SKILL_NAME_PATTERN.test(name)));
  const plugins: string[] = [];
  const outcomes: AgyPluginOutcome[] = [];
  let changed = false;

  const wanted = new Map<string, SkillsHubLaunchPlugin>();
  for (const plugin of input.hub.plugins) {
    if (!SKILLS_HUB_PLUGIN_NAME_PATTERN.test(plugin.name)) continue;
    const name = bareName(plugin.name);
    if (!SKILLS_HUB_SKILL_NAME_PATTERN.test(name) || wanted.has(name)) continue;
    wanted.set(name, plugin);
  }

  for (const [name, plugin] of wanted) {
    const target = path.join(root, name);
    const present = await isDir(target);
    if (present && owned.has(name)) {
      plugins.push(name);
      continue;
    }
    if (present || existsSync(target)) {
      // Someone else's plugin already uses this name: leave it.
      outcomes.push({ plugin: plugin.name, ok: false, detail: `${AGY_WORKSPACE_PLUGIN_ROOT}/${name} exists and is not the hub's` });
      continue;
    }
    let stageHome: string | null = null;
    try {
      const sourceDir = await resolvePluginSourceDir(ctx, plugin);
      stageHome = await mkdtemp(path.join(os.tmpdir(), "raft-agy-plugin-"));
      const staged = await stageWithAgy(ctx, input.agyCommand, sourceDir, stageHome);
      await mkdir(root, { recursive: true });
      await cp(staged, target, { recursive: true, verbatimSymlinks: true });
      plugins.push(name);
      changed = true;
      outcomes.push({ plugin: plugin.name, ok: true, detail: "installed" });
    } catch (error) {
      await rm(target, { recursive: true, force: true }).catch(() => undefined);
      outcomes.push({ plugin: plugin.name, ok: false, detail: error instanceof Error ? error.message : String(error) });
    } finally {
      if (stageHome) await rm(stageHome, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  for (const name of owned) {
    if (wanted.has(name)) continue;
    await rm(path.join(root, name), { recursive: true, force: true });
    changed = true;
  }
  return { plugins, changed, outcomes };
}
