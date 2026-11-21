import { useCallback } from "react";
import { useIntl } from "react-intl";
import { RAFT_THEME_IDS } from "@botiverse/raft-shared";
import type { RaftThemeId } from "@botiverse/raft-shared";
import { RAFT_THEME_NAME_ID } from "../../components/settings/raftThemeNames";
import Tooltip from "../../components/ui/Tooltip";
import { frameCss, RAFT_THEME_FRAMES } from "../../theme/themeTweak";

/**
 * The eleven presets as one row of dots in their light frame colour, ends
 * aligned. The chosen one has a ring; a small square marks it while its frame
 * colour is tweaked. Its name shows on hover.
 */
export function ThemePresetDots({
  selected,
  tweaked,
  onPick,
}: {
  selected: RaftThemeId;
  tweaked: boolean;
  onPick: (theme: RaftThemeId) => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <div role="group" aria-label={formatMessage({ id: "themeEditor.presetsAria" })} className="flex justify-between gap-1.5" data-testid="theme-editor-presets">
      {RAFT_THEME_IDS.map((theme) => (
        <PresetDot
          key={theme}
          theme={theme}
          label={formatMessage({ id: RAFT_THEME_NAME_ID[theme] })}
          pressed={theme === selected}
          tweaked={tweaked && theme === selected}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

function PresetDot({ theme, label, pressed, tweaked, onPick }: { theme: RaftThemeId; label: string; pressed: boolean; tweaked: boolean; onPick: (theme: RaftThemeId) => void }) {
  const handleClick = useCallback(() => onPick(theme), [onPick, theme]);
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={handleClick}
        className={[
          "relative size-5 shrink-0 cursor-pointer rounded-full p-0 outline-none",
          "shadow-[inset_0_0_0_1px_oklch(0_0_0/0.12)] focus-visible:shadow-focus",
          "aria-pressed:shadow-[inset_0_0_0_1px_oklch(0_0_0/0.12),0_0_0_2px_var(--layer-popover),0_0_0_3.5px_var(--foreground)]",
          tweaked ? "after:absolute after:-right-[3px] after:-bottom-[3px] after:size-[7px] after:bg-foreground after:shadow-[0_0_0_1.5px_var(--layer-popover)] after:content-['']" : "",
        ].join(" ")}
        style={{ background: frameCss(RAFT_THEME_FRAMES[theme].light) }}
        data-testid={`theme-editor-preset-${theme}`}
      />
    </Tooltip>
  );
}
