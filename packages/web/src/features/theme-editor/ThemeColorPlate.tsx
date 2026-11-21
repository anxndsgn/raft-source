import { Contrast, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { useIntl } from "react-intl";
import { useOptionalAppTheme } from "../../hooks/useAppTheme";
import type { AppAppearanceMode } from "../../theme/appTheme";
import { ThemeModeButton } from "./ThemeModeButton";
import { frameAtPlatePoint, frameCss, frameHex, platePosition, THEME_FRAME_CHROMA_MAX } from "../../theme/themeTweak";
import type { ThemeFrame } from "../../theme/themeTweak";

const MODES: ReadonlyArray<{ mode: AppAppearanceMode; labelId: "settings.appearance.modeSystem" | "settings.appearance.modeLight" | "settings.appearance.modeDark"; Icon: typeof Sun }> = [
  { mode: "system", labelId: "settings.appearance.modeSystem", Icon: Contrast },
  { mode: "light", labelId: "settings.appearance.modeLight", Icon: Sun },
  { mode: "dark", labelId: "settings.appearance.modeDark", Icon: Moon },
];

// Hue by 6°, chroma by 0.01 per arrow key.
const KEY_STEPS: Record<string, [number, number]> = {
  ArrowLeft: [0, -6],
  ArrowRight: [0, 6],
  ArrowUp: [0.01, 0],
  ArrowDown: [-0.01, 0],
};

const CORNER = "pointer-events-none absolute flex h-7 items-center text-[11px] text-foreground/40";

/**
 * The frame colour plate (Edit theme): direction from the centre is the hue
 * (the corners name theirs), distance the chroma, up to 0.2; the lightness
 * stays (the ramp sets it). The colour glows round the knob. The app's
 * light / dark / system setting sits at its top, the colour's hex at its
 * bottom. Arrow keys: left and right turn the hue, up and down the chroma.
 */
export function ThemeColorPlate({ frame, onFrameChange }: { frame: ThemeFrame; onFrameChange: (frame: ThemeFrame) => void }) {
  const { formatMessage } = useIntl();
  const appTheme = useOptionalAppTheme();
  const plateRef = useRef<HTMLDivElement | null>(null);
  const pending = useRef<ThemeFrame | null>(null);
  const frameRequest = useRef<number | null>(null);
  const lightness = useRef(frame.l);
  lightness.current = frame.l;

  // One change per animation frame while dragging.
  const queue = useCallback((next: ThemeFrame) => {
    pending.current = next;
    if (frameRequest.current !== null) return;
    frameRequest.current = requestAnimationFrame(() => {
      frameRequest.current = null;
      if (pending.current) onFrameChange(pending.current);
      pending.current = null;
    });
  }, [onFrameChange]);
  useEffect(() => () => {
    if (frameRequest.current !== null) cancelAnimationFrame(frameRequest.current);
  }, []);

  const pick = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const box = plateRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    const dx = ((event.clientX - box.left) / box.width) * 2 - 1;
    const dy = ((event.clientY - box.top) / box.height) * 2 - 1;
    queue(frameAtPlatePoint(dx, dy, lightness.current));
  }, [queue]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-theme-plate-modes]")) return;
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pick(event);
  }, [pick]);
  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons && event.currentTarget.hasPointerCapture(event.pointerId)) pick(event);
  }, [pick]);
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    onFrameChange({
      l: frame.l,
      c: Math.min(THEME_FRAME_CHROMA_MAX, Math.max(0, frame.c + step[0])),
      h: (frame.h + step[1] + 360) % 360,
    });
  }, [frame, onFrameChange]);

  const { x, y } = platePosition(frame);
  const color = frameCss(frame);
  const hex = frameHex(frame);
  return (
    <div
      ref={plateRef}
      role="slider"
      tabIndex={0}
      aria-label={formatMessage({ id: "themeEditor.plateAria" })}
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(frame.h)}
      aria-valuetext={hex}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      className={[
        "relative h-[232px] shrink-0 cursor-crosshair touch-none overflow-hidden rounded-container bg-fill-medium bg-size-[6px_6px] outline-none select-none",
        "bg-[radial-gradient(circle,var(--ink-16)_0.8px,transparent_1.2px)]",
        // The hairline ring sits above the glow.
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--line-hairline)] after:content-['']",
        "focus-visible:shadow-focus",
      ].join(" ")}
      data-testid="theme-editor-plate"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(circle at ${x}% ${y}%, ${frameCss(frame, 0.8)}, ${frameCss(frame, 0)} 32%)` }}
      />
      <span aria-hidden="true" className={`${CORNER} top-2 left-3`}>{formatMessage({ id: "themeEditor.cornerBlue" })}</span>
      <span aria-hidden="true" className={`${CORNER} top-2 right-3`}>{formatMessage({ id: "themeEditor.cornerRed" })}</span>
      <span aria-hidden="true" className={`${CORNER} bottom-2 left-3`}>{formatMessage({ id: "themeEditor.cornerGreen" })}</span>
      <span aria-hidden="true" className={`${CORNER} right-3 bottom-2`}>{formatMessage({ id: "themeEditor.cornerYellow" })}</span>
      {appTheme ? (
        <div
          role="group"
          aria-label={formatMessage({ id: "themeEditor.modeAria" })}
          className="absolute top-2 left-1/2 z-raised flex -translate-x-1/2 gap-0.5"
          data-theme-plate-modes=""
        >
          {MODES.map(({ mode, labelId, Icon }) => (
            <ThemeModeButton key={mode} mode={mode} label={formatMessage({ id: labelId })} pressed={appTheme.mode === mode} onSelect={appTheme.setMode}>
              <Icon size={16} aria-hidden="true" />
            </ThemeModeButton>
          ))}
        </div>
      ) : null}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -mt-[11px] -ml-[11px] size-[22px] rounded-full shadow-[0_0_0_3px_white,0_2px_8px_oklch(0_0_0/0.35)]"
        style={{ left: `${x}%`, top: `${y}%`, background: color }}
        data-testid="theme-editor-knob"
      />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/2 flex h-7 -translate-x-1/2 items-center text-[11px] text-foreground/55 tabular-nums">
        {hex}
      </span>
    </div>
  );
}
