// The remote MCP servers a Skills Hub plugin declares (task #22).
//
// A Claude Code plugin brings MCP servers in its `.mcp.json`, in `mcpServers`
// of its `.claude-plugin/plugin.json` (an object, or a path to a JSON file),
// or inline in its marketplace entry. Until now only the daemon read a plugin's
// files; the server needs the remote ones (an `http` URL) so a person can sign
// in to them once in Raft, as an MCP App, instead of in each runtime on each
// computer. Local servers (`command`) and `sse` ones stay with the plugin: Raft
// only proxies streamable HTTP.
//
// Only public github.com marketplaces and plugin sources are read (the same
// reach as the marketplace scan). Results are cached per plugin for an hour.

import type { SkillsHubMarketplaceSource, SkillsHubPluginRemoteMcpServer } from "@botiverse/raft-shared";
import { SkillsHubError } from "./skillsHubService";
import { MARKETPLACE_MANIFEST_PATH, parseGithubLocation } from "./skillsHubGithub";

const RAW = "https://raw.githubusercontent.com";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_JSON_BYTES = 512 * 1024;
const MAX_SERVERS = 20;
const CACHE_TTL_MS = 60 * 60 * 1000;
const SERVER_NAME = /^[A-Za-z0-9_.-]{1,64}$/;

/** A place in a public GitHub repository: `path` is "" for the root. */
interface RepoPlace {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

export type FetchText = (url: string) => Promise<string | null>;

async function defaultFetchText(url: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { "User-Agent": "raft-skills-hub" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new SkillsHubError("Could not reach GitHub", "skills_hub_github_unavailable");
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new SkillsHubError(`GitHub returned ${response.status}`, "skills_hub_github_unavailable");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) return null;
  return text;
}

function joinPath(...parts: string[]): string {
  const out: string[] = [];
  for (const part of parts.join("/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return "\0";
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

function rawUrl(place: RepoPlace, file: string): string | null {
  const full = joinPath(place.path, file);
  if (full.includes("\0") || full.includes("\\")) return null;
  const encoded = full.split("/").map(encodeURIComponent).join("/");
  return `${RAW}/${place.owner}/${place.repo}/${encodeURIComponent(place.ref)}/${encoded}`;
}

async function readJson(fetchText: FetchText, place: RepoPlace, file: string): Promise<unknown> {
  const url = rawUrl(place, file);
  if (!url) return null;
  const text = await fetchText(url);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function githubPlace(address: string, ref: string | null, path = ""): RepoPlace | null {
  try {
    const location = parseGithubLocation(address);
    return { owner: location.owner, repo: location.repo, ref: ref ?? "HEAD", path: joinPath(path) };
  } catch {
    return null;
  }
}

function marketplacePlace(source: SkillsHubMarketplaceSource): RepoPlace | null {
  return source.source === "github" ? githubPlace(source.repo, null) : githubPlace(source.url, null);
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Where a marketplace entry's plugin files are, or null when they are not on github.com. */
export function pluginPlace(marketplace: RepoPlace, manifest: Record<string, unknown>, entry: Record<string, unknown>): RepoPlace | null {
  const source = entry.source;
  if (typeof source === "string") {
    const pluginRoot = text(record(manifest.metadata)?.pluginRoot) ?? "";
    const path = joinPath(marketplace.path, source.startsWith("./") || source.startsWith("../") ? "" : pluginRoot, source);
    return path.includes("\0") ? null : { ...marketplace, path };
  }
  const body = record(source);
  if (!body) return null;
  const ref = text(body.sha) ?? text(body.ref);
  if (body.source === "github" && text(body.repo)) return githubPlace(text(body.repo)!, ref, text(body.path) ?? "");
  if ((body.source === "url" || body.source === "git") && text(body.url)) return githubPlace(text(body.url)!, ref, text(body.path) ?? "");
  if (body.source === "git-subdir" && text(body.url)) return githubPlace(text(body.url)!, ref, text(body.path) ?? "");
  return null;
}

/** The remote (streamable HTTP) servers in an `mcpServers` object; anything else is left to the plugin. */
export function remoteServersIn(value: unknown): SkillsHubPluginRemoteMcpServer[] {
  const body = record(value);
  const servers = record(body?.mcpServers) ?? body;
  if (!servers) return [];
  const out: SkillsHubPluginRemoteMcpServer[] = [];
  for (const [name, raw] of Object.entries(servers)) {
    const entry = record(raw);
    if (!entry || !SERVER_NAME.test(name)) continue;
    const url = text(entry.url);
    const type = text(entry.type)?.toLowerCase() ?? null;
    if (!url || (type !== null && type !== "http" && type !== "streamable-http" && type !== "streamable_http")) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    // Raft refuses query strings on MCP endpoints (credentials go in encrypted headers).
    if (parsed.protocol !== "https:" || parsed.search || url.includes("${")) continue;
    const headerNames = Object.keys(record(entry.headers) ?? {}).filter((h) => /^[A-Za-z0-9-]{1,100}$/.test(h));
    out.push({ name, url: parsed.toString(), headerNames });
    if (out.length >= MAX_SERVERS) break;
  }
  return out;
}

function merge(into: SkillsHubPluginRemoteMcpServer[], more: SkillsHubPluginRemoteMcpServer[]): void {
  for (const server of more) {
    if (into.length >= MAX_SERVERS) return;
    if (!into.some((s) => s.name === server.name)) into.push(server);
  }
}

/** Read a plugin's remote MCP servers from its marketplace on GitHub. */
export async function readPluginRemoteMcpServers(
  marketplaceSource: SkillsHubMarketplaceSource,
  pluginName: string,
  fetchText: FetchText = defaultFetchText,
): Promise<SkillsHubPluginRemoteMcpServer[]> {
  const marketplace = marketplacePlace(marketplaceSource);
  if (!marketplace) return [];
  const manifest = record(await readJson(fetchText, marketplace, MARKETPLACE_MANIFEST_PATH));
  if (!manifest) return [];
  const entry = (Array.isArray(manifest.plugins) ? manifest.plugins : [])
    .map(record)
    .find((plugin) => plugin && text(plugin.name) === pluginName);
  if (!entry) return [];
  const found: SkillsHubPluginRemoteMcpServer[] = [];
  merge(found, remoteServersIn(entry.mcpServers));
  const place = pluginPlace(marketplace, manifest, entry);
  if (!place) return found;
  const pluginJson = record(await readJson(fetchText, place, ".claude-plugin/plugin.json"));
  const declared = pluginJson?.mcpServers;
  if (typeof declared === "string") merge(found, remoteServersIn(await readJson(fetchText, place, declared)));
  else if (declared !== undefined) merge(found, remoteServersIn(declared));
  merge(found, remoteServersIn(await readJson(fetchText, place, ".mcp.json")));
  return found;
}

const cache = new Map<string, { at: number; servers: SkillsHubPluginRemoteMcpServer[] }>();

/** `readPluginRemoteMcpServers`, cached for an hour per plugin; GitHub failures read as "none known". */
export async function pluginRemoteMcpServers(
  marketplaceSource: SkillsHubMarketplaceSource | null,
  pluginId: string,
): Promise<SkillsHubPluginRemoteMcpServer[]> {
  if (!marketplaceSource) return [];
  const key = `${pluginId}\n${JSON.stringify(marketplaceSource)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.servers;
  const pluginName = pluginId.split("@")[0] ?? pluginId;
  let servers: SkillsHubPluginRemoteMcpServer[];
  try {
    servers = await readPluginRemoteMcpServers(marketplaceSource, pluginName);
  } catch {
    return hit?.servers ?? [];
  }
  cache.set(key, { at: Date.now(), servers });
  return servers;
}

/** For tests. */
export function clearPluginRemoteMcpCache(): void {
  cache.clear();
}
