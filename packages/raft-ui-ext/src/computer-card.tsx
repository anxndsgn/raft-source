import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardLeading, CardTitle, CardTrailing } from "@botiverse/raft-ui";
import { Meter, MeterHeader, MeterIndicator, MeterLabel, MeterTrack, MeterValue } from "@botiverse/raft-ui/wip";
import { AgentStateMark } from "./agent-state-mark";

/**
 * A computer, compact (Team page PRD §5.1 ④, design T1): raft-ui Card holding its name and whether it is online
 * (the state mark's square), what it runs and its version, how many agents it holds, then one raft-ui Meter per
 * resource — memory, disk, each runtime's usage with when it resets. The meters keep Meter's own colors: `info`
 * until it is nearly used up, then `warning`. The whole card opens the computer (`onOpen`).
 */
export function ComputerCard({ name, online, onlineLabel, system, agents, onOpen, openId, openLabel, children, ...props }: {
  name: string;
  online: boolean;
  /** The status in words, the mark's accessible name ("Online"). */
  onlineLabel: string;
  /** "macOS 26.1 · Raft Computer 1.0.49". */
  system?: ReactNode;
  /** "3 agents · 1 working". */
  agents?: ReactNode;
  /** Opens the computer, given `openId` (so a list passes one stable handler). */
  onOpen?: (id: string) => void;
  openId?: string;
  /** The card's name as a button ("Open xinandeMac-mini"). */
  openLabel?: string;
  /** ComputerCardMeter rows. */
  children?: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <Card {...props} className="relative min-w-0" data-online={online || undefined}>
      {/* Card's own head: the mark leading, the name, what it runs under it, its agents trailing. */}
      <CardHeader className="pb-0">
        <CardLeading>
          <AgentStateMark state={online ? "idle" : "offline"} label={onlineLabel} />
        </CardLeading>
        <CardTitle className="truncate">
          {onOpen ? (
            // The name is the card's one button; it stretches over the card so the whole card opens it.
            <button type="button" onClick={() => onOpen(openId ?? name)} aria-label={openLabel} className="max-w-full truncate text-left outline-none after:absolute after:inset-0 after:rounded-container focus-visible:after:shadow-focus">
              {name}
            </button>
          ) : name}
        </CardTitle>
        {system ? <CardDescription className="col-end-[-1] truncate text-caption">{system}</CardDescription> : null}
        {agents ? <CardTrailing className="text-caption text-foreground-muted">{agents}</CardTrailing> : null}
      </CardHeader>
      {children ? <CardContent className="flex flex-col gap-3">{children}</CardContent> : null}
    </Card>
  );
}

/** One resource on a ComputerCard: its name, its value in words ("6.2 / 16 GB", "82% · back 09:00"), the bar. */
export function ComputerCardMeter({ label, used, valueText }: {
  label: ReactNode;
  /** Percent used, 0–100. */
  used: number;
  valueText: string;
}) {
  return (
    <Meter size="sm" used={used} valueText={valueText}>
      <MeterHeader>
        <MeterLabel>{label}</MeterLabel>
        <MeterValue className="font-mono text-mono-meta" />
      </MeterHeader>
      <MeterTrack>
        <MeterIndicator />
      </MeterTrack>
    </Meter>
  );
}
