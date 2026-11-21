import { useCallback, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { THEME_TWEAK_RADII } from "../../theme/themeTweak";
import type { ThemeTweakRadius } from "../../theme/themeTweak";

const STOPS = THEME_TWEAK_RADII.length;

const KEY_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };

/**
 * The corner radius as a detent slider in the segmented control's look: a
 * track of five stops (0, 2, 4, 8, 12), each with a corner of that radius;
 * the thumb follows the pointer while dragged and settles on the nearest stop
 * when let go, a press on a stop jumps there, arrow keys move one stop.
 */
export function ThemeRadiusSlider({
  value,
  label,
  valueText,
  onValueChange,
}: {
  value: ThemeTweakRadius;
  label: string;
  valueText: string;
  onValueChange: (radius: ThemeTweakRadius) => void;
}) {
  const index = Math.max(0, THEME_TWEAK_RADII.indexOf(value));
  // The thumb's place while dragged, in stops (0 to 4, fractional); null when at rest.
  const [dragAt, setDragAt] = useState<number | null>(null);

  const positionAt = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return index;
    return Math.min(STOPS - 1, Math.max(0, ((event.clientX - box.left) / box.width) * STOPS - 0.5));
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
    const step = KEY_STEPS[event.key] ?? (event.key === "Home" ? -STOPS : event.key === "End" ? STOPS : 0);
    if (!step) return;
    event.preventDefault();
    onValueChange(THEME_TWEAK_RADII[Math.min(STOPS - 1, Math.max(0, index + step))]);
  }, [index, onValueChange]);

  const thumbAt = dragAt ?? index;
  return (
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
      className="relative grid h-9 cursor-pointer touch-none grid-cols-5 rounded-control bg-fill-medium p-0.5 outline-none select-none focus-visible:shadow-focus"
      data-testid="theme-editor-radius"
    >
      <div
        aria-hidden="true"
        className={[
          "pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/5)] rounded-control bg-layer-popover",
          "shadow-[0_0_0_1px_var(--line-hairline),0_1px_3px_oklch(0_0_0/0.12)]",
          dragAt === null ? "transition-transform duration-150 ease-slide" : "",
        ].join(" ")}
        style={{ transform: `translateX(${thumbAt * 100}%)` }}
      />
      {THEME_TWEAK_RADII.map((radius, stop) => (
        <span
          key={radius}
          aria-hidden="true"
          className={`pointer-events-none relative flex items-center justify-center gap-[5px] text-[11px] tabular-nums ${stop === index ? "font-semibold text-foreground" : "text-foreground-muted"}`}
        >
          <i className="block size-3 border-t-[1.5px] border-l-[1.5px] border-current" style={{ borderTopLeftRadius: `${radius * 0.75}px` }} />
          {radius}
        </span>
      ))}
    </div>
  );
}
