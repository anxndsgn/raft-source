import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import type { AgentConfig, SkillsHubLaunchProjection } from "@botiverse/raft-shared";
import { syncAgyPlugins } from "./agyPluginSync";
import { SKILLS_HUB_MANIFEST_FILE, syncSkillsHubWorkspace } from "./skillsHubSync";

interface Call { command: string; args: string[]; cwd?: string; home?: string }

async function withDirs(fn: (dirs: { ws: string; cache: string; claude: string; market: string }) => Promise<void>) {
  const base = await mkdtemp(path.join(os.tmpdir(), "agy-plugins-"));
  const dirs = { ws: path.join(base, "ws"), cache: path.join(base, "cache"), claude: path.join(base, "claude"), market: path.join(base, "market") };
  for (const dir of Object.values(dirs)) await mkdir(dir, { recursive: true });
  try {
    await fn(dirs);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

/** A marketplace Claude Code already cloned, with one plugin per source kind. */
async function seedMarketplace(dirs: { claude: string; market: string }) {
  await mkdir(path.join(dirs.market, ".claude-plugin"), { recursive: true });
  await writeFile(path.join(dirs.market, ".claude-plugin", "marketplace.json"), JSON.stringify({
    name: "mp",
    plugins: [
      { name: "local", source: "./plugins/local" },
      { name: "remote", source: { source: "git-subdir", url: "https://example.test/remote.git", path: "sub/plugin", sha: "abc123" } },
      { name: "escape", source: "../outside" },
    ],
  }));
  await mkdir(path.join(dirs.market, "plugins", "local", "skills", "hello"), { recursive: true });
  await writeFile(path.join(dirs.market, "plugins", "local", "skills", "hello", "SKILL.md"), "---\nname: hello\n---\nhi\n");
  await mkdir(path.join(dirs.claude, "plugins"), { recursive: true });
  await writeFile(path.join(dirs.claude, "plugins", "known_marketplaces.json"), JSON.stringify({ mp: { installLocation: dirs.market } }));
}

/** git: makes the checkout (with the asked-for subdirectory); agy: stages a copy. */
function fakeRun(calls: Call[], opts: { agyFails?: boolean } = {}) {
  return async (command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv }) => {
    calls.push({ command, args, cwd: options.cwd, home: options.env?.HOME });
    if (command === "git") {
      if (args[0] === "init" && options.cwd) {
        await mkdir(path.join(options.cwd, ".git"), { recursive: true });
        await mkdir(path.join(options.cwd, "sub", "plugin", "skills", "r"), { recursive: true });
        await writeFile(path.join(options.cwd, "sub", "plugin", "skills", "r", "SKILL.md"), "r\n");
      }
      return { ok: true, detail: "" };
    }
    if (opts.agyFails) return { ok: false, detail: "boom" };
    const source = args[2]!;
    const target = path.join(options.env!.HOME!, ".gemini", "config", "plugins", path.basename(source));
    await cp(source, target, { recursive: true });
    await writeFile(path.join(target, "plugin.json"), JSON.stringify({ name: path.basename(source) }));
    return { ok: true, detail: "ok" };
  };
}

const hub = (names: string[], useHostSkills = true): SkillsHubLaunchProjection => ({
  skills: [],
  plugins: names.map((name) => ({ name, marketplaceSource: null })),
  useHostSkills,
});

test("an enabled plugin is converted by agy into the workspace's .agents/plugins", async () => {
  await withDirs(async (dirs) => {
    await seedMarketplace(dirs);
    const calls: Call[] = [];
    const result = await syncAgyPlugins({
      workspace: dirs.ws, hub: hub(["local@mp"]), previous: [], agyCommand: "agy",
      deps: { run: fakeRun(calls), cacheDir: dirs.cache, claudeConfigDir: dirs.claude },
    });
    assert.deepEqual(result.plugins, ["local"]);
    assert.equal(result.changed, true);
    assert.equal(await readFile(path.join(dirs.ws, ".agents", "plugins", "local", "skills", "hello", "SKILL.md"), "utf8"), "---\nname: hello\n---\nhi\n");
    // agy ran against a throwaway HOME, never the computer's own, and it is gone.
    const install = calls.find((call) => call.command === "agy")!;
    assert.deepEqual(install.args, ["plugin", "install", path.join(dirs.market, "plugins", "local")]);
    assert.notEqual(install.home, os.homedir());
    assert.equal(existsSync(install.home!), false);
  });
});

test("an installed hub plugin is kept without reinstalling; a disabled one is removed", async () => {
  await withDirs(async (dirs) => {
    await seedMarketplace(dirs);
    const calls: Call[] = [];
    const deps = { run: fakeRun(calls), cacheDir: dirs.cache, claudeConfigDir: dirs.claude };
    await syncAgyPlugins({ workspace: dirs.ws, hub: hub(["local@mp"]), previous: [], agyCommand: "agy", deps });
    calls.length = 0;
    const again = await syncAgyPlugins({ workspace: dirs.ws, hub: hub(["local@mp"]), previous: ["local"], agyCommand: "agy", deps });
    assert.deepEqual(again, { plugins: ["local"], changed: false, outcomes: [] });
    assert.equal(calls.length, 0);
    const off = await syncAgyPlugins({ workspace: dirs.ws, hub: hub([]), previous: ["local"], agyCommand: "agy", deps });
    assert.deepEqual(off.plugins, []);
    assert.equal(off.changed, true);
    assert.equal(existsSync(path.join(dirs.ws, ".agents", "plugins", "local")), false);
  });
});

test("a plugin directory the hub did not write is left alone", async () => {
  await withDirs(async (dirs) => {
    await seedMarketplace(dirs);
    await mkdir(path.join(dirs.ws, ".agents", "plugins", "local"), { recursive: true });
    await writeFile(path.join(dirs.ws, ".agents", "plugins", "local", "mine.txt"), "mine");
    const calls: Call[] = [];
    const result = await syncAgyPlugins({
      workspace: dirs.ws, hub: hub(["local@mp"]), previous: [], agyCommand: "agy",
      deps: { run: fakeRun(calls), cacheDir: dirs.cache, claudeConfigDir: dirs.claude },
    });
    assert.deepEqual(result.plugins, []);
    assert.equal(result.outcomes[0]?.ok, false);
    assert.equal(await readFile(path.join(dirs.ws, ".agents", "plugins", "local", "mine.txt"), "utf8"), "mine");
    assert.equal(calls.length, 0);
  });
});

test("a git-subdir source is fetched at its pinned commit and its subdirectory installed", async () => {
  await withDirs(async (dirs) => {
    await seedMarketplace(dirs);
    const calls: Call[] = [];
    const result = await syncAgyPlugins({
      workspace: dirs.ws, hub: hub(["remote@mp"]), previous: [], agyCommand: "agy",
      deps: { run: fakeRun(calls), cacheDir: dirs.cache, claudeConfigDir: dirs.claude },
    });
    assert.deepEqual(result.plugins, ["remote"]);
    const fetch = calls.find((call) => call.command === "git" && call.args[0] === "fetch")!;
    assert.deepEqual(fetch.args, ["fetch", "-q", "--depth", "1", "origin", "abc123"]);
    const install = calls.find((call) => call.command === "agy")!;
    assert.match(install.args[2]!, /sub\/plugin$/);
    assert.equal(existsSync(path.join(dirs.ws, ".agents", "plugins", "remote", "skills", "r", "SKILL.md")), true);
  });
});

test("failures are reported, never thrown, and leave nothing behind", async () => {
  await withDirs(async (dirs) => {
    await seedMarketplace(dirs);
    const calls: Call[] = [];
    const result = await syncAgyPlugins({
      workspace: dirs.ws, hub: hub(["local@mp", "escape@mp", "missing@mp", "x@unknown-mp"]), previous: [], agyCommand: "agy",
      deps: { run: fakeRun(calls, { agyFails: true }), cacheDir: dirs.cache, claudeConfigDir: dirs.claude },
    });
    assert.deepEqual(result.plugins, []);
    assert.deepEqual(result.outcomes.map((outcome) => [outcome.plugin, outcome.ok]), [
      ["local@mp", false], ["escape@mp", false], ["missing@mp", false], ["x@unknown-mp", false],
    ]);
    assert.equal(existsSync(path.join(dirs.ws, ".agents", "plugins", "local")), false);
  });
});

test("an Antigravity agent gets hub skills in .agents/skills and plugins via agy, recorded in the manifest", async () => {
  await withDirs(async (dirs) => {
    await seedMarketplace(dirs);
    const calls: Call[] = [];
    const config = {
      name: "a", runtime: "antigravity", model: "default",
      skillsHub: { skills: [{ name: "s1", content: "---\nname: s1\n---\n", files: [] }], plugins: [{ name: "local@mp", marketplaceSource: null }], useHostSkills: true },
    } as unknown as AgentConfig;
    const result = await syncSkillsHubWorkspace(dirs.ws, config, {
      agyCommand: "agy", agyDeps: { run: fakeRun(calls), cacheDir: dirs.cache, claudeConfigDir: dirs.claude },
    });
    assert.equal(result?.pluginsChanged, true);
    assert.equal(existsSync(path.join(dirs.ws, ".agents", "skills", "s1", "SKILL.md")), true);
    assert.equal(existsSync(path.join(dirs.ws, ".agents", "plugins", "local")), true);
    // Claude's settings are not written for agy.
    assert.equal(existsSync(path.join(dirs.ws, ".claude", "settings.json")), false);
    const manifest = JSON.parse(await readFile(path.join(dirs.ws, SKILLS_HUB_MANIFEST_FILE), "utf8"));
    assert.deepEqual(manifest.agyPlugins, ["local"]);
  });
});
