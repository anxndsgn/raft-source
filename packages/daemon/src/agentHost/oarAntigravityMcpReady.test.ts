import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  __resetManagedMcpRuntimeProxyForTest,
  managedMcpRuntimeServerName,
  registerManagedMcpRuntimeProxy,
  unregisterManagedMcpRuntimeProxyForLaunch,
} from "../managedMcpRuntimeProxy";
import { antigravityOarLaunch, awaitAgyManagedMcp } from "./oarAntigravityLaunch";
import type { SpawnContext } from "../drivers/types";

afterEach(async () => {
  await __resetManagedMcpRuntimeProxyForTest();
});

async function register(agentId: string, launchId: string) {
  return registerManagedMcpRuntimeProxy({
    agentId,
    launchId,
    snapshot: { catalogVersion: 1, tools: [] },
    async callTool() {
      return { isError: false, content: [] };
    },
  });
}

async function listTools(url: string): Promise<void> {
  const client = new Client({ name: "agy-like", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  try {
    await client.listTools();
  } finally {
    await client.close();
  }
}

test("a launch without managed MCP does not wait", async () => {
  const ready = await awaitAgyManagedMcp({ agentId: "a", launchId: "l" }, new AbortController().signal, 5_000);
  assert.equal(ready.outcome, "ready");
  assert.equal(ready.waitedFor, "managed_mcp");
});

test("the first input waits until agy has listed the launch's tools (task #23)", async () => {
  const endpoint = await register("agent-1", "launch-1");
  let settled = false;
  const waiting = awaitAgyManagedMcp({ agentId: "agent-1", launchId: "launch-1" }, new AbortController().signal, 5_000)
    .finally(() => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(settled, false);
  await listTools(endpoint.url);
  assert.equal((await waiting).outcome, "ready");
  // Already listed: a later wait for the same launch returns at once.
  assert.equal((await awaitAgyManagedMcp({ agentId: "agent-1", launchId: "launch-1" }, new AbortController().signal, 5_000)).outcome, "ready");
});

test("another launch's listing does not end the wait; the timeout does", async () => {
  const other = await register("agent-1", "launch-old");
  await register("agent-1", "launch-new");
  const waiting = awaitAgyManagedMcp({ agentId: "agent-1", launchId: "launch-new" }, new AbortController().signal, 200);
  await listTools(other.url);
  assert.equal((await waiting).outcome, "timeout");
});

test("a stopped start ends the wait", async () => {
  await register("agent-1", "launch-1");
  const abort = new AbortController();
  const waiting = awaitAgyManagedMcp({ agentId: "agent-1", launchId: "launch-1" }, abort.signal, 5_000);
  abort.abort();
  assert.equal((await waiting).outcome, "stopped");
});

test("the managed server keeps one name across an agent's launches, distinct per agent", async () => {
  const first = await register("agent-1", "launch-1");
  unregisterManagedMcpRuntimeProxyForLaunch({ agentId: "agent-1", launchId: "launch-1" });
  const second = await register("agent-1", "launch-2");
  const otherAgent = await register("agent-2", "launch-3");
  assert.equal(first.name, second.name);
  assert.equal(first.name, managedMcpRuntimeServerName("agent-1"));
  assert.notEqual(first.name, otherAgent.name);
  assert.match(first.name, /^rm[A-Za-z0-9]{6}$/);
  assert.notEqual(first.token, second.token);
});

test("the agy launch waits for managed MCP before its first input", () => {
  const launch = antigravityOarLaunch({
    agentId: "agent-1",
    launchId: "launch-1",
    config: { name: "a", displayName: null, description: null, model: "default", runtime: "antigravity", reasoningEffort: null, envVars: null, sessionId: null, serverUrl: "http://localhost:3001", authToken: "" },
    standingPrompt: "",
    prompt: "",
    workingDirectory: "/work",
  } as unknown as SpawnContext, { command: "/bin/agy", env: {} }, {});
  assert.equal(typeof launch.firstInputReady, "function");
});
