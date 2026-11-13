import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import type { AgentConfig, SkillsHubLaunchProjection } from "@botiverse/raft-shared";
import { SKILLS_HUB_MANIFEST_FILE, skillsHubIsolatesHost, syncSkillsHubWorkspace } from "./skillsHubSync";

function config(skillsHub: SkillsHubLaunchProjection | undefined, runtime = "claude"): AgentConfig {
  return {
    name: "a",
    displayName: null,
    description: null,
    model: "sonnet",
    runtime,
    reasoningEffort: null,
    envVars: null,
    sessionId: null,
    serverUrl: "http://localhost",
    authToken: "",
    ...(skillsHub ? { skillsHub } : {}),
  } as AgentConfig;
}

async function withWorkspace(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "skills-hub-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const read = (file: string) => readFile(file, "utf8");
const exists = (file: string) => readFile(file).then(() => true, () => false);

test("no skillsHub field leaves the workspace untouched", async () => {
  await withWorkspace(async (ws) => {
    assert.equal(await syncSkillsHubWorkspace(ws, config(undefined)), null);
    assert.equal(await exists(path.join(ws, SKILLS_HUB_MANIFEST_FILE)), false);
  });
});

test("writes enabled skills, then removes only hub-owned ones when disabled", async () => {
  await withWorkspace(async (ws) => {
    await mkdir(path.join(ws, ".claude/skills/mine"), { recursive: true });
    await writeFile(path.join(ws, ".claude/skills/mine/SKILL.md"), "hand made");

    const first = await syncSkillsHubWorkspace(ws, config({
      skills: [{ name: "review", content: "# review" }, { name: "mine", content: "# hub mine" }],
      plugins: [],
      useHostSkills: true,
    }));
    assert.deepEqual(first?.written, ["review"]);
    assert.deepEqual(first?.skipped, ["mine"]);
    assert.equal(await read(path.join(ws, ".claude/skills/review/SKILL.md")), "# review");
    assert.equal(await read(path.join(ws, ".claude/skills/mine/SKILL.md")), "hand made");

    const second = await syncSkillsHubWorkspace(ws, config({ skills: [], plugins: [], useHostSkills: true }));
    assert.deepEqual(second?.removed, ["review"]);
    assert.equal(await exists(path.join(ws, ".claude/skills/review/SKILL.md")), false);
    assert.equal(await read(path.join(ws, ".claude/skills/mine/SKILL.md")), "hand made");
  });
});

test("skill files are written with the skill and stale ones removed on change", async () => {
  await withWorkspace(async (ws) => {
    const base = { name: "tool", content: "# tool" };
    await syncSkillsHubWorkspace(ws, config({
      skills: [{ ...base, files: [
        { path: "scripts/run.sh", content: "echo hi", encoding: "utf8" },
        { path: "img.bin", content: Buffer.from([0, 1, 2]).toString("base64"), encoding: "base64" },
        { path: "../escape.txt", content: "no", encoding: "utf8" },
      ] }],
      plugins: [],
      useHostSkills: true,
    }));
    assert.equal(await read(path.join(ws, ".claude/skills/tool/scripts/run.sh")), "echo hi");
    assert.deepEqual([...await readFile(path.join(ws, ".claude/skills/tool/img.bin"))], [0, 1, 2]);
    assert.equal(await exists(path.join(ws, ".claude/skills/escape.txt")), false);

    // Same content again: nothing rewritten.
    const same = await syncSkillsHubWorkspace(ws, config({
      skills: [{ ...base, files: [
        { path: "scripts/run.sh", content: "echo hi", encoding: "utf8" },
        { path: "img.bin", content: Buffer.from([0, 1, 2]).toString("base64"), encoding: "base64" },
        { path: "../escape.txt", content: "no", encoding: "utf8" },
      ] }],
      plugins: [],
      useHostSkills: true,
    }));
    assert.deepEqual(same?.written, []);

    // A file dropped from the skill disappears from the workspace.
    const changed = await syncSkillsHubWorkspace(ws, config({
      skills: [{ ...base, files: [{ path: "scripts/run.sh", content: "echo bye", encoding: "utf8" }] }],
      plugins: [],
      useHostSkills: true,
    }));
    assert.deepEqual(changed?.written, ["tool"]);
    assert.equal(await read(path.join(ws, ".claude/skills/tool/scripts/run.sh")), "echo bye");
    assert.equal(await exists(path.join(ws, ".claude/skills/tool/img.bin")), false);
  });
});

test("codex skills go to .agents/skills", async () => {
  await withWorkspace(async (ws) => {
    await syncSkillsHubWorkspace(ws, config({ skills: [{ name: "x", content: "c" }], plugins: [], useHostSkills: true }, "codex"));
    assert.equal(await read(path.join(ws, ".agents/skills/x/SKILL.md")), "c");
  });
});

test("plugins merge into .claude/settings.json and are withdrawn without touching other keys", async () => {
  await withWorkspace(async (ws) => {
    await mkdir(path.join(ws, ".claude"), { recursive: true });
    await writeFile(path.join(ws, ".claude/settings.json"), JSON.stringify({ model: "opus", enabledPlugins: { "own@m": false } }));

    await syncSkillsHubWorkspace(ws, config({
      skills: [],
      plugins: [
        { name: "figma@claude-plugins", marketplaceSource: { source: "github", repo: "anthropics/claude-plugins" } },
        { name: "own@m", marketplaceSource: null },
      ],
      useHostSkills: true,
    }));
    const enabled = JSON.parse(await read(path.join(ws, ".claude/settings.json")));
    assert.equal(enabled.model, "opus");
    assert.deepEqual(enabled.enabledPlugins, { "own@m": false, "figma@claude-plugins": true });
    assert.deepEqual(enabled.extraKnownMarketplaces, {
      "claude-plugins": { source: { source: "github", repo: "anthropics/claude-plugins" } },
    });

    await syncSkillsHubWorkspace(ws, config({ skills: [], plugins: [], useHostSkills: true }));
    const disabled = JSON.parse(await read(path.join(ws, ".claude/settings.json")));
    assert.deepEqual(disabled, { model: "opus", enabledPlugins: { "own@m": false } });
  });
});

test("an unparseable settings.json is never overwritten", async () => {
  await withWorkspace(async (ws) => {
    await mkdir(path.join(ws, ".claude"), { recursive: true });
    await writeFile(path.join(ws, ".claude/settings.json"), "{ broken");
    await syncSkillsHubWorkspace(ws, config({ skills: [], plugins: [{ name: "p@m", marketplaceSource: null }], useHostSkills: true }));
    assert.equal(await read(path.join(ws, ".claude/settings.json")), "{ broken");
  });
});

test("useHostSkills=false isolates Claude from user-level settings", () => {
  assert.equal(skillsHubIsolatesHost(config({ skills: [], plugins: [], useHostSkills: false })), true);
  assert.equal(skillsHubIsolatesHost(config({ skills: [], plugins: [], useHostSkills: true })), false);
  assert.equal(skillsHubIsolatesHost(config(undefined)), false);
});
