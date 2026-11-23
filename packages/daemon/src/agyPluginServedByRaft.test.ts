import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyServedByRaft } from "./agyPluginSync";

describe("applyServedByRaft", () => {
  it("leaves served servers out, keeps the original, and restores it", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "raft-agy-served-"));
    const original = { mcpServers: { "paddle-live": { serverUrl: "https://mcp.paddle.com/mcp" }, "paddle-docs": { serverUrl: "https://d" } } };
    writeFileSync(path.join(dir, "mcp_config.json"), JSON.stringify(original));
    const read = () => JSON.parse(readFileSync(path.join(dir, "mcp_config.json"), "utf8"));

    expect((await applyServedByRaft(dir, ["paddle-live"]))?.ok).toBe(true);
    expect(Object.keys(read().mcpServers)).toEqual(["paddle-docs"]);
    expect(await applyServedByRaft(dir, ["paddle-live"])).toBeNull();
    expect((await applyServedByRaft(dir, ["paddle-live", "paddle-docs"]))?.ok).toBe(true);
    expect(read().mcpServers).toEqual({});
    expect((await applyServedByRaft(dir, []))?.ok).toBe(true);
    expect(read()).toEqual(original);
    expect(existsSync(path.join(dir, "mcp_config.raft-original.json"))).toBe(false);
    expect(await applyServedByRaft(dir, [])).toBeNull();
  });

  it("ignores a plugin without MCP config", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "raft-agy-served-"));
    expect(await applyServedByRaft(dir, ["x"])).toBeNull();
  });
});
