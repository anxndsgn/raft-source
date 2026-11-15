/**
 * The working ring round a navigation item (Team page PRD §4, design T2): the state mark's working ring
 * (raft-design working-agents.md › The state mark) drawn round an icon — a dashed `info` circle, 1.5px stroke,
 * dashes 2.5 on 1.5 off at any size, turning once every 4s and still under reduced motion — with the number of
 * agents at work beside it in plain `info-strong` digits (legible on the rail), no fill, so it never reads as the inbox's filled badge.
 * It fills its positioned parent; the parent keeps its own content and click target.
 */
const RING_BOX = { width: "100%", height: "100%" } as const;

export function WorkingRing({ count, className, ...props }: {
  /** Agents at work; the ring shows from 1. */
  count: number;
  className?: string;
  "data-testid"?: string;
}) {
  if (count < 1) return null;
  return (
    <span {...props} aria-hidden data-slot="working-ring" className={`pointer-events-none absolute inset-0 ${className ?? ""}`}>
      {/* Its size inline: a nav item sizes the svgs inside it as icons (18px), which this one is not. */}
      <svg className="absolute inset-0 overflow-visible" style={RING_BOX} viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r="18.25"
          fill="none"
          strokeWidth="1.5"
          strokeDasharray="2.5 1.5"
          vectorEffect="non-scaling-stroke"
          className="origin-center animate-[spin_4s_linear_infinite] stroke-info motion-reduce:animate-none"
        />
      </svg>
      <span className="absolute -top-1 -right-1.5 font-mono text-mono-meta leading-none text-info-strong tabular-nums">
        {count > 99 ? "99+" : count}
      </span>
    </span>
  );
}
