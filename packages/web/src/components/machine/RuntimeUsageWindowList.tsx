import { ComputerCardMeter } from "@botiverse/raft-ui-ext";
import type { RuntimeAccountUsageWindow } from "@botiverse/raft-shared";
import { useIntl } from "react-intl";
import { useResumeMoment } from "../task/agentTimeText";
import { runtimeUsagePercentUsed } from "./bulkChangeModelPlan";

/** Used up by the provider's word or the ratio itself (as the usage card). */
function windowUsedUp(window: RuntimeAccountUsageWindow): boolean {
  return window.status === "limit_reached" || (window.usedRatio ?? 0) >= 1;
}

/** One window: the runtime (and the window's name) and its value on a line, then the bar. */
function UsageWindowLine({ window, label }: { window: RuntimeAccountUsageWindow; label: string }) {
  const { formatMessage } = useIntl();
  const resumeMoment = useResumeMoment();
  if (window.status === "parse_unavailable") {
    return (
      <div className="flex flex-col gap-1" data-testid="runtime-usage-window">
        <span className="truncate text-footnote text-foreground">{window.label}</span>
        <span className="text-footnote text-warning-strong">{formatMessage({ id: "machine.runtimeUsage.parseUnavailable" })}</span>
      </div>
    );
  }
  const usedUp = windowUsedUp(window);
  const percent = usedUp ? 100 : runtimeUsagePercentUsed(window.usedRatio ?? 0);
  // The Team page's computer card's writing (computers.md › A runtime's usage cell; Figmama 11/16): the runtime
  // (and the window, where it has several), then "60% used", or once used up when it is back ("23:00 恢复").
  const moment = usedUp ? resumeMoment(window.resetsAt) : null;
  const valueText = usedUp
    ? moment ? formatMessage({ id: "taskSection.heldUntil" }, { when: moment.when }) : formatMessage({ id: "machine.runtimeUsage.windowUsedUpResetUnavailable" })
    : formatMessage({ id: "machine.rack.percentUsed" }, { percent });
  return (
    <div data-testid="runtime-usage-window" data-usage-full={usedUp ? "true" : undefined}>
      <ComputerCardMeter label={label} used={usedUp ? 100 : (window.usedRatio ?? 0) * 100} valueText={valueText} />
    </div>
  );
}

export function RuntimeUsageWindowList({ windows, runtimeName }: { windows: readonly RuntimeAccountUsageWindow[]; runtimeName: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="runtime-usage-windows">
      {windows.map((window, index) => (
        <UsageWindowLine key={`${window.id}-${index}`} window={window} label={windows.length > 1 ? `${runtimeName} · ${window.label}` : runtimeName} />
      ))}
    </div>
  );
}
