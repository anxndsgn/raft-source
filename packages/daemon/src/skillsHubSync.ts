// Skills Hub → agent workspace. The server ships the agent's enabled hub
// skills/plugins on agent:start (AgentConfig.skillsHub); before each launch
// this writes them where the runtime reads project-scoped config, and removes
// what it wrote on an earlier launch that is no longer enabled. Files the
// agent or a person put there by hand are never touched: ownership is tracked
// in a manifest next to the workspace root.

import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { syncAgyPlugins, type AgyPluginOutcome, type AgyPluginSyncDeps } from "./agyPluginSync";
import {
  isSafeSkillFilePath,
  SKILLS_HUB_PLUGIN_NAME_PATTERN,
  SKILLS_HUB_SKILL_NAME_PATTERN,
  skillsHubPluginMarketplace,
  type AgentConfig,
  type SkillsHubLaunchProjection,
  type SkillsHubLaunchSkill,
  type SkillsHubMarketplaceSource,
} from "@botiverse/raft-shared";

export const SKILLS_HUB_MANIFEST_FILE = ".raft-skills-hub.json";

interface SkillsHubManifest {
  version: 1;
  /** Skill directories written by the hub, relative to the workspace. */
  skillDirs: string[];
  /** Content hash per hub skill directory, to skip rewriting unchanged skills. */
  skillHashes: Record<string, string>;
  /** `enabledPlugins` keys written by the hub into .claude/settings.json. */
  plugins: string[];
  /** `extraKnownMarketplaces` keys written by the hub. */
  marketplaces: string[];
  /** Antigravity: plugin directories the hub put in `.agents/plugins/`. */
  agyPlugins?: string[];
}

const EMPTY_MANIFEST: SkillsHubManifest = { version: 1, skillDirs: [], skillHashes: {}, plugins: [], marketplaces: [] };

export interface SkillsHubSyncResult {
  written: string[];
  removed: string[];
  skipped: string[];
  pluginsChanged: boolean;
  /** Antigravity plugin installs that failed (the agent starts without them). */
  pluginFailures?: AgyPluginOutcome[];
}

/** Workspace-relative skill roots the runtime scans for project skills. */
export function skillsHubSkillRoot(runtime: string | undefined): string {
  return runtime === "codex" || runtime === "antigravity" ? path.join(".agents", "skills") : path.join(".claude", "skills");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function skillHash(skill: SkillsHubLaunchSkill): string {
  const hash = createHash("sha256").update("SKILL.md\0").update(skill.content);
  for (const file of [...(skill.files ?? [])].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(`\0${file.path}\0${file.encoding}\0`).update(file.content);
  }
  return hash.digest("hex");
}

/** Write SKILL.md and the skill's other files into a fresh directory. */
async function writeSkillDir(dir: string, skill: SkillsHubLaunchSkill): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), skill.content, "utf8");
  for (const file of skill.files ?? []) {
    if (!isSafeSkillFilePath(file.path)) continue;
    const target = path.join(dir, ...file.path.split("/"));
    if (!target.startsWith(dir + path.sep)) continue;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.encoding === "base64" ? Buffer.from(file.content, "base64") : file.content);
  }
}

async function readManifest(workspace: string): Promise<SkillsHubManifest> {
  try {
    const raw = JSON.parse(await readFile(path.join(workspace, SKILLS_HUB_MANIFEST_FILE), "utf8")) as Record<string, unknown>;
    return {
      version: 1,
      skillDirs: stringArray(raw.skillDirs),
      skillHashes: stringRecord(raw.skillHashes),
      plugins: stringArray(raw.plugins),
      marketplaces: stringArray(raw.marketplaces),
      agyPlugins: stringArray(raw.agyPlugins),
    };
  } catch {
    return { ...EMPTY_MANIFEST };
  }
}

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch {
    return false;
  }
}

/** A manifest path must stay inside the skill roots we manage. */
function isManagedSkillDir(rel: string): boolean {
  const normalized = path.normalize(rel);
  if (path.isAbsolute(normalized) || normalized.split(path.sep).includes("..")) return false;
  const name = path.basename(normalized);
  const root = path.dirname(normalized);
  return SKILLS_HUB_SKILL_NAME_PATTERN.test(name)
    && (root === skillsHubSkillRoot("claude") || root === skillsHubSkillRoot("codex"));
}

function marketplaceEntry(source: SkillsHubMarketplaceSource): Record<string, unknown> {
  return source.source === "github"
    ? { source: { source: "github", repo: source.repo } }
    : { source: { source: "git", url: source.url } };
}

async function syncClaudePlugins(
  workspace: string,
  hub: SkillsHubLaunchProjection,
  previous: SkillsHubManifest,
): Promise<{ plugins: string[]; marketplaces: string[]; changed: boolean }> {
  const settingsPath = path.join(workspace, ".claude", "settings.json");
  const raw = await readIfExists(settingsPath);
  let settings: Record<string, unknown> = {};
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) settings = parsed as Record<string, unknown>;
      else throw new Error("not an object");
    } catch {
      // Never clobber a settings file we cannot parse; leave plugins alone.
      return { plugins: previous.plugins, marketplaces: previous.marketplaces, changed: false };
    }
  }
  const enabledPlugins = { ...((settings.enabledPlugins as Record<string, unknown> | undefined) ?? {}) };
  const marketplaces = { ...((settings.extraKnownMarketplaces as Record<string, unknown> | undefined) ?? {}) };

  for (const key of previous.plugins) delete enabledPlugins[key];
  for (const key of previous.marketplaces) delete marketplaces[key];

  const plugins: string[] = [];
  const writtenMarketplaces: string[] = [];
  for (const plugin of hub.plugins) {
    if (!SKILLS_HUB_PLUGIN_NAME_PATTERN.test(plugin.name)) continue;
    // A person's own explicit setting wins over the hub.
    if (Object.prototype.hasOwnProperty.call(enabledPlugins, plugin.name)) continue;
    enabledPlugins[plugin.name] = true;
    plugins.push(plugin.name);
    const marketplace = skillsHubPluginMarketplace(plugin.name);
    if (plugin.marketplaceSource && marketplace && !Object.prototype.hasOwnProperty.call(marketplaces, marketplace)) {
      marketplaces[marketplace] = marketplaceEntry(plugin.marketplaceSource);
      writtenMarketplaces.push(marketplace);
    }
  }

  const next: Record<string, unknown> = { ...settings };
  if (Object.keys(enabledPlugins).length > 0) next.enabledPlugins = enabledPlugins;
  else delete next.enabledPlugins;
  if (Object.keys(marketplaces).length > 0) next.extraKnownMarketplaces = marketplaces;
  else delete next.extraKnownMarketplaces;

  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const nothingToWrite = raw === null && Object.keys(next).length === 0;
  if (nothingToWrite || serialized === raw) {
    return { plugins, marketplaces: writtenMarketplaces, changed: false };
  }
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, serialized, "utf8");
  return { plugins, marketplaces: writtenMarketplaces, changed: true };
}

/**
 * Bring the workspace in line with `config.skillsHub`. A no-op when the
 * server did not send the field (older server), so a daemon upgrade alone
 * never changes a workspace.
 */
export async function syncSkillsHubWorkspace(
  workspace: string,
  config: AgentConfig,
  options: { agyCommand?: string; agyDeps?: AgyPluginSyncDeps } = {},
): Promise<SkillsHubSyncResult | null> {
  const hub = config.skillsHub;
  if (!hub) return null;
  const previous = await readManifest(workspace);
  const result: SkillsHubSyncResult = { written: [], removed: [], skipped: [], pluginsChanged: false };

  const root = skillsHubSkillRoot(config.runtime);
  const owned = new Set(previous.skillDirs.filter(isManagedSkillDir));
  const nextSkillDirs: string[] = [];
  const nextSkillHashes: Record<string, string> = {};

  for (const skill of hub.skills) {
    if (!SKILLS_HUB_SKILL_NAME_PATTERN.test(skill.name)) {
      result.skipped.push(skill.name);
      continue;
    }
    const rel = path.join(root, skill.name);
    const file = path.join(workspace, rel, "SKILL.md");
    const existing = await readIfExists(file);
    if (!owned.has(rel)) {
      // Someone else's skill already uses this name: leave it.
      if (existing !== null || await pathExists(path.join(workspace, rel))) {
        result.skipped.push(skill.name);
        continue;
      }
    }
    const hash = skillHash(skill);
    if (existing !== skill.content || previous.skillHashes[rel] !== hash) {
      await writeSkillDir(path.join(workspace, rel), skill);
      result.written.push(skill.name);
    }
    nextSkillDirs.push(rel);
    nextSkillHashes[rel] = hash;
  }

  const keep = new Set(nextSkillDirs);
  for (const rel of owned) {
    if (keep.has(rel)) continue;
    await rm(path.join(workspace, rel), { recursive: true, force: true });
    result.removed.push(path.basename(rel));
  }

  let plugins = previous.plugins;
  let marketplaces = previous.marketplaces;
  let agyPlugins = previous.agyPlugins ?? [];
  if (config.runtime === "antigravity") {
    // agy reads neither .claude/settings.json nor Claude's plugin cache: its
    // plugins go into the workspace's .agents/plugins/ (agyPluginSync.ts).
    if (options.agyCommand) {
      const synced = await syncAgyPlugins({ workspace, hub, previous: agyPlugins, agyCommand: options.agyCommand, deps: options.agyDeps });
      agyPlugins = synced.plugins;
      result.pluginsChanged = synced.changed;
      const failures = synced.outcomes.filter((outcome) => !outcome.ok);
      if (failures.length > 0) result.pluginFailures = failures;
    }
  } else if (config.runtime !== "codex") {
    const synced = await syncClaudePlugins(workspace, hub, previous);
    plugins = synced.plugins;
    marketplaces = synced.marketplaces;
    result.pluginsChanged = synced.changed;
  }

  const manifest: SkillsHubManifest = {
    version: 1,
    skillDirs: nextSkillDirs,
    skillHashes: nextSkillHashes,
    plugins,
    marketplaces,
    ...(agyPlugins.length > 0 ? { agyPlugins } : {}),
  };
  const manifestPath = path.join(workspace, SKILLS_HUB_MANIFEST_FILE);
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (await readIfExists(manifestPath) !== serialized) {
    await writeFile(manifestPath, serialized, "utf8");
  }
  return result;
}

/** True when this launch must not load computer-wide skills/plugins. */
export function skillsHubIsolatesHost(config: AgentConfig): boolean {
  return config.skillsHub?.useHostSkills === false;
}
