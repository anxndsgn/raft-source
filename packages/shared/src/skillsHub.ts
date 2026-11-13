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
  createdAt: string;
  updatedAt: string;
}

export interface SkillsHubCatalogResponse {
  items: SkillsHubItemView[];
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

export function skillsHubPluginMarketplace(name: string): string {
  const at = name.lastIndexOf("@");
  return at >= 0 ? name.slice(at + 1) : "";
}
