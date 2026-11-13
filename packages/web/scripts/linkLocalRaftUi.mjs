#!/usr/bin/env node
// Point web at a local raft-design checkout, so raft-ui and ricons edits show
// up in the web dev server without publishing.
//
//   pnpm --filter @botiverse/raft-web ui:link [path/to/raft-design]   (default ../raft-design next to this repo)
//   pnpm --filter @botiverse/raft-web ui:unlink
//   pnpm --filter @botiverse/raft-web ui:status
//
// Only symlinks under packages/web/node_modules change; no tracked file does,
// so git stays clean. The original links are saved beside them and restored
// by unlink (a fresh `pnpm install` restores them too). vite.config.ts sees a
// linked raft-ui by itself (localRaftDesignRoot) and lets Vite serve it.
// In raft-design, keep `vp run @botiverse/raft-ui#dev` running: the web reads
// raft-ui's built dist, which that rebuilds on every save.
import { existsSync, lstatSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(webRoot, "../..");
const modules = join(webRoot, "node_modules");
const stateFile = join(modules, ".local-raft-ui.json");

// node_modules entry → package dir inside raft-design.
const LINKS = [
  ["@botiverse/raft-ui", "packages/ui"],
  ["raft-ui", "packages/ui"],
  ["@botiverse/ricons", "packages/icons"],
];

function replaceLink(entry, target) {
  const path = join(modules, entry);
  if (existsSync(path) || isLink(path)) rmSync(path, { recursive: false, force: true });
  symlinkSync(target, path, "dir");
}

function isLink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function readState() {
  return existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : null;
}

function link(designArg) {
  const designRoot = resolve(designArg ?? join(repoRoot, "../raft-design"));
  for (const [, dir] of LINKS) {
    if (!existsSync(join(designRoot, dir, "package.json"))) {
      throw new Error(`${join(designRoot, dir)} is not a package; pass the raft-design checkout path`);
    }
  }
  if (!existsSync(join(designRoot, "packages/ui/dist/index.mjs"))) {
    throw new Error(`raft-ui is not built yet: run \`vp install && vp run @botiverse/raft-ui#dev\` in ${designRoot}`);
  }
  const previous = readState();
  const original = previous?.original ?? Object.fromEntries(LINKS.map(([entry]) => [entry, readlinkSync(join(modules, entry))]));
  for (const [entry, dir] of LINKS) replaceLink(entry, join(designRoot, dir));
  writeFileSync(stateFile, `${JSON.stringify({ designRoot, original }, null, 2)}\n`);
  console.log(`web now uses raft-ui and ricons from ${designRoot}. Restart the web dev server.`);
}

function unlink() {
  const state = readState();
  if (!state) {
    console.log("Not linked.");
    return;
  }
  for (const [entry, target] of Object.entries(state.original)) replaceLink(entry, target);
  rmSync(stateFile);
  console.log("web uses the npm raft-ui and ricons again. Restart the web dev server.");
}

function status() {
  const state = readState();
  console.log(state ? `Linked to ${state.designRoot}` : "Not linked (npm packages).");
}

const [command, arg] = process.argv.slice(2);
if (command === "link") link(arg);
else if (command === "unlink") unlink();
else if (command === "status") status();
else {
  console.error("usage: linkLocalRaftUi.mjs link [raft-design path] | unlink | status");
  process.exit(1);
}
