// Database setup for a self-hosted server (deploy/self-host). Runs the steps
// of the `db:migrate:deploy` package script except the three that only make
// sense on Raft's own staging/production (the same three raftdev skips:
// DEV_SKIPPED_DEPLOY_STEPS in scripts/dev/raftdev.ts), plus the create script
// of every post-migration index the deploy does not build, just before the
// index check, so a fresh self-hosted database gets production's index set.
// Every step is idempotent: run it on every upgrade before starting the server.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POST_MIGRATION_INDEXES } from "../src/db/postMigrationIndexes";

const SKIPPED = new Set([
  "scripts/migration-preflight.ts",
  "scripts/verify-feature-flag-admin-privileges.ts",
  "scripts/verify-app-admin-privileges.ts",
]);
const VERIFY = "scripts/verify-post-migration-indexes.ts";
const STEP = /^node --import @oxc-node\/core\/register (scripts\/[\w.-]+\.ts)$/;

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = (JSON.parse(readFileSync(path.join(serverDir, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
}).scripts;

function stepPath(command: string): string {
  const match = STEP.exec(command.trim());
  if (!match) throw new Error(`unexpected migration step: ${command.trim()}`);
  return match[1];
}

const deploy = (scripts["db:migrate:deploy"] ?? "").split("&&").map(stepPath).filter((s) => !SKIPPED.has(s));
const verifyAt = deploy.indexOf(VERIFY);
if (verifyAt === -1) throw new Error(`db:migrate:deploy no longer runs ${VERIFY}`);
const extra: string[] = [];
for (const index of POST_MIGRATION_INDEXES) {
  const script = stepPath(scripts[index.createScript] ?? "");
  if (!deploy.includes(script) && !extra.includes(script)) extra.push(script);
}
const steps = [...deploy.slice(0, verifyAt), ...extra, ...deploy.slice(verifyAt)];

const env: NodeJS.ProcessEnv = {
  ...process.env,
  SERVER_MIGRATION_PHASE_CONTRACT_REQUIRED: "false",
  POST_MIGRATION_INDEX_GUARD_REQUIRED: "1",
};

for (const [i, step] of steps.entries()) {
  console.log(`[self-host-migrate] ${i + 1}/${steps.length} ${step}`);
  const result = spawnSync(process.execPath, ["--import", "@oxc-node/core/register", step], {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`[self-host-migrate] ${step} failed (exit ${result.status ?? result.signal})`);
    process.exit(1);
  }
}
console.log("[self-host-migrate] database is up to date");
