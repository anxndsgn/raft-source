import { useCallback } from "react";
import { useIntl } from "react-intl";
import { RadioGroup, RadioGroupItem } from "@botiverse/raft-ui";
import { frameCss, nearestLightnessStep, THEME_FRAME_LIGHTNESS_STEPS } from "../../theme/themeTweak";
import type { ThemeFrame } from "../../theme/themeTweak";

/**
 * The frame's lightness as nine pixel steps of its hue and chroma, dark to
 * light: one choice of a radio group (arrow keys move between steps). The
 * step nearest the frame's lightness is the checked one.
 */
export function ThemeLightnessRamp({ frame, onFrameChange }: { frame: ThemeFrame; onFrameChange: (frame: ThemeFrame) => void }) {
  const { formatMessage } = useIntl();
  const checked = nearestLightnessStep(frame.l);
  const pick = useCallback((step: number) => {
    onFrameChange({ l: THEME_FRAME_LIGHTNESS_STEPS[step], c: frame.c, h: frame.h });
  }, [frame.c, frame.h, onFrameChange]);
  const handleValueChange = useCallback((value: string) => pick(Number(value)), [pick]);
  return (
    <RadioGroup
      value={String(checked)}
      onValueChange={handleValueChange}
      aria-label={formatMessage({ id: "themeEditor.lightnessAria" })}
      className="grid h-6 grid-cols-9 gap-0.5"
      data-testid="theme-editor-lightness"
    >
      {THEME_FRAME_LIGHTNESS_STEPS.map((lightness, step) => (
        <RampStep
          key={lightness}
          step={step}
          color={frameCss({ l: lightness, c: frame.c, h: frame.h })}
          label={formatMessage({ id: "themeEditor.lightnessStep" }, { value: Math.round(lightness * 100) })}
          onPick={pick}
        />
      ))}
    </RadioGroup>
  );
}

function RampStep({ step, color, label, onPick }: { step: number; color: string; label: string; onPick: (step: number) => void }) {
  const handleClick = useCallback(() => onPick(step), [onPick, step]);
  return (
    <div className="relative min-w-0">
      <RadioGroupItem appearance="none" value={String(step)} aria-label={label} className="peer" />
      <span
        aria-hidden="true"
        onClick={handleClick}
        className={[
          "block h-6 cursor-pointer rounded-sticker",
          "peer-focus-visible:shadow-focus",
          "peer-data-checked:shadow-[inset_0_0_0_2px_var(--layer-popover),0_0_0_1.5px_var(--foreground)]",
        ].join(" ")}
        style={{ background: color }}
      />
    </div>
  );
}
