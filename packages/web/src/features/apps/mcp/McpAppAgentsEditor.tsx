import type { McpAppAgentsResponse } from "@botiverse/raft-shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { mcpAppErrorMessage } from "../../../components/settings/mcpApps/mcpAppApi";
import Banner from "../../../components/ui/Banner";
import { McpAgentPicker } from "./McpAgentPicker";
import { fetchMcpAppAgents, saveMcpAppAgents } from "./mcpAppAgentsApi";

function enabledIds(list: McpAppAgentsResponse): Set<string> {
  return new Set(list.agents.filter((agent) => agent.enabled).map((agent) => agent.agentId));
}

/**
 * An MCP App's Agents, checkable where the App is edited (task #18): loads the
 * list, saves each change at once (the newest change wins) and says what a new
 * Agent gets.
 */
export function McpAppAgentsEditor({ appId, canManage, onChanged, testId }: {
  appId: string;
  canManage: boolean;
  onChanged?: () => void;
  testId?: string;
}) {
  const { formatMessage } = useIntl();
  // The list as the server last said it, and the checks shown now (ahead of a save in flight).
  const [state, setState] = useState<{ list: McpAppAgentsResponse | null; selected: Set<string>; error: string }>({ list: null, selected: new Set(), error: "" });
  const { list, selected, error } = state;
  const seq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetchMcpAppAgents(appId).then((loaded) => {
      if (!cancelled) setState({ list: loaded, selected: enabledIds(loaded), error: "" });
    }).catch((loadError: unknown) => {
      if (!cancelled) setState((current) => ({ ...current, error: mcpAppErrorMessage(loadError, formatMessage) }));
    });
    return () => { cancelled = true; };
  }, [appId, formatMessage]);

  const agents = useMemo(() => (list?.agents ?? []).map((agent) => ({
    id: agent.agentId,
    name: agent.name,
    displayName: agent.displayName,
    avatarUrl: agent.avatarUrl,
  })), [list]);

  const handleChange = useCallback(async (next: Set<string>) => {
    const previous = selected;
    setState((current) => ({ ...current, selected: next, error: "" }));
    const mine = ++seq.current;
    try {
      const saved = await saveMcpAppAgents(appId, [...next]);
      if (mine !== seq.current) return;
      setState({ list: saved, selected: enabledIds(saved), error: "" });
      onChanged?.();
    } catch (saveError) {
      if (mine !== seq.current) return;
      setState((current) => ({ ...current, selected: previous, error: mcpAppErrorMessage(saveError, formatMessage) }));
    }
  }, [appId, formatMessage, onChanged, selected]);

  return (
    <div className="stack-y-2">
      {error ? <Banner intent="warning" density="sm">{error}</Banner> : null}
      {list ? (
        <McpAgentPicker
          agents={agents}
          selected={selected}
          onChange={handleChange}
          disabled={!canManage}
          note={formatMessage({ id: list.agentGrantMode === "explicit" ? "apps.cap.agents.noteExplicit" : "apps.cap.agents.noteAutomatic" })}
          testId={testId}
        />
      ) : null}
    </div>
  );
}
