/**
 * Skills Hub: a server-scoped library of agent skills and runtime plugins.
 * Items live once per server; each agent enables the subset it should carry.
 * The enabled subset rides `agent:start` (AgentConfig.skillsHub) and the
 * daemon materializes it into the agent workspace before spawning.
 */

export type SkillsHubItemKind = "skill" | "plugin";

/** Skill and plugin names become directory names / settings keys. */
export const SKILLS_HUB_SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
/** Claude Code plugin id: `<plugin>@<marketplace>`. */
export const SKILLS_HUB_PLUGIN_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}@[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export const SKILLS_HUB_MAX_CONTENT_BYTES = 256 * 1024;
/** Limits for the extra files (scripts, references) a skill carries. */
export const SKILLS_HUB_MAX_SKILL_FILES = 200;
export const SKILLS_HUB_MAX_SKILL_FILES_BYTES = 1024 * 1024;

/**
 * A file inside a skill directory other than SKILL.md. `path` is relative to
 * the skill directory, `/`-separated, and never escapes it.
 */
export interface SkillsHubSkillFile {
  path: string;
  content: string;
  encoding: "utf8" | "base64";
}

/** Where an imported skill came from (pinned to the commit it was read at). */
export interface SkillsHubGithubSource {
  type: "github";
  /** `owner/repo` */
  repo: string;
  /** Branch or tag the user pointed at (or the default branch). */
  ref: string;
  commitSha: string;
  /** Skill directory inside the repo; "" for the repo root. */
  path: string;
}

/** True when `path` is a safe relative path inside a skill directory. */
export function isSafeSkillFilePath(path: string): boolean {
  if (!path || path.length > 512 || path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  const parts = path.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..")
    && path !== "SKILL.md";
}

/** One skill found in a GitHub repository, before import. */
export interface SkillsHubGithubScanSkill {
  /** Skill directory inside the repo; "" for the repo root. */
  path: string;
  /** Suggested hub name (normalized frontmatter name or directory name). */
  name: string;
  description: string | null;
  fileCount: number;
  /** An item with this name already exists in the hub. */
  existingItemId: string | null;
}

export interface SkillsHubGithubScanResponse {
  repo: string;
  ref: string;
  commitSha: string;
  skills: SkillsHubGithubScanSkill[];
}

/** One plugin listed in a GitHub marketplace (`.claude-plugin/marketplace.json`). */
export interface SkillsHubMarketplaceScanPlugin {
  /** Plugin name inside the marketplace. */
  name: string;
  /** Hub plugin id: `<name>@<marketplace>`. */
  id: string;
  description: string | null;
  version: string | null;
  /** A plugin item with this id already exists in the hub. */
  existingItemId: string | null;
}

export interface SkillsHubMarketplaceScanResponse {
  /** `owner/repo` */
  repo: string;
  ref: string;
  commitSha: string;
  /** The marketplace's `name`, the part after `@` in plugin ids. */
  marketplace: string;
  plugins: SkillsHubMarketplaceScanPlugin[];
}

export interface SkillsHubGithubImportRequest {
  url: string;
  commitSha: string;
  paths: string[];
  agentIds: string[];
}

export interface SkillsHubGithubImportResponse {
  items: SkillsHubItemView[];
}

/**
 * Where a plugin's marketplace comes from. Mirrors Claude Code's
 * `extraKnownMarketplaces.<name>.source` shape for the two common sources.
 */
export type SkillsHubMarketplaceSource =
  | { source: "github"; repo: string }
  | { source: "git"; url: string };

export interface SkillsHubItemView {
  id: string;
  kind: SkillsHubItemKind;
  /** Skill directory name, or plugin id `<plugin>@<marketplace>`. */
  name: string;
  description: string | null;
  /** SKILL.md body (skills only). */
  content: string | null;
  /** Optional marketplace registration (plugins only). */
  marketplaceSource: SkillsHubMarketplaceSource | null;
  /** Set when the skill was imported from GitHub. */
  source: SkillsHubGithubSource | null;
  /** Number of files besides SKILL.md. */
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillsHubCatalogResponse {
  items: SkillsHubItemView[];
  /** The catalog list only (`GET /api/skills-hub/items`): Agents with each item on, by item id, out of `agentTotal` (task #18). */
  enabledAgentCounts?: Record<string, number>;
  agentTotal?: number;
}

export interface SkillsHubAgentItemView extends SkillsHubItemView {
  enabled: boolean;
}

export interface SkillsHubAgentCatalogResponse {
  items: SkillsHubAgentItemView[];
  /**
   * Whether the agent also loads skills/plugins installed on its computer
   * (user-level runtime config such as `~/.claude`). Default true.
   */
  useHostSkills: boolean;
}

/** One enabled skill as shipped on agent:start. */
export interface SkillsHubLaunchSkill {
  name: string;
  content: string;
  /** Extra files in the skill directory. Absent when there are none. */
  files?: SkillsHubSkillFile[];
}

/** One enabled plugin as shipped on agent:start. */
export interface SkillsHubLaunchPlugin {
  /** `<plugin>@<marketplace>` */
  name: string;
  marketplaceSource: SkillsHubMarketplaceSource | null;
}

/**
 * The agent's enabled hub items at launch. Present (possibly with empty
 * arrays) whenever the server supports the hub, so the daemon can also remove
 * items that were disabled since the last launch. Absent on old servers: the
 * daemon then leaves the workspace untouched.
 */
export interface SkillsHubLaunchProjection {
  skills: SkillsHubLaunchSkill[];
  plugins: SkillsHubLaunchPlugin[];
  /**
   * False: the runtime must not load user-level (computer-wide) skills and
   * plugins, only what the hub wrote into the workspace. Claude Code honors
   * this via `--setting-sources project,local`.
   */
  useHostSkills: boolean;
}

/**
 * Whether turning "use this computer's config" off can take effect for this
 * runtime. Antigravity (`agy`) keeps its computer-wide config under
 * ~/.gemini/config with no way to point a session elsewhere short of a new
 * HOME, which also drops its sign-in; so for agy the switch stays on.
 */
export function runtimeHonorsHostSkillsToggle(runtime: string | null | undefined): boolean {
  return runtime !== "antigravity";
}

export function skillsHubPluginMarketplace(name: string): string {
  const at = name.lastIndexOf("@");
  return at >= 0 ? name.slice(at + 1) : "";
}
