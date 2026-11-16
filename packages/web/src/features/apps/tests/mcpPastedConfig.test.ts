import { describe, expect, test } from "vitest";
import { authorizationValue, bearerKey, parsePastedMcp } from "../mcp/mcpPastedConfig";

describe("parsePastedMcp", () => {
  test("a bare address", () => {
    expect(parsePastedMcp("  https://mcp.notion.com/mcp ")).toEqual({ kind: "servers", servers: [{ name: null, url: "https://mcp.notion.com/mcp", headers: {} }], localOnly: [] });
  });
  test("an mcpServers configuration with headers, several servers and a local one", () => {
    const parsed = parsePastedMcp(JSON.stringify({
      mcpServers: {
        umami: { type: "http", url: "https://umami.example.com/mcp", headers: { Authorization: "Bearer abc" } },
        linear: { url: "https://mcp.linear.app/mcp" },
        files: { command: "npx", args: ["-y", "server-files"] },
      },
    }));
    expect(parsed).toEqual({
      kind: "servers",
      servers: [
        { name: "umami", url: "https://umami.example.com/mcp", headers: { Authorization: "Bearer abc" } },
        { name: "linear", url: "https://mcp.linear.app/mcp", headers: {} },
      ],
      localOnly: ["files"],
    });
  });
  test("a fragment and a single server object", () => {
    expect(parsePastedMcp('"sentry": { "url": "https://mcp.sentry.dev/mcp" },')).toMatchObject({ kind: "servers", servers: [{ name: "sentry" }] });
    expect(parsePastedMcp('{ "serverUrl": "https://x.example.com/mcp" }')).toMatchObject({ kind: "servers", servers: [{ name: null, url: "https://x.example.com/mcp" }] });
  });
  test("only local servers, nonsense and empty", () => {
    expect(parsePastedMcp('{"mcpServers":{"a":{"command":"node"}}}')).toEqual({ kind: "servers", servers: [], localOnly: ["a"] });
    expect(parsePastedMcp("hello world")).toEqual({ kind: "invalid" });
    expect(parsePastedMcp("{ not json")).toEqual({ kind: "invalid" });
    expect(parsePastedMcp("   ")).toEqual({ kind: "empty" });
  });
});

describe("keys", () => {
  test("Bearer is added once", () => {
    expect(authorizationValue(" sk-123 ")).toBe("Bearer sk-123");
    expect(authorizationValue("Bearer sk-123")).toBe("Bearer sk-123");
    expect(bearerKey({ authorization: "Bearer sk-9" })).toBe("sk-9");
    expect(bearerKey({ "X-Api-Key": "k" })).toBeNull();
  });
});
