import assert from "node:assert/strict";
import path from "node:path";
import {
  buildClaudePluginInstallArgs,
  claudeConfigDir,
  installMissingClaudePlugins,
  missingClaudePlugins,
  readInstalledClaudePlugins,
} from "./claudePluginInstall";

const baseConfig = {
  name: "hao",
  displayName: "Hao",
  description: "runtime tester",
  model: "sonnet",
  runtime: "claude",
  reasoningEffort: null,
  envVars: null,
  sessionId: null,
  serverUrl: "https://api.slock.ai",
  authToken: null,
};

function configWithPlugins(plugins: Array<{ name: string; marketplaceSource: any }>): any {
  return { ...baseConfig, skillsHub: { skills: [], plugins, useHostSkills: false } };
}

test("claude config dir follows CLAUDE_CONFIG_DIR, else ~/.claude", () => {
  assert.equal(claudeConfigDir({ CLAUDE_CONFIG_DIR: "/custom/claude" }), "/custom/claude");
  assert.equal(claudeConfigDir({ HOME: "/home/hao" }), path.join("/home/hao", ".claude"));
});

test("installed plugins are the ones whose files are still on disk", () => {
  const installedJson = JSON.stringify({
    version: 2,
    plugins: {
      "figma@claude-plugins-official": [{ scope: "user", installPath: "/cache/figma/1" }],
      "gone@claude-plugins-official": [{ scope: "user", installPath: "/cache/gone/1" }],
      "broken@x": "not-an-array",
    },
  });
  const installed = readInstalledClaudePlugins("/cfg", {
    readFile: (file) => {
      assert.equal(file, path.join("/cfg", "plugins", "installed_plugins.json"));
      return installedJson;
    },
    exists: (file) => file === "/cache/figma/1",
  });
  assert.deepEqual([...installed], ["figma@claude-plugins-official"]);
});

test("a missing or unreadable installed_plugins.json means nothing is installed", () => {
  const installed = readInstalledClaudePlugins("/cfg", {
    readFile: () => {
      throw new Error("ENOENT");
    },
  });
  assert.equal(installed.size, 0);
});

test("only enabled hub plugins that are not installed are missing", () => {
  const config = configWithPlugins([
    { name: "figma@claude-plugins-official", marketplaceSource: null },
    { name: "commit-commands@claude-plugins-official", marketplaceSource: null },
    { name: "not a plugin id", marketplaceSource: null },
  ]);
  const missing = missingClaudePlugins(config, new Set(["figma@claude-plugins-official"]));
  assert.deepEqual(missing.map((plugin) => plugin.name), ["commit-commands@claude-plugins-official"]);
  assert.deepEqual(missingClaudePlugins(baseConfig as any, new Set()), []);
});

test("install args use project scope and name the marketplace source when there is one", () => {
  assert.deepEqual(
    buildClaudePluginInstallArgs({ name: "figma@claude-plugins-official", marketplaceSource: null }),
    ["plugin", "install", "figma@claude-plugins-official", "--scope", "project", "--json"],
  );
  assert.deepEqual(
    buildClaudePluginInstallArgs({ name: "tool@acme", marketplaceSource: { source: "github", repo: "acme/plugins" } }),
    ["plugin", "install", "tool", "--marketplace", "acme/plugins", "--scope", "project", "--json"],
  );
  assert.deepEqual(
    buildClaudePluginInstallArgs({ name: "tool@acme", marketplaceSource: { source: "git", url: "https://git.example/acme.git" } }),
    ["plugin", "install", "tool", "--marketplace", "https://git.example/acme.git", "--scope", "project", "--json"],
  );
});

test("missing plugins are installed in the workspace one by one; a failure does not stop the rest", async () => {
  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  const outcomes = await installMissingClaudePlugins({
    config: configWithPlugins([
      { name: "figma@claude-plugins-official", marketplaceSource: null },
      { name: "bad@claude-plugins-official", marketplaceSource: null },
      { name: "commit-commands@claude-plugins-official", marketplaceSource: null },
    ]),
    claudeCommand: "/usr/local/bin/claude",
    workspace: "/agents/hao",
    env: {},
    deps: {
      installed: new Set(["figma@claude-plugins-official"]),
      run: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        return args[2] === "bad@claude-plugins-official"
          ? { ok: false, detail: "plugin not found" }
          : { ok: true, detail: "" };
      },
    },
  });
  assert.deepEqual(calls.map((call) => [call.command, call.args[2], call.cwd]), [
    ["/usr/local/bin/claude", "bad@claude-plugins-official", "/agents/hao"],
    ["/usr/local/bin/claude", "commit-commands@claude-plugins-official", "/agents/hao"],
  ]);
  assert.deepEqual(outcomes, [
    { plugin: "bad@claude-plugins-official", ok: false, detail: "plugin not found" },
    { plugin: "commit-commands@claude-plugins-official", ok: true, detail: "" },
  ]);
});

test("a cancelled launch stops installing", async () => {
  const controller = new AbortController();
  controller.abort();
  let ran = false;
  const outcomes = await installMissingClaudePlugins({
    config: configWithPlugins([{ name: "commit-commands@claude-plugins-official", marketplaceSource: null }]),
    claudeCommand: null,
    workspace: "/agents/hao",
    env: {},
    signal: controller.signal,
    deps: { installed: new Set(), run: async () => { ran = true; return { ok: true, detail: "" }; } },
  });
  assert.equal(ran, false);
  assert.deepEqual(outcomes, []);
});
