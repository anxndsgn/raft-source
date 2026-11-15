/**
 * An agent's state, the one mark everywhere (raft-design design/people-and-agents/working-agents.md › The state
 * mark; Team page PRD §6), in a 12px box: working — a ring, 11px across, 1.5px stroke, dashes 2.5 on 1.5 off, still
 * (anxndsgn 11/15: nothing turns), `info`; idle — an 8px filled square with a 1px `line-strong` edge,
 * `presence-online`; offline — an 8px hollow square, 1.5px, `presence-offline`; blocked (a usage limit, its computer
 * offline) — a filled triangle 11 by 10, `warning`. Shape and color both change; never pink or yellow.
 */
export type AgentState = "working" | "idle" | "offline" | "held";

const MARK_BOX = { width: 12, height: 12 } as const;

export function AgentStateMark({ state, label, className, ...props }: {
  state: AgentState;
  /** Its accessible name, the state ("Working"). Without it, the mark is decoration beside the words. */
  label?: string;
  className?: string;
  "data-testid"?: string;
}) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    // Its size inline: an icon slot (a list row's, a rail item's) sizes the svgs in it as icons; this mark is 12px.
    <svg {...props} {...a11y} data-agent-state={state} width="12" height="12" style={MARK_BOX} viewBox="0 0 12 12" className={`shrink-0 ${className ?? ""}`}>
      {state === "working" ? (
        <circle cx="6" cy="6" r="4.75" fill="none" strokeWidth="1.5" strokeDasharray="2.5 1.5" className="stroke-info" />
      ) : state === "idle" ? (
        <rect x="2" y="2" width="8" height="8" rx="1" strokeWidth="1" className="fill-presence-online stroke-line-strong" />
      ) : state === "offline" ? (
        <rect x="2.75" y="2.75" width="6.5" height="6.5" rx="1" fill="none" strokeWidth="1.5" className="stroke-presence-offline" />
      ) : (
        <path d="M6 1 L11.5 11 L0.5 11 Z" className="fill-warning" />
      )}
    </svg>
  );
}
