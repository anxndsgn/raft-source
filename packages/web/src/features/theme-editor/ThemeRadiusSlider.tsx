import { useCallback, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { THEME_TWEAK_RADII } from "../../theme/themeTweak";
import type { ThemeTweakRadius } from "../../theme/themeTweak";

const LAST = THEME_TWEAK_RADII.length - 1;

const KEY_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, Home: -LAST, End: LAST };

// The thumb and the filled track settle on a stop with the slide easing.
const SETTLE = "duration-150 ease-[cubic-bezier(0.32,0.72,0,1)]";

/** Where stop `at` (0 to 4, fractional while dragged) sits along the track. */
const percent = (at: number) => `${(at / LAST) * 100}%`;

/**
 * The corner radius as a detent slider: a 4px track whose part up to the
 * value is filled, a notch at each inner stop (2, 4, 8), a round thumb that
 * follows the pointer while dragged and settles on the nearest stop when let
 * go. The labels under the stops jump there; arrow keys move one stop.
 */
export function ThemeRadiusSlider({
  value,
  label,
  valueText,
  stopLabels,
  onValueChange,
}: {
  value: ThemeTweakRadius;
  label: string;
  valueText: string;
  /** One label per stop, under it (方角 / 2 / 4 / 8 / 12). */
  stopLabels: readonly string[];
  onValueChange: (radius: ThemeTweakRadius) => void;
}) {
  const index = Math.max(0, THEME_TWEAK_RADII.indexOf(value));
  // The thumb's place while dragged, in stops (fractional); null when at rest.
  const [dragAt, setDragAt] = useState<number | null>(null);

  const positionAt = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return index;
    return Math.min(LAST, Math.max(0, ((event.clientX - box.left) / box.width) * LAST));
  }, [index]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragAt(positionAt(event));
  }, [positionAt]);
  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (dragAt !== null && event.currentTarget.hasPointerCapture(event.pointerId)) setDragAt(positionAt(event));
  }, [dragAt, positionAt]);
  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (dragAt === null) return;
    setDragAt(null);
    onValueChange(THEME_TWEAK_RADII[Math.round(positionAt(event))]);
  }, [dragAt, onValueChange, positionAt]);
  const handlePointerCancel = useCallback(() => setDragAt(null), []);
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    onValueChange(THEME_TWEAK_RADII[Math.min(LAST, Math.max(0, index + step))]);
  }, [index, onValueChange]);

  const at = dragAt ?? index;
  const settle = dragAt === null ? SETTLE : "";
  return (
    <div className="mx-[9px]">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={12}
        aria-valuenow={value}
        aria-valuetext={valueText}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        className="group/radius relative h-6 cursor-pointer touch-none outline-none select-none"
        data-testid="theme-editor-radius"
      >
        <div aria-hidden="true" className="absolute inset-x-0 top-2.5 h-1 overflow-hidden rounded-full bg-ink-16">
          <div className={`h-full bg-foreground transition-[width] ${settle}`} style={{ width: percent(at) }} />
        </div>
        {THEME_TWEAK_RADII.slice(1, LAST).map((radius, inner) => (
          <span
            key={radius}
            aria-hidden="true"
            className={`absolute top-2.5 -ml-0.5 size-1 rounded-full ${inner + 1 <= at ? "bg-layer-popover" : "bg-foreground/35"}`}
            style={{ left: percent(inner + 1) }}
          />
        ))}
        <span
          aria-hidden="true"
          className={[
            "absolute top-[3px] -ml-[9px] size-[18px] rounded-full bg-layer-canvas",
            "shadow-[0_0_0_1px_oklch(0_0_0/0.18),0_1px_4px_oklch(0_0_0/0.25)]",
            "group-focus-visible/radius:shadow-focus",
            `transition-[left] ${settle}`,
          ].join(" ")}
          style={{ left: percent(at) }}
          data-testid="theme-editor-radius-thumb"
        />
      </div>
      <div aria-hidden="true" className="relative mt-1.5 h-3.5 text-[11px] tabular-nums">
        {THEME_TWEAK_RADII.map((radius, stop) => (
          <RadiusStopLabel
            key={radius}
            radius={radius}
            left={percent(stop)}
            current={stop === index}
            onPick={onValueChange}
          >
            {stopLabels[stop]}
          </RadiusStopLabel>
        ))}
      </div>
    </div>
  );
}

function RadiusStopLabel({
  radius,
  left,
  current,
  onPick,
  children,
}: {
  radius: ThemeTweakRadius;
  left: string;
  current: boolean;
  onPick: (radius: ThemeTweakRadius) => void;
  children: string | undefined;
}) {
  const handleClick = useCallback(() => onPick(radius), [onPick, radius]);
  return (
    <span
      onClick={handleClick}
      className={`absolute -translate-x-1/2 cursor-pointer whitespace-nowrap ${current ? "font-semibold text-foreground" : "text-foreground-hint"}`}
      style={{ left }}
    >
      {children}
    </span>
  );
}
