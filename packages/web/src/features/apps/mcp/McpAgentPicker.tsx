import { Button, Checkbox, Input } from "@botiverse/raft-ui";
import { memo, useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useIntl } from "react-intl";
import AvatarSlot from "../../../components/ui/AvatarSlot";

export interface McpPickerAgent {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const PickerRow = memo(function PickerRow({ agent, checked, disabled, onToggle, testId }: {
  agent: McpPickerAgent;
  checked: boolean;
  disabled?: boolean;
  onToggle: (agentId: string, checked: boolean) => void;
  testId: string;
}) {
  const handleChange = useCallback((next: boolean) => onToggle(agent.id, next === true), [agent.id, onToggle]);
  return (
    <li>
      <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-control px-1 hover:bg-fill-hover" data-testid={`${testId}-agent-${agent.id}`}>
        <Checkbox checked={checked} disabled={disabled} onCheckedChange={handleChange} />
        <AvatarSlot context="compact-list" type="agent" agentAvatarUrl={agent.avatarUrl} />
        <span className="min-w-0 truncate text-body">{agent.displayName || agent.name}</span>
      </label>
    </li>
  );
});

/** Past this many Agents the list gets a search field (Add MCP spec v1.0). */
const SEARCH_FROM = 8;

/**
 * "Which agents use it" (task #18): a checklist of the server's Agents with
 * Enable all / Turn all off. Controlled: the caller owns the set and saves it.
 */
export function McpAgentPicker({ agents, selected, onChange, disabled, note, testId = "mcp-agent-picker" }: {
  agents: readonly McpPickerAgent[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
  /** One line under the list, e.g. what happens to a new Agent. */
  note?: string;
  testId?: string;
}) {
  const { formatMessage } = useIntl();
  const [query, setQuery] = useState("");
  const handleQuery = useCallback((event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value), []);
  const sorted = useMemo(() => [...agents].sort((left, right) => (left.displayName || left.name).localeCompare(right.displayName || right.name)), [agents]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((agent) => `${agent.displayName ?? ""} ${agent.name}`.toLowerCase().includes(needle));
  }, [query, sorted]);
  const enableAll = useCallback(() => onChange(new Set(agents.map((agent) => agent.id))), [agents, onChange]);
  const turnAllOff = useCallback(() => onChange(new Set()), [onChange]);
  const toggle = useCallback((agentId: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(agentId);
    else next.delete(agentId);
    onChange(next);
  }, [onChange, selected]);
  const count = agents.filter((agent) => selected.has(agent.id)).length;
  return (
    <section className="stack-y-2" data-testid={testId}>
      <div className="flex items-center gap-2">
        <h4 className="mr-auto text-footnote font-bold text-foreground-hint" data-testid={`${testId}-heading`}>
          {formatMessage({ id: "apps.cap.agents.heading" }, { count, total: agents.length })}
        </h4>
        <Button type="button" variant="ghost" size="sm" disabled={disabled || agents.length === 0} onClick={enableAll} data-testid={`${testId}-all`}>
          {formatMessage({ id: "apps.cap.agents.enableAll" })}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled || agents.length === 0} onClick={turnAllOff} data-testid={`${testId}-none`}>
          {formatMessage({ id: "apps.cap.agents.turnAllOff" })}
        </Button>
      </div>
      {agents.length > SEARCH_FROM ? (
        <Input value={query} onChange={handleQuery} placeholder={formatMessage({ id: "apps.cap.agents.search" })} data-testid={`${testId}-search`} />
      ) : null}
      {agents.length === 0 ? (
        <p className="text-footnote text-foreground-hint">{formatMessage({ id: "apps.cap.agents.none" })}</p>
      ) : (
        <ul className="stack-y-0.5">
          {shown.map((agent) => (
            <PickerRow key={agent.id} agent={agent} checked={selected.has(agent.id)} disabled={disabled} onToggle={toggle} testId={testId} />
          ))}
        </ul>
      )}
      {note ? <p className="text-footnote text-foreground-hint" data-testid={`${testId}-note`}>{note}</p> : null}
    </section>
  );
}
