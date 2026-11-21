import { Monitor } from "lucide-react";
import { useCallback, useId, useMemo } from "react";
import type { ComponentType, ReactNode } from "react";
import { useIntl } from "react-intl";
import { Button, Switch } from "@botiverse/raft-ui";
import type { RaftThemeId } from "@botiverse/raft-shared";
import { RAFT_THEME_NAME_ID } from "../../components/settings/raftThemeNames";
import type { ServerAppearanceControls } from "../../components/settings/useServerAppearance";
import { raftThemeHasDecor } from "../../theme/serverTheme";
import { frameInk, THEME_FRAME_MIN_CONTRAST, THEME_TWEAK_RADII } from "../../theme/themeTweak";
import type { ThemeTweakRadius } from "../../theme/themeTweak";
import { ThemeColorPlate } from "./ThemeColorPlate";
import { ThemeLightnessRamp } from "./ThemeLightnessRamp";
import { ThemePresetDots } from "./ThemePresetDots";
import { ThemeRadiusSlider } from "./ThemeRadiusSlider";
import { useThemeEditor } from "./useThemeEditor";

export interface ThemeEditorPanelProps {
  appearance: ServerAppearanceControls;
  /** The overlay's title part (PopoverTitle, DialogTitle), or null when the overlay draws its own title. */
  Title: ComponentType<{ className?: string; children?: ReactNode }> | null;
}

const LABEL_ROW = "mb-2 flex items-baseline justify-between text-[12px] font-semibold text-foreground";
const LABEL_VALUE = "font-normal text-foreground-muted tabular-nums";

/**
 * Edit theme: the current server's preset (the theme saved on the membership,
 * useServerAppearance) and this device's tweak of it (theme/themeTweak.ts):
 * the frame colour on a plate and a lightness ramp, and the corner radius.
 * Every change shows at once across the app; nothing to apply. Picking a
 * preset drops the colour tweak and keeps the corners.
 */
export function ThemeEditorPanel({ appearance, Title }: ThemeEditorPanelProps) {
  const { server, look } = appearance;
  if (!server || !look) return null;
  return <ThemeEditorPanelBody appearance={appearance} serverId={server.id} theme={look.theme} decor={look.decor} Title={Title} />;
}

function ThemeEditorPanelBody({
  appearance,
  serverId,
  theme,
  decor,
  Title,
}: ThemeEditorPanelProps & { serverId: string; theme: RaftThemeId; decor: boolean }) {
  const { formatMessage } = useIntl();
  const { tweak, frame, setFrame, setRadius, resetFrame } = useThemeEditor(serverId, theme);
  const decorLabelId = useId();
  const pickTheme = useCallback((value: RaftThemeId) => appearance.pickTheme(value), [appearance]);

  const presetName = formatMessage({ id: RAFT_THEME_NAME_ID[theme] });
  const presetLabel = tweak.frame ? formatMessage({ id: "themeEditor.presetTweaked" }, { name: presetName }) : presetName;
  const { ink, contrast } = frameInk(frame);
  const contrastLow = contrast < THEME_FRAME_MIN_CONTRAST;
  const radiusText = radiusValueText(tweak.radius, formatMessage);
  const stopLabels = useMemo(
    () => THEME_TWEAK_RADII.map((radius) => (radius === 0 ? formatMessage({ id: "themeEditor.radiusSquare" }) : String(radius))),
    [formatMessage],
  );

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="theme-editor-panel">
      <div className="flex h-6 min-w-0 items-center justify-between gap-2">
        {Title ? (
          <Title className="m-0 min-w-0 truncate font-sans text-[14px] leading-6 font-semibold text-foreground">
            {formatMessage({ id: "themeEditor.title" })}
            <span className="ml-1.5 text-[12px] font-normal text-foreground-muted">{presetLabel}</span>
          </Title>
        ) : (
          <span className="min-w-0 truncate text-[12px] text-foreground-muted">{presetLabel}</span>
        )}
        {tweak.frame ? (
          <Button variant="ghost" size="xs" className="h-6 shrink-0 px-2 text-[12px] font-normal text-foreground-muted hover:text-foreground" onClick={resetFrame} data-testid="theme-editor-reset">
            {formatMessage({ id: "themeEditor.reset" })}
          </Button>
        ) : null}
      </div>

      <ThemeColorPlate frame={frame} onFrameChange={setFrame} />

      <ThemePresetDots selected={theme} tweaked={tweak.frame !== null} onPick={pickTheme} />

      <div>
        <div className={LABEL_ROW}>
          {formatMessage({ id: "themeEditor.lightness" })}
          <span className={LABEL_VALUE}>{Math.round(frame.l * 100)}</span>
        </div>
        <ThemeLightnessRamp frame={frame} onFrameChange={setFrame} />
      </div>

      <div>
        <div className={LABEL_ROW}>
          {formatMessage({ id: "themeEditor.radius" })}
          <span className={LABEL_VALUE}>{radiusText}</span>
        </div>
        <ThemeRadiusSlider
          value={tweak.radius}
          label={formatMessage({ id: "themeEditor.radius" })}
          valueText={radiusText}
          stopLabels={stopLabels}
          onValueChange={setRadius}
        />
      </div>

      <p className="m-0 flex items-center gap-1.5 text-[12px] text-foreground-muted" data-testid="theme-editor-contrast">
        <i aria-hidden="true" className={`block size-2 shrink-0 ${contrastLow ? "bg-danger" : "bg-success"}`} />
        {formatMessage(
          { id: contrastLow ? "themeEditor.contrastLow" : "themeEditor.contrast" },
          { ink, ratio: contrast.toFixed(1) },
        )}
      </p>

      {raftThemeHasDecor(theme) ? (
        <div className="flex items-center justify-between gap-3 text-[13px] text-foreground">
          <span id={decorLabelId}>{formatMessage({ id: "themeEditor.decor" })}</span>
          <Switch checked={decor} onCheckedChange={appearance.setDecor} aria-labelledby={decorLabelId} data-testid="theme-editor-decor" />
        </div>
      ) : null}

      {appearance.error ? <p className="m-0 text-[12px] text-danger-strong" role="alert">{appearance.error}</p> : null}

      <p className="m-0 flex gap-1.5 border-t border-line-hairline pt-3 text-[12px] leading-[1.5] text-foreground-muted">
        <Monitor size={12} aria-hidden="true" className="mt-[3px] shrink-0" />
        {formatMessage({ id: "themeEditor.note" })}
      </p>
    </div>
  );
}

function radiusValueText(radius: ThemeTweakRadius, formatMessage: ReturnType<typeof useIntl>["formatMessage"]): string {
  if (radius === 0) return formatMessage({ id: "themeEditor.radiusSquare" });
  if (radius === 8) return formatMessage({ id: "themeEditor.radiusRounded" }, { value: radius });
  return String(radius);
}
