#!/usr/bin/env -S node --import=@oxc-node/core/register
/**
 * Destructive, local-only RisingWave CDC/MV bootstrap for raftdev.
 *
 * This is intentionally not a general deployment tool. raftdev gives every
 * environment an isolated Postgres/RisingWave pair and recreates the managed
 * RisingWave catalog before calling this script.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  RISINGWAVE_ARTIFACT_CDC_TABLES,
  RISINGWAVE_BOOTSTRAP_ARTIFACTS,
  RISINGWAVE_CDC_TABLES,
  RISINGWAVE_LOCAL_PUBLICATION,
  RISINGWAVE_LOCAL_SLOT,
  RISINGWAVE_LOCAL_SOURCE,
  RISINGWAVE_PUBLICATION_TABLES,
  RISINGWAVE_REQUIRED_RELATIONS,
  buildRisingWaveBootstrapStatements,
  createdRelationName,
} from "../../../scripts/dev/raftdev-risingwave-bootstrap";
import { barrierIntervalToRestore } from "./risingwave-bootstrap-barrier";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readBarrierIntervalMs(risingwave: pg.Client): Promise<number | null> {
  const result = await risingwave.query<Record<string, string>>("SHOW PARAMETERS");
  const row = result.rows.find((r) => (r.Name ?? r.name) === "barrier_interval_ms");
  const value = row ? (row.Value ?? row.value) : undefined;
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function safeConnectionUrl(raw: string, kind: "Postgres" | "RisingWave"): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${kind} connection URL is invalid`);
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`${kind} connection URL must use postgres:// or postgresql://`);
  }
  // node-postgres accepts libpq-style query parameters. Reject them rather
  // than validating URL.hostname and then allowing `?host=...` to override the
  // guarded loopback target underneath us.
  if (url.search || url.hash) {
    throw new Error(`${kind} connection URL must not contain query parameters or fragments`);
  }
  return url;
}

function isLoopbackHostname(hostname: string): boolean {
  return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname.toLowerCase());
}

function decodeUrlCredential(value: string, kind: "username" | "password"): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`Postgres connection URL has an invalid percent-encoded ${kind}`);
  }
}

function sqlLiteral(value: string): string {
  if (value.includes("\0")) throw new Error("CDC connection values cannot contain NUL bytes");
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

async function waitForExactSourceCounts(
  postgres: pg.Client,
  risingwave: pg.Client,
  tables: readonly { upstream: string; name: string }[],
  timeoutMs = 120_000,
): Promise<Record<string, number>> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() <= deadline) {
    const counts: Record<string, number> = {};
    const mismatches: string[] = [];
    for (const table of tables) {
      const pgResult = await postgres.query(
        `SELECT count(*)::text AS count FROM public.${sqlIdentifier(table.upstream)}`,
      );
      const rwResult = await risingwave.query(
        `SELECT count(*)::text AS count FROM ${sqlIdentifier(table.name)}`,
      );
      const pgCount = Number(pgResult.rows[0]?.count ?? -1);
      const rwCount = Number(rwResult.rows[0]?.count ?? -1);
      counts[table.name] = rwCount;
      if (pgCount !== rwCount) mismatches.push(`${table.name}:${rwCount}/${pgCount}`);
    }
    if (mismatches.length === 0) return counts;
    last = mismatches.join(", ");
    await sleep(500);
  }
  throw new Error(`CDC snapshot count parity timed out (${last || "no readable counts"})`);
}

async function replaceOwnedPublicationAndSlot(
  postgres: pg.Client,
  options: { releaseActiveSlot: boolean },
): Promise<void> {
  const readSlot = () => postgres.query<{ active: boolean; active_pid: number | null }>(
    "SELECT active, active_pid FROM pg_replication_slots WHERE slot_name = $1",
    [RISINGWAVE_LOCAL_SLOT],
  );
  let slot = await readSlot();
  if (slot.rows[0]?.active && options.releaseActiveSlot) {
    // Self-host rebuild: the CDC source was just dropped, and RisingWave lets
    // go of its replication connection a moment later. Wait for that, and if
    // it never comes, end the walsender that still holds the slot.
    const deadline = Date.now() + SLOT_RELEASE_TIMEOUT_MS;
    while (slot.rows[0]?.active && Date.now() < deadline) {
      await sleep(1_000);
      slot = await readSlot();
    }
    const pid = slot.rows[0]?.active ? slot.rows[0].active_pid : null;
    if (pid !== null && pid !== undefined) {
      console.error(`[rw-bootstrap] slot ${RISINGWAVE_LOCAL_SLOT} still held by pid ${pid}; terminating it`);
      await postgres.query("SELECT pg_terminate_backend($1)", [pid]);
      const terminateDeadline = Date.now() + 10_000;
      do {
        await sleep(500);
        slot = await readSlot();
      } while (slot.rows[0]?.active && Date.now() < terminateDeadline);
    }
  }
  if (slot.rows[0]?.active) {
    throw new Error(`owned replication slot ${RISINGWAVE_LOCAL_SLOT} is still active`);
  }
  if (slot.rowCount) {
    await postgres.query("SELECT pg_drop_replication_slot($1)", [RISINGWAVE_LOCAL_SLOT]);
  }
  await postgres.query(`DROP PUBLICATION IF EXISTS ${sqlIdentifier(RISINGWAVE_LOCAL_PUBLICATION)}`);
  const publicationTables = RISINGWAVE_PUBLICATION_TABLES
    .map((name) => `public.${sqlIdentifier(name)}`)
    .join(", ");
  await postgres.query(
    `CREATE PUBLICATION ${sqlIdentifier(RISINGWAVE_LOCAL_PUBLICATION)} FOR TABLE ${publicationTables}`,
  );
}

async function assertPublication(postgres: pg.Client): Promise<void> {
  const result = await postgres.query<{ tablename: string }>(
    "SELECT tablename FROM pg_publication_tables WHERE pubname = $1 ORDER BY tablename",
    [RISINGWAVE_LOCAL_PUBLICATION],
  );
  const actual = result.rows.map((row) => row.tablename).sort();
  const expected = [...RISINGWAVE_PUBLICATION_TABLES].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`publication table set mismatch: expected ${expected.length}, got ${actual.length}`);
  }
}

async function createCdcSource(risingwave: pg.Client, options: {
  host: string;
  port: number;
  username: string;
  password: string;
}): Promise<void> {
  const sourceSql = [
    `CREATE SOURCE ${RISINGWAVE_LOCAL_SOURCE} WITH (`,
    "  connector = 'postgres-cdc',",
    `  hostname = ${sqlLiteral(options.host)},`,
    `  port = ${sqlLiteral(String(options.port))},`,
    `  username = ${sqlLiteral(options.username)},`,
    `  password = ${sqlLiteral(options.password)},`,
    "  database.name = 'slock',",
    "  schema.name = 'public',",
    `  slot.name = '${RISINGWAVE_LOCAL_SLOT}',`,
    `  publication.name = '${RISINGWAVE_LOCAL_PUBLICATION}',`,
    "  publication.create.enable = 'false'",
    ")",
  ].join("\n");
  await risingwave.query(sourceSql);
}

async function alreadyBootstrapped(risingwave: pg.Client): Promise<boolean> {
  const result = await risingwave.query(
    "SELECT 1 FROM rw_catalog.rw_sources WHERE name = $1",
    [RISINGWAVE_LOCAL_SOURCE],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Self-host only: drops the whole serving graph in this RisingWave database
 * (the CDC source and everything built on it, then anything left in public),
 * so the bootstrap below can build the current one.
 */
async function dropSelfHostGraph(risingwave: pg.Client): Promise<void> {
  await risingwave.query(`DROP SOURCE IF EXISTS ${RISINGWAVE_LOCAL_SOURCE} CASCADE`);
  for (const [catalog, kind] of [
    ["rw_sinks", "SINK"],
    ["rw_materialized_views", "MATERIALIZED VIEW"],
    ["rw_views", "VIEW"],
    ["rw_tables", "TABLE"],
    ["rw_sources", "SOURCE"],
  ] as const) {
    let names: string[] = [];
    try {
      const rows = await risingwave.query<{ name: string }>(
        `SELECT r.name FROM rw_catalog.${catalog} r JOIN rw_catalog.rw_schemas s ON s.id = r.schema_id WHERE s.name = 'public'`,
      );
      names = rows.rows.map((row) => row.name);
    } catch (error) {
      console.error(`[rw-bootstrap] could not list ${kind}s: ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const name of names) {
      try {
        await risingwave.query(`DROP ${kind} IF EXISTS "${name.replaceAll('"', '""')}" CASCADE`);
      } catch (error) {
        console.error(`[rw-bootstrap] could not drop ${kind} ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

async function assertRequiredRelations(risingwave: pg.Client): Promise<void> {
  const names = RISINGWAVE_REQUIRED_RELATIONS.map(sqlLiteral).join(", ");
  const result = await risingwave.query<{ name: string }>(
    `SELECT name FROM rw_catalog.rw_relations WHERE name IN (${names}) ORDER BY name`,
  );
  const actual = new Set(result.rows.map((row) => row.name));
  const missing = RISINGWAVE_REQUIRED_RELATIONS.filter((name) => !actual.has(name));
  if (missing.length > 0) throw new Error(`RisingWave serving graph is missing: ${missing.join(", ")}`);

  const ddl = await risingwave.query<{ count: string }>("SELECT count(*)::text AS count FROM rw_catalog.rw_ddl_progress");
  if (Number(ddl.rows[0]?.count ?? -1) !== 0) {
    throw new Error("RisingWave still has background DDL in progress");
  }

  const muteColumns = await risingwave.query<{ column_name: string }>([
    "SELECT column_name FROM information_schema.columns",
    "WHERE table_schema = 'public' AND table_name = 'rw_inbox_target_mute_states_v2'",
    "ORDER BY ordinal_position",
  ].join(" "));
  const expectedMuteColumns = [
    "receiver_type", "receiver_id", "server_id", "source_channel_id",
    "activity_muted", "mute_from_seq", "prefs_version", "created_at", "updated_at",
  ];
  if (JSON.stringify(muteColumns.rows.map((row) => row.column_name)) !== JSON.stringify(expectedMuteColumns)) {
    throw new Error("rw_inbox_target_mute_states_v2 does not have the required nine-column shape");
  }

  // Serving invariants on the view the server reads (UNIFIED_CHAIN_VIEWS.serving).
  for (const [predicate, message] of [
    ["kind IN ('thread', 'task') AND reply_count IS NULL", "serving thread / task conversation rows have NULL reply_count"],
    ["mention_only AND activity_at IS NULL", "mention-only serving rows must carry the mention timestamp as activity_at"],
    [
      "mention_only AND latest_activity_message_id IS NULL",
      "mention-only serving rows must anchor latest_activity to the mention message (requireLatestActivitySeq hard-rejects NULL)",
    ],
  ] as const) {
    const invalid = await risingwave.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM rw_inbox_serving_v9 WHERE ${predicate}`,
    );
    if (Number(invalid.rows[0]?.count ?? -1) !== 0) {
      throw new Error(`serving invariant failed: ${message}`);
    }
  }
}

async function main(): Promise<void> {
  // Self-hosted docker-compose (deploy/self-host) runs this once against its
  // own Postgres/RisingWave containers, which are not on loopback and not
  // raftdev-named. It is not destructive there: an already bootstrapped
  // RisingWave is left alone (see alreadyBootstrapped below).
  const selfHost = process.env.RAFT_SELF_HOST_RISINGWAVE_BOOTSTRAP === "1";
  if (!selfHost && process.env.RAFTDEV_RISINGWAVE_BOOTSTRAP !== "1") {
    throw new Error("refusing destructive bootstrap without RAFTDEV_RISINGWAVE_BOOTSTRAP=1");
  }

  const postgresUrl = safeConnectionUrl(requiredEnv("DATABASE_URL"), "Postgres");
  const risingwaveUrl = safeConnectionUrl(requiredEnv("RISINGWAVE_DATABASE_URL"), "RisingWave");
  if (postgresUrl.pathname !== "/slock") throw new Error("local Postgres database must be slock");
  if (risingwaveUrl.pathname !== "/dev") throw new Error("local RisingWave database must be dev");
  if (!selfHost && !isLoopbackHostname(postgresUrl.hostname)) {
    throw new Error("refusing to modify a non-loopback Postgres instance");
  }
  if (!selfHost && !isLoopbackHostname(risingwaveUrl.hostname)) {
    throw new Error("refusing to bootstrap a non-loopback RisingWave instance");
  }

  const cdcHost = requiredEnv("RISINGWAVE_CDC_HOST");
  const cdcEnvironment = /^slock-dev-([A-Za-z0-9._-]{1,128})-pg$/.exec(cdcHost)?.[1];
  if (!selfHost && (!cdcEnvironment || cdcEnvironment === "." || cdcEnvironment === "..")) {
    throw new Error("RISINGWAVE_CDC_HOST must be a managed raftdev Postgres container name");
  }
  const cdcPort = Number(process.env.RISINGWAVE_CDC_PORT ?? "5432");
  if (!Number.isInteger(cdcPort) || cdcPort < 1 || cdcPort > 65535) {
    throw new Error("RISINGWAVE_CDC_PORT must be an integer between 1 and 65535");
  }
  const cdcUsername = requiredEnv("RISINGWAVE_CDC_USERNAME");
  const cdcPassword = requiredEnv("RISINGWAVE_CDC_PASSWORD");
  if (
    cdcUsername !== decodeUrlCredential(postgresUrl.username, "username") ||
    cdcPassword !== decodeUrlCredential(postgresUrl.password, "password")
  ) {
    throw new Error("CDC credentials must match the guarded local Postgres connection URL");
  }

  const postgres = new pg.Client({
    connectionString: postgresUrl.toString(),
    connectionTimeoutMillis: 10_000,
  });
  const risingwave = new pg.Client({
    connectionString: risingwaveUrl.toString(),
    connectionTimeoutMillis: 10_000,
  });
  await postgres.connect();
  await risingwave.connect();
  let restoreBarrierIntervalMs: number | null = null;
  let rebuilding = false;
  try {
    if (selfHost && await alreadyBootstrapped(risingwave)) {
      try {
        await assertRequiredRelations(risingwave);
        console.log(JSON.stringify({ ok: true, skipped: "already bootstrapped" }));
        return;
      } catch (error) {
        // An upgrade whose serving graph has relations this RisingWave lacks
        // (upstream merges add MVs): rebuild it from scratch. Everything here
        // derives from Postgres through CDC, so nothing is lost.
        const detail = error instanceof Error ? error.message : String(error);
        console.error(`[rw-bootstrap] the existing graph is out of date (${detail}); rebuilding it`);
        await dropSelfHostGraph(risingwave);
        rebuilding = true;
      }
    }
    // Loopback-only (checked above): this never touches a staging or
    // production RisingWave. Build at the normal interval, never the
    // shortened one: a snapshot-backfill MV (rw_thread_parent_v3) replays
    // every upstream epoch, and at BOOTSTRAP_BARRIER_INTERVAL_MS it fell
    // behind for good (~2000 epochs queued, Snapshot 0%, bootstrap failed)
    // while at 1000ms each MV builds in ~3s. A leftover shortened interval
    // from a killed bootstrap is reset here, and restored again in `finally`.
    restoreBarrierIntervalMs = barrierIntervalToRestore(await readBarrierIntervalMs(risingwave));
    await risingwave.query(`ALTER SYSTEM SET barrier_interval_ms = ${restoreBarrierIntervalMs}`);
    const wal = await postgres.query<{ wal_level: string }>("SHOW wal_level");
    if (wal.rows[0]?.wal_level !== "logical") {
      throw new Error(`Postgres wal_level must be logical, got ${wal.rows[0]?.wal_level ?? "unknown"}`);
    }

    await replaceOwnedPublicationAndSlot(postgres, { releaseActiveSlot: rebuilding });
    await assertPublication(postgres);
    await createCdcSource(risingwave, {
      host: cdcHost,
      port: cdcPort,
      username: cdcUsername,
      password: cdcPassword,
    });

    const statements = buildRisingWaveBootstrapStatements(Object.fromEntries(
      RISINGWAVE_BOOTSTRAP_ARTIFACTS.map((artifact) => [
        artifact.file,
        readFileSync(join(ROOT, artifact.file), "utf8"),
      ]),
    ));
    const pendingCdcRelations = new Set(RISINGWAVE_CDC_TABLES.map((table) => table.name));
    let sourceCounts: Record<string, number> | null = null;
    for (let index = 0; index < statements.length; index++) {
      const statement = statements[index];
      const started = Date.now();
      try {
        await risingwave.query(statement);
        const created = createdRelationName(statement);
        if (created) console.error(`[rw-bootstrap] ${index + 1}/${statements.length} ${created} (${Date.now() - started}ms)`);
      } catch (error) {
        const relation = createdRelationName(statement);
        const label = relation ? ` while creating ${relation}` : "";
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `RisingWave statement ${index + 1}/${statements.length} failed${label}: ${detail}`,
          { cause: error },
        );
      }
      const relation = createdRelationName(statement);
      if (relation) pendingCdcRelations.delete(relation);
      if (pendingCdcRelations.size === 0 && sourceCounts === null) {
        sourceCounts = await waitForExactSourceCounts(postgres, risingwave, RISINGWAVE_CDC_TABLES);
      }
    }
    if (sourceCounts === null) {
      throw new Error(
        `bootstrap composition did not create CDC relations: ${[...pendingCdcRelations].join(", ")}`,
      );
    }
    const artifactCdcCounts = await waitForExactSourceCounts(postgres, risingwave, RISINGWAVE_ARTIFACT_CDC_TABLES);
    await assertRequiredRelations(risingwave);

    console.log(JSON.stringify({
      ok: true,
      source: RISINGWAVE_LOCAL_SOURCE,
      publication: RISINGWAVE_LOCAL_PUBLICATION,
      slot: RISINGWAVE_LOCAL_SLOT,
      publicationTableCount: RISINGWAVE_PUBLICATION_TABLES.length,
      cdcTableCount: RISINGWAVE_CDC_TABLES.length + RISINGWAVE_ARTIFACT_CDC_TABLES.length,
      relationCount: RISINGWAVE_REQUIRED_RELATIONS.length,
      sourceCounts: { ...sourceCounts, ...artifactCdcCounts },
    }, null, 2));
  } finally {
    // The 11-06 CI timeout came after the summary above was printed: the work
    // was done and only this cleanup was left. Each step is bounded and
    // logged, so a hang here shows where it is and cannot hold the run.
    if (restoreBarrierIntervalMs !== null) {
      const restore = restoreBarrierIntervalMs;
      await withinMs(
        "restore barrier_interval_ms",
        CLEANUP_STEP_TIMEOUT_MS,
        risingwave.query(`ALTER SYSTEM SET barrier_interval_ms = ${restore}`),
      ).catch((error: unknown) => {
        console.error(`[rw-bootstrap] could not restore barrier_interval_ms=${restore}: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
    await withinMs(
      "close connections",
      CLEANUP_STEP_TIMEOUT_MS,
      Promise.allSettled([postgres.end(), risingwave.end()]),
    ).catch((error: unknown) => {
      console.error(`[rw-bootstrap] ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}

const CLEANUP_STEP_TIMEOUT_MS = 30_000;
const SLOT_RELEASE_TIMEOUT_MS = 60_000;

async function withinMs<T>(label: string, ms: number, work: Promise<T>): Promise<T> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} did not finish within ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    console.error(`[rw-bootstrap] ${label} (${Date.now() - started}ms)`);
  }
}

// Exit explicitly: a handle left open by a driver must not keep a finished
// bootstrap alive until the CI step's timeout.
main().then(() => process.stdout.write("", () => process.exit(0)), (error) => {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [
    process.env.DATABASE_URL,
    process.env.RISINGWAVE_DATABASE_URL,
    process.env.RISINGWAVE_CDC_PASSWORD,
  ]) {
    if (secret) message = message.replaceAll(secret, "<redacted>");
  }
  console.error(`RisingWave local bootstrap failed: ${message}`);
  process.exit(1);
});
