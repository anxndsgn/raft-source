// What a person pastes into Add MCP (raft-customized task #18): an address, or a
// Claude Code / Cursor `mcpServers` configuration. Pure; no network.

export interface PastedMcpServer {
  /** The server's key in the configuration, or null for a bare address. */
  name: string | null;
  url: string;
  /** Request headers the configuration sets (e.g. Authorization). */
  headers: Record<string, string>;
}

export type PastedMcp =
  | { kind: "empty" }
  | { kind: "servers"; servers: PastedMcpServer[]; localOnly: string[] }
  | { kind: "invalid" };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function stringHeaders(value: unknown): Record<string, string> {
  const record = asRecord(value);
  if (!record) return {};
  const out: Record<string, string> = {};
  for (const [key, header] of Object.entries(record)) if (typeof header === "string" && key.trim()) out[key.trim()] = header;
  return out;
}

/** The `{ name: config }` map a configuration holds, whether it is wrapped in `mcpServers` or not. */
function serverMap(json: Record<string, unknown>): Record<string, unknown> | null {
  const wrapped = asRecord(json.mcpServers) ?? asRecord(json.servers);
  if (wrapped) return wrapped;
  // A single server object ({ "url": … } or { "command": … }).
  if ("url" in json || "command" in json || "serverUrl" in json) return { "": json };
  // A bare map of servers ({ "notion": { "url": … } }).
  const values = Object.values(json);
  if (values.length > 0 && values.every((value) => asRecord(value) && ("url" in (value as object) || "command" in (value as object) || "serverUrl" in (value as object)))) return json;
  return null;
}

export function parsePastedMcp(text: string): PastedMcp {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "empty" };
  const url = httpUrl(trimmed);
  if (url && !/\s/.test(trimmed)) return { kind: "servers", servers: [{ name: null, url, headers: {} }], localOnly: [] };
  if (!trimmed.startsWith("{") && !trimmed.startsWith("\"")) return { kind: "invalid" };
  let json: unknown;
  try {
    // A pasted fragment (`"notion": { … }`) is wrapped into an object first.
    json = JSON.parse(trimmed.startsWith("{") ? trimmed : `{${trimmed.replace(/,\s*$/, "")}}`);
  } catch {
    return { kind: "invalid" };
  }
  const record = asRecord(json);
  const map = record ? serverMap(record) : null;
  if (!map) return { kind: "invalid" };
  const servers: PastedMcpServer[] = [];
  const localOnly: string[] = [];
  for (const [name, value] of Object.entries(map)) {
    const config = asRecord(value);
    if (!config) continue;
    const serverUrl = httpUrl(config.url) ?? httpUrl(config.serverUrl);
    if (serverUrl) servers.push({ name: name || null, url: serverUrl, headers: stringHeaders(config.headers) });
    else if (typeof config.command === "string") localOnly.push(name);
  }
  if (servers.length === 0 && localOnly.length === 0) return { kind: "invalid" };
  return { kind: "servers", servers, localOnly };
}

/** The key part of an `Authorization: Bearer …` header, so the key field can show it. */
export function bearerKey(headers: Record<string, string>): string | null {
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === "authorization");
  const match = entry ? /^Bearer\s+(.+)$/i.exec(entry[1].trim()) : null;
  return match ? match[1] : null;
}

/** The HTTP auth scheme a bare key is sent with (a protocol token, not prose). */
const BEARER_SCHEME = "Bearer";

/** A key typed alone gets "Bearer " in front; a value that already says how it authenticates is kept. */
export function authorizationValue(key: string): string {
  const trimmed = key.trim();
  return /^(Bearer|Basic|Token)\s/i.test(trimmed) ? trimmed : [BEARER_SCHEME, trimmed].join(" ");
}
