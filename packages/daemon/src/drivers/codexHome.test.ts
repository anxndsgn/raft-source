import assert from "node:assert/strict";
import { mkdtemp, readlink, rm, writeFile, mkdir, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";
import { ISOLATED_CODEX_HOME_DIR, prepareIsolatedCodexHome } from "./codexHome";

const dirs: string[] = [];
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "codex-home-"));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("an isolated Codex home links the login and sessions, nothing else", async () => {
  const host = await tempDir();
  const workspace = await tempDir();
  await writeFile(path.join(host, "auth.json"), "{}");
  await writeFile(path.join(host, "config.toml"), "[mcp_servers.x]\n");
  await mkdir(path.join(host, "skills"));

  const home = await prepareIsolatedCodexHome(host, workspace);
  assert.equal(home, path.join(workspace, ISOLATED_CODEX_HOME_DIR));
  assert.deepEqual((await readdir(home)).sort(), ["archived_sessions", "auth.json", "sessions"]);
  assert.equal(await readlink(path.join(home, "auth.json")), path.join(host, "auth.json"));
  assert.equal(await readlink(path.join(home, "sessions")), path.join(host, "sessions"));

  // Idempotent.
  assert.equal(await prepareIsolatedCodexHome(host, workspace), home);
});

test("no login on the computer: no auth.json link", async () => {
  const host = await tempDir();
  const workspace = await tempDir();
  const home = await prepareIsolatedCodexHome(host, workspace);
  assert.deepEqual((await readdir(home)).sort(), ["archived_sessions", "sessions"]);
});
