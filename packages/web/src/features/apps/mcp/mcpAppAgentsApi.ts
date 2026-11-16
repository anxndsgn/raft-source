import type { McpAppAgentsResponse } from "@botiverse/raft-shared";
import api from "../../../api/client";

/** Every Agent on the server and whether it has this MCP App (task #18). */
export async function fetchMcpAppAgents(appId: string): Promise<McpAppAgentsResponse> {
  const { data } = await api.get<McpAppAgentsResponse>(`/mcp/apps/${encodeURIComponent(appId)}/agents`);
  return data;
}

/** These Agents, and only these: the App switches to "checked Agents only". */
export async function saveMcpAppAgents(appId: string, agentIds: readonly string[]): Promise<McpAppAgentsResponse> {
  const { data } = await api.put<McpAppAgentsResponse>(`/mcp/apps/${encodeURIComponent(appId)}/agents`, { agentIds });
  return data;
}
