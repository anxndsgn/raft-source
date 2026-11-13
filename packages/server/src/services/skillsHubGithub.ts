// Skills Hub ← GitHub. Reads a public repository at one commit, finds the
// skills in it (directories holding a SKILL.md) and reads a chosen skill's
// files. Only api.github.com and raw.githubusercontent.com are contacted, with
// owner/repo validated first; GITHUB_TOKEN, when set, raises the rate limit.

import {
  SKILLS_HUB_MAX_CONTENT_BYTES,
  SKILLS_HUB_PLUGIN_NAME_PATTERN,
  SKILLS_HUB_MAX_SKILL_FILES,
  SKILLS_HUB_MAX_SKILL_FILES_BYTES,
  SKILLS_HUB_SKILL_NAME_PATTERN,
  isSafeSkillFilePath,
  type SkillsHubGithubSource,
  type SkillsHubSkillFile,
} from "@botiverse/raft-shared";
import { SkillsHubError } from "./skillsHubService";

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const REQUEST_TIMEOUT_MS = 15_000;
/** At most this many skills are listed (and read) from one repository. */
export const SKILLS_HUB_GITHUB_MAX_SKILLS = 100;
const SKIPPED_DIRS = new Set([".git", "node_modules"]);

export interface GithubLocation {
  owner: string;
  repo: string;
  /** Remaining path segments after `/tree/` or `/blob/` (ref + path, ambiguous when the ref has a slash). */
  refAndPath: string[];
}

const NAME_SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;

/** Accepts `owner/repo`, `https://github.com/owner/repo(.git)`, and `/tree/<ref>/<path>` or `/blob/...` links. */
export function parseGithubLocation(input: string): GithubLocation {
  let text = input.trim();
  if (!text) throw new SkillsHubError("Enter a GitHub repository address", "skills_hub_invalid");
  text = text.replace(/^git@github\.com:/i, "https://github.com/");
  if (!/^https?:\/\//i.test(text)) {
    text = /^(www\.)?github\.com\//i.test(text) ? `https://${text}` : `https://github.com/${text}`;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new SkillsHubError("Not a GitHub repository address", "skills_hub_invalid");
  }
  if (!/^(www\.)?github\.com$/i.test(url.hostname)) {
    throw new SkillsHubError("Only github.com repositories are supported", "skills_hub_invalid");
  }
  const segments = url.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  const owner = segments[0];
  const repo = segments[1]?.replace(/\.git$/i, "");
  if (!owner || !repo || !NAME_SEGMENT.test(owner) || !NAME_SEGMENT.test(repo)) {
    throw new SkillsHubError("Not a GitHub repository address", "skills_hub_invalid");
  }
  const rest = segments.slice(2);
  const refAndPath = rest[0] === "tree" || rest[0] === "blob" ? rest.slice(1) : [];
  if (refAndPath.some((segment) => segment === ".." || segment.includes("\\"))) {
    throw new SkillsHubError("Not a GitHub repository address", "skills_hub_invalid");
  }
  return { owner, repo, refAndPath };
}

function headers(accept = "application/vnd.github+json"): Record<string, string> {
  const h: Record<string, string> = { Accept: accept, "User-Agent": "raft-skills-hub", "X-GitHub-Api-Version": "2022-11-28" };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function githubFetch(url: string, accept?: string): Promise<Response> {
  try {
    return await fetch(url, { headers: headers(accept), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new SkillsHubError("Could not reach GitHub", "skills_hub_github_unavailable");
  }
}

function failFromStatus(response: Response, what: string): never {
  if (response.status === 404) {
    throw new SkillsHubError(`${what} not found (the repository must be public)`, "skills_hub_github_not_found");
  }
  if (response.status === 403 || response.status === 429) {
    throw new SkillsHubError("GitHub rate limit reached; try again later", "skills_hub_github_unavailable");
  }
  throw new SkillsHubError(`GitHub returned ${response.status}`, "skills_hub_github_unavailable");
}

async function resolveCommit(owner: string, repo: string, ref: string): Promise<string | null> {
  const response = await githubFetch(`${API}/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`, "application/vnd.github.sha");
  if (response.status === 404 || response.status === 422) return null;
  if (!response.ok) failFromStatus(response, "Repository");
  const sha = (await response.text()).trim();
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

export interface ResolvedGithubRef {
  owner: string;
  repo: string;
  ref: string;
  commitSha: string;
  /** Directory inside the repo the user pointed at ("" for the root). */
  basePath: string;
}

/** Resolve the branch/tag (or the default branch) and the sub-path to a commit. */
export async function resolveGithubRef(location: GithubLocation): Promise<ResolvedGithubRef> {
  const { owner, repo, refAndPath } = location;
  if (refAndPath.length === 0) {
    const response = await githubFetch(`${API}/repos/${owner}/${repo}`);
    if (!response.ok) failFromStatus(response, "Repository");
    const ref = String(((await response.json()) as { default_branch?: unknown }).default_branch ?? "");
    if (!ref) throw new SkillsHubError("Repository has no default branch", "skills_hub_github_not_found");
    const commitSha = await resolveCommit(owner, repo, ref);
    if (!commitSha) throw new SkillsHubError("Repository is empty", "skills_hub_github_not_found");
    return { owner, repo, ref, commitSha, basePath: "" };
  }
  // A ref may contain slashes: try the shortest prefix first.
  for (let take = 1; take <= Math.min(refAndPath.length, 5); take += 1) {
    const ref = refAndPath.slice(0, take).join("/");
    const commitSha = await resolveCommit(owner, repo, ref);
    if (commitSha) {
      let basePath = refAndPath.slice(take).join("/");
      if (basePath === "SKILL.md" || basePath.endsWith("/SKILL.md")) basePath = basePath.slice(0, -"SKILL.md".length).replace(/\/$/, "");
      return { owner, repo, ref, commitSha, basePath };
    }
  }
  throw new SkillsHubError("Branch or tag not found", "skills_hub_github_not_found");
}

interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

export interface GithubSkillCandidate {
  /** Skill directory inside the repo; "" for the root. */
  path: string;
  /** Files of the skill besides SKILL.md, relative to its directory. */
  files: { path: string; size: number }[];
}

async function readTree(ref: ResolvedGithubRef): Promise<TreeEntry[]> {
  const response = await githubFetch(`${API}/repos/${ref.owner}/${ref.repo}/git/trees/${ref.commitSha}?recursive=1`);
  if (!response.ok) failFromStatus(response, "Repository");
  const body = (await response.json()) as { tree?: TreeEntry[] };
  return Array.isArray(body.tree) ? body.tree : [];
}

/** Skill directories under `basePath`, each with its own files (nested skills are separate). */
export function findSkillCandidates(tree: TreeEntry[], basePath: string): GithubSkillCandidate[] {
  const prefix = basePath ? `${basePath}/` : "";
  const blobs = tree.filter((entry) => entry.type === "blob"
    && (prefix === "" || entry.path.startsWith(prefix))
    && !entry.path.split("/").some((segment) => SKIPPED_DIRS.has(segment)));
  const skillDirs = blobs
    .filter((entry) => entry.path === "SKILL.md" || entry.path.endsWith("/SKILL.md"))
    .map((entry) => entry.path.slice(0, -"SKILL.md".length).replace(/\/$/, ""))
    .filter((dir) => prefix === "" || dir === basePath || dir.startsWith(prefix))
    .sort();
  // Each file belongs to its deepest enclosing skill directory.
  const owner = (file: string): string | null => {
    let best: string | null = null;
    for (const dir of skillDirs) {
      if (dir === "" || file.startsWith(`${dir}/`)) {
        if (best === null || dir.length > best.length) best = dir;
      }
    }
    return best;
  };
  const byDir = new Map<string, { path: string; size: number }[]>(skillDirs.map((dir) => [dir, []]));
  for (const blob of blobs) {
    const dir = owner(blob.path);
    if (dir === null) continue;
    const rel = dir ? blob.path.slice(dir.length + 1) : blob.path;
    if (rel === "SKILL.md") continue;
    byDir.get(dir)?.push({ path: rel, size: blob.size ?? 0 });
  }
  return skillDirs.map((dir) => ({ path: dir, files: byDir.get(dir) ?? [] }));
}

async function fetchRaw(ref: ResolvedGithubRef, path: string): Promise<Buffer> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await githubFetch(`${RAW}/${ref.owner}/${ref.repo}/${ref.commitSha}/${encoded}`, "*/*");
  if (!response.ok) failFromStatus(response, `File ${path}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Minimal frontmatter read: `name:` and `description:` scalars. */
export function readSkillFrontmatter(markdown: string): { name: string | null; description: string | null } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) return { name: null, description: null };
  const field = (key: string): string | null => {
    const line = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(match[1]);
    if (!line) return null;
    const value = line[1].trim().replace(/^(['"])(.*)\1$/, "$2").trim();
    return value && value !== ">" && value !== "|" ? value : null;
  };
  return { name: field("name"), description: field("description") };
}

/** A valid hub skill name from the frontmatter name, else the directory (or repo) name. */
export function skillsHubNameFor(frontmatterName: string | null, dirPath: string, repo: string): string {
  for (const raw of [frontmatterName, dirPath.split("/").pop() || repo]) {
    if (!raw) continue;
    const name = raw.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z0-9]+/, "").slice(0, 64).replace(/-+$/, "");
    if (SKILLS_HUB_SKILL_NAME_PATTERN.test(name)) return name;
  }
  return "skill";
}

export interface GithubScannedSkill {
  path: string;
  name: string;
  description: string | null;
  fileCount: number;
}

export interface GithubScan {
  ref: ResolvedGithubRef;
  skills: GithubScannedSkill[];
}

/** List the skills found at a GitHub address. */
export async function scanGithubSkills(input: string): Promise<GithubScan> {
  const ref = await resolveGithubRef(parseGithubLocation(input));
  const candidates = findSkillCandidates(await readTree(ref), ref.basePath).slice(0, SKILLS_HUB_GITHUB_MAX_SKILLS);
  const skills = await Promise.all(candidates.map(async (candidate) => {
    const skillMd = (await fetchRaw(ref, candidate.path ? `${candidate.path}/SKILL.md` : "SKILL.md")).toString("utf8");
    const frontmatter = readSkillFrontmatter(skillMd);
    return {
      path: candidate.path,
      name: skillsHubNameFor(frontmatter.name, candidate.path, ref.repo),
      description: frontmatter.description,
      fileCount: candidate.files.length,
    };
  }));
  return { ref, skills };
}

export interface GithubSkillContent {
  path: string;
  name: string;
  description: string | null;
  content: string;
  files: SkillsHubSkillFile[];
  source: SkillsHubGithubSource;
}

function looksBinary(bytes: Buffer): boolean {
  if (bytes.includes(0)) return true;
  return Buffer.from(bytes.toString("utf8"), "utf8").length !== bytes.length;
}

/** Read the chosen skills (SKILL.md and every other file) at the pinned commit. */
export async function readGithubSkills(input: string, commitSha: string, paths: string[]): Promise<GithubSkillContent[]> {
  if (!/^[0-9a-f]{40}$/.test(commitSha)) throw new SkillsHubError("Invalid commit", "skills_hub_invalid");
  const location = parseGithubLocation(input);
  const resolved = await resolveGithubRef(location);
  // Read at the commit the user saw in the scan, not whatever the branch is now.
  const ref: ResolvedGithubRef = { ...resolved, commitSha };
  const candidates = new Map(findSkillCandidates(await readTree(ref), "").map((c) => [c.path, c]));
  const wanted = [...new Set(paths)];
  if (wanted.length === 0) throw new SkillsHubError("Choose at least one skill", "skills_hub_invalid");
  return Promise.all(wanted.map(async (path) => {
    const candidate = candidates.get(path);
    if (!candidate) throw new SkillsHubError(`No skill at "${path || "/"}"`, "skills_hub_github_not_found");
    if (candidate.files.length > SKILLS_HUB_MAX_SKILL_FILES) {
      throw new SkillsHubError(`Skill "${path || ref.repo}" has more than ${SKILLS_HUB_MAX_SKILL_FILES} files`, "skills_hub_invalid");
    }
    const declared = candidate.files.reduce((sum, file) => sum + file.size, 0);
    if (declared > SKILLS_HUB_MAX_SKILL_FILES_BYTES) {
      throw new SkillsHubError(`Skill "${path || ref.repo}" files exceed ${SKILLS_HUB_MAX_SKILL_FILES_BYTES / 1024} KB`, "skills_hub_invalid");
    }
    const prefix = path ? `${path}/` : "";
    const skillMd = (await fetchRaw(ref, `${prefix}SKILL.md`)).toString("utf8");
    if (Buffer.byteLength(skillMd, "utf8") > SKILLS_HUB_MAX_CONTENT_BYTES) {
      throw new SkillsHubError(`SKILL.md of "${path || ref.repo}" is too large`, "skills_hub_invalid");
    }
    const files: SkillsHubSkillFile[] = [];
    for (const file of candidate.files) {
      if (!isSafeSkillFilePath(file.path)) continue;
      const bytes = await fetchRaw(ref, `${prefix}${file.path}`);
      files.push(looksBinary(bytes)
        ? { path: file.path, content: bytes.toString("base64"), encoding: "base64" }
        : { path: file.path, content: bytes.toString("utf8"), encoding: "utf8" });
    }
    const frontmatter = readSkillFrontmatter(skillMd);
    return {
      path,
      name: skillsHubNameFor(frontmatter.name, path, ref.repo),
      description: frontmatter.description,
      content: skillMd,
      files,
      source: { type: "github", repo: `${ref.owner}/${ref.repo}`, ref: ref.ref, commitSha, path },
    };
  }));
}

/** Where Claude Code looks for a marketplace manifest in a repository. */
export const MARKETPLACE_MANIFEST_PATH = ".claude-plugin/marketplace.json";
const MAX_MARKETPLACE_PLUGINS = 500;

export interface GithubMarketplacePlugin {
  name: string;
  description: string | null;
  version: string | null;
}

export interface GithubMarketplace {
  name: string;
  plugins: GithubMarketplacePlugin[];
}

function optionalText(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/** Read a marketplace manifest: its name and the plugins whose ids are valid hub plugin ids. */
export function parseMarketplaceManifest(text: string): GithubMarketplace {
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new SkillsHubError(`${MARKETPLACE_MANIFEST_PATH} is not valid JSON`, "skills_hub_invalid");
  }
  const body = (typeof manifest === "object" && manifest !== null ? manifest : {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!SKILLS_HUB_PLUGIN_NAME_PATTERN.test(`plugin@${name}`)) {
    throw new SkillsHubError(`${MARKETPLACE_MANIFEST_PATH} has no valid marketplace name`, "skills_hub_invalid");
  }
  const seen = new Set<string>();
  const plugins: GithubMarketplacePlugin[] = [];
  for (const entry of Array.isArray(body.plugins) ? body.plugins : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const plugin = entry as Record<string, unknown>;
    const pluginName = typeof plugin.name === "string" ? plugin.name.trim() : "";
    if (!SKILLS_HUB_PLUGIN_NAME_PATTERN.test(`${pluginName}@${name}`) || seen.has(pluginName)) continue;
    seen.add(pluginName);
    plugins.push({ name: pluginName, description: optionalText(plugin.description, 2_000), version: optionalText(plugin.version, 100) });
    if (plugins.length >= MAX_MARKETPLACE_PLUGINS) break;
  }
  return { name, plugins };
}

/** List the plugins of the marketplace at a GitHub address (its `.claude-plugin/marketplace.json`). */
export async function scanGithubMarketplace(input: string): Promise<{ ref: ResolvedGithubRef; marketplace: GithubMarketplace }> {
  const ref = await resolveGithubRef(parseGithubLocation(input));
  const manifestPath = ref.basePath ? `${ref.basePath}/${MARKETPLACE_MANIFEST_PATH}` : MARKETPLACE_MANIFEST_PATH;
  const encoded = manifestPath.split("/").map(encodeURIComponent).join("/");
  const response = await githubFetch(`${RAW}/${ref.owner}/${ref.repo}/${ref.commitSha}/${encoded}`, "*/*");
  if (response.status === 404) {
    throw new SkillsHubError(`No ${MARKETPLACE_MANIFEST_PATH} in ${ref.owner}/${ref.repo}: this is not a plugin marketplace`, "skills_hub_github_not_found");
  }
  if (!response.ok) failFromStatus(response, MARKETPLACE_MANIFEST_PATH);
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > SKILLS_HUB_MAX_CONTENT_BYTES) {
    throw new SkillsHubError(`${MARKETPLACE_MANIFEST_PATH} is too large`, "skills_hub_invalid");
  }
  return { ref, marketplace: parseMarketplaceManifest(text) };
}
