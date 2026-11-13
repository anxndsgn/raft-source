import assert from "node:assert/strict";
import { afterEach, vi } from "vitest";
import {
  findSkillCandidates,
  parseGithubLocation,
  parseMarketplaceManifest,
  readGithubSkills,
  readSkillFrontmatter,
  scanGithubMarketplace,
  scanGithubSkills,
  skillsHubNameFor,
} from "./skillsHubGithub";
import { SkillsHubError } from "./skillsHubService";

const SHA = "a".repeat(40);

afterEach(() => {
  vi.unstubAllGlobals();
});

test("parses the GitHub address forms people paste", () => {
  assert.deepEqual(parseGithubLocation("anthropics/skills"), { owner: "anthropics", repo: "skills", refAndPath: [] });
  assert.deepEqual(parseGithubLocation("https://github.com/anthropics/skills.git"), { owner: "anthropics", repo: "skills", refAndPath: [] });
  assert.deepEqual(parseGithubLocation("github.com/a/b/tree/main/skills/pdf"), { owner: "a", repo: "b", refAndPath: ["main", "skills", "pdf"] });
  assert.deepEqual(parseGithubLocation("git@github.com:a/b.git"), { owner: "a", repo: "b", refAndPath: [] });
  for (const bad of ["", "https://gitlab.com/a/b", "https://github.com/a"]) {
    assert.throws(() => parseGithubLocation(bad), SkillsHubError, bad);
  }
});

test("finds skill directories and gives each file to its deepest skill", () => {
  const tree = [
    { path: "README.md", type: "blob", size: 1 },
    { path: "skills/pdf/SKILL.md", type: "blob", size: 1 },
    { path: "skills/pdf/scripts/fill.py", type: "blob", size: 10 },
    { path: "skills/pdf/forms/SKILL.md", type: "blob", size: 1 },
    { path: "skills/pdf/forms/ref.md", type: "blob", size: 5 },
    { path: "skills/pdf/node_modules/x/SKILL.md", type: "blob", size: 1 },
    { path: "other/SKILL.md", type: "blob", size: 1 },
  ];
  assert.deepEqual(findSkillCandidates(tree, "skills"), [
    { path: "skills/pdf", files: [{ path: "scripts/fill.py", size: 10 }] },
    { path: "skills/pdf/forms", files: [{ path: "ref.md", size: 5 }] },
  ]);
  assert.deepEqual(findSkillCandidates(tree, "").map((c) => c.path), ["other", "skills/pdf", "skills/pdf/forms"]);
});

test("frontmatter name becomes a valid hub name", () => {
  assert.deepEqual(readSkillFrontmatter("---\nname: PDF Tools\ndescription: \"Fill PDF forms\"\n---\nbody"), { name: "PDF Tools", description: "Fill PDF forms" });
  assert.equal(skillsHubNameFor("PDF Tools", "skills/pdf", "repo"), "pdf-tools");
  assert.equal(skillsHubNameFor(null, "skills/Web_Design", "repo"), "web_design");
  assert.equal(skillsHubNameFor(null, "", "My.Repo"), "my.repo");
});

function stubGithub(files: Record<string, string>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    if (url === "https://api.github.com/repos/o/r") return Response.json({ default_branch: "main" });
    if (url === "https://api.github.com/repos/o/r/commits/main") return new Response(SHA);
    if (url.startsWith("https://api.github.com/repos/o/r/commits/")) return new Response("", { status: 404 });
    if (url === `https://api.github.com/repos/o/r/git/trees/${SHA}?recursive=1`) {
      return Response.json({ tree: Object.entries(files).map(([path, body]) => ({ path, type: "blob", size: body.length })) });
    }
    const raw = `https://raw.githubusercontent.com/o/r/${SHA}/`;
    if (url.startsWith(raw)) {
      const body = files[decodeURIComponent(url.slice(raw.length))];
      return body === undefined ? new Response("", { status: 404 }) : new Response(body);
    }
    return new Response("", { status: 500 });
  }));
  return calls;
}

test("scan lists skills under a tree link; import reads every file at the pinned commit", async () => {
  stubGithub({
    "skills/pdf/SKILL.md": "---\nname: pdf\ndescription: PDF help\n---\n# pdf",
    "skills/pdf/scripts/fill.py": "print(1)",
    "skills/pdf/logo.png": "\u0000\u0001",
    "docs/SKILL.md": "# docs",
  });
  const scan = await scanGithubSkills("https://github.com/o/r/tree/main/skills");
  assert.equal(scan.ref.commitSha, SHA);
  assert.equal(scan.ref.basePath, "skills");
  assert.deepEqual(scan.skills, [{ path: "skills/pdf", name: "pdf", description: "PDF help", fileCount: 2 }]);

  const [skill] = await readGithubSkills("o/r", SHA, ["skills/pdf"]);
  assert.equal(skill!.name, "pdf");
  assert.deepEqual(skill!.source, { type: "github", repo: "o/r", ref: "main", commitSha: SHA, path: "skills/pdf" });
  assert.deepEqual(skill!.files.map((f) => [f.path, f.encoding]).sort(), [["logo.png", "base64"], ["scripts/fill.py", "utf8"]]);
  await assert.rejects(readGithubSkills("o/r", SHA, ["nope"]), (e: unknown) => e instanceof SkillsHubError && e.code === "skills_hub_github_not_found");
});

test("a missing repository reads as not found", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
  await assert.rejects(scanGithubSkills("o/missing"), (e: unknown) => e instanceof SkillsHubError && e.code === "skills_hub_github_not_found");
});

test("a marketplace manifest yields its name and the plugins with valid ids", () => {
  const manifest = parseMarketplaceManifest(JSON.stringify({
    name: "cursor-plugins",
    plugins: [
      { name: "pstack", description: " Stack tools ", version: "1.2.0", source: "./pstack" },
      { name: "pstack", description: "duplicate" },
      { name: "bad name" },
      "not an object",
      { name: "origin-apps" },
    ],
  }));
  assert.deepEqual(manifest, {
    name: "cursor-plugins",
    plugins: [
      { name: "pstack", description: "Stack tools", version: "1.2.0" },
      { name: "origin-apps", description: null, version: null },
    ],
  });
  assert.throws(() => parseMarketplaceManifest("{"), SkillsHubError);
  assert.throws(() => parseMarketplaceManifest(JSON.stringify({ plugins: [] })), SkillsHubError);
});

test("marketplace scan reads .claude-plugin/marketplace.json at the resolved commit", async () => {
  const calls = stubGithub({
    ".claude-plugin/marketplace.json": JSON.stringify({ name: "m", plugins: [{ name: "p", description: "d" }] }),
  });
  const scan = await scanGithubMarketplace("https://github.com/o/r/");
  assert.equal(scan.ref.commitSha, SHA);
  assert.deepEqual(scan.marketplace, { name: "m", plugins: [{ name: "p", description: "d", version: null }] });
  assert.ok(calls.includes(`https://raw.githubusercontent.com/o/r/${SHA}/.claude-plugin/marketplace.json`));
});

test("a repository without a marketplace manifest reads as not found", async () => {
  stubGithub({ "README.md": "hi" });
  await assert.rejects(scanGithubMarketplace("o/r"), (e: unknown) => e instanceof SkillsHubError && e.code === "skills_hub_github_not_found");
});
