import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { RUNTIME_ACCOUNT_USAGE_PROVIDERS, getRuntimeDisplayName } from "@botiverse/raft-shared";
import { ComputerCard, ComputerCardMeter } from "@botiverse/raft-ui-ext";
import { resourceUsedPercent } from "../../components/agentMigration/targetComputerInfo";
import { useRackRuntimeUsages } from "../../components/machine/rack/RackRuntimeUsage";
import { rackRuntimeCell } from "../../components/machine/rack/rackRuntimeColumns";
import { useResumeMoment } from "../../components/task/agentTimeText";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useServerPermissions } from "../../hooks/useServerPermissions";
import { isAgentInMemberLists } from "../../store/agentStore";
import { useAuthStore } from "../../store/authStore";
import type { Machine } from "../../store/machineStore";
import { useServerStore } from "../../store/serverStore";
import { formatDiskSizeBytes, formatFileSizeBytes } from "../../utils/fileSizePresentation";
import { formatRelativeTime } from "../../utils/relativeTime";
import { canViewMachineRuntimeAccountUsage } from "../../utils/machineRuntimeUsageVisibility";
import { useAgentsByMachine } from "../computer/useAgentsByMachine";

/**
 * The Overview's computers (PRD 团队页 §5.1 ④): one compact ComputerCard each,
 * online first — what it runs, its agents and how many work, memory, disk and
 * each runtime's usage with when it resets (no CPU: nothing reports it). The
 * usage is the Computers page's read (useRackRuntimeUsages, its cache shared),
 * for whoever may see it, online computers only.
 */
export function TeamComputerCards({ machines, workingByMachine }: {
  machines: readonly Machine[];
  workingByMachine: ReadonlyMap<string, number>;
}) {
  const { formatMessage, locale } = useIntl();
  const nav = useAppNavigate();
  const resumeMoment = useResumeMoment();
  const serverId = useServerStore((s) => s.current?.id ?? null);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const { capabilities } = useServerPermissions();
  const agentsByMachine = useAgentsByMachine();
  const ordered = useMemo(
    () => [...machines].sort((a, b) => Number(b.status === "online") - Number(a.status === "online") || a.name.localeCompare(b.name)),
    [machines],
  );
  const canReadUsage = useCallback(
    (machine: Machine) => machine.status === "online" && canViewMachineRuntimeAccountUsage(machine, currentUserId, capabilities),
    [capabilities, currentUserId],
  );
  const usage = useRackRuntimeUsages(ordered, serverId, canReadUsage);
  return (
    <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]" data-testid="team-computer-cards">
      {ordered.map((machine) => {
        const online = machine.status === "online";
        const agents = (agentsByMachine.get(machine.id) ?? []).filter(isAgentInMemberLists).length;
        const version = machine.computerVersion ?? machine.daemonVersion;
        // Online: what it runs and its version. Offline (computers.md › The compact card): when it was last
        // seen, and how many agents on it are paused, in warning-strong.
        const lastSeen = online ? null : formatRelativeTime(machine.lastHeartbeat, locale);
        const system = online
          ? [machine.osRelease ?? machine.os, version ? formatMessage({ id: "team.computer.version" }, { version }) : null].filter(Boolean).join(" · ")
          : (
            <>
              {lastSeen ? formatMessage({ id: "machine.rack.lastSeen" }, { time: lastSeen }) : formatMessage({ id: "machine.rack.filter.status.offline" })}
              {agents > 0 ? <span className="text-warning-strong before:px-1 before:text-foreground-muted before:content-['·']">{formatMessage({ id: "team.computer.agentsPaused" }, { count: agents })}</span> : null}
            </>
          );
        const results = usage.get(machine.id) ?? null;
        const runtimeCells = RUNTIME_ACCOUNT_USAGE_PROVIDERS
          .map((provider) => rackRuntimeCell(machine, provider, results))
          .flatMap((cell) => (cell.kind === "value" ? [cell] : []));
        return (
          <ComputerCard
            key={machine.id}
            name={machine.name}
            online={online}
            onlineLabel={formatMessage({ id: online ? "machine.rack.filter.status.online" : "machine.rack.filter.status.offline" })}
            system={system}
            agents={formatMessage({ id: "team.computer.agents" }, { count: agents, working: workingByMachine.get(machine.id) ?? 0 })}
            onOpen={nav.toComputer}
            openId={machine.id}
            openLabel={formatMessage({ id: "team.computer.open" }, { name: machine.name })}
            data-testid="team-computer-card"
          >
            {machine.memoryStatus ? (
              <ComputerCardMeter
                label={formatMessage({ id: "agent.migration.target.memory" })}
                used={resourceUsedPercent(machine.memoryStatus)}
                valueText={formatMessage({ id: "team.computer.usedOfTotal" }, {
                  used: formatFileSizeBytes(machine.memoryStatus.totalBytes - machine.memoryStatus.availableBytes, formatMessage),
                  total: formatFileSizeBytes(machine.memoryStatus.totalBytes, formatMessage),
                })}
              />
            ) : null}
            {machine.diskStatus ? (
              <ComputerCardMeter
                label={formatMessage({ id: "agent.migration.target.disk" })}
                used={resourceUsedPercent(machine.diskStatus)}
                valueText={formatMessage({ id: "team.computer.usedOfTotal" }, {
                  used: formatDiskSizeBytes(machine.diskStatus.totalBytes - machine.diskStatus.availableBytes, formatMessage),
                  total: formatDiskSizeBytes(machine.diskStatus.totalBytes, formatMessage),
                })}
              />
            ) : null}
            {runtimeCells.map((cell) => {
              // computers.md › A runtime's usage cell: "60% used" while there is room; once used up, when it is back.
              const moment = cell.summary.kind === "limit" ? resumeMoment(cell.summary.resetsAt) : null;
              return (
                <ComputerCardMeter
                  key={cell.provider}
                  label={formatMessage({ id: "team.computer.runtimeUsage" }, { runtime: getRuntimeDisplayName(cell.runtimeId) })}
                  used={cell.used}
                  valueText={moment
                    ? formatMessage({ id: "taskSection.heldUntil" }, { when: moment.when })
                    : formatMessage({ id: "machine.rack.percentUsed" }, { percent: cell.used })}
                />
              );
            })}
          </ComputerCard>
        );
      })}
    </div>
  );
}
