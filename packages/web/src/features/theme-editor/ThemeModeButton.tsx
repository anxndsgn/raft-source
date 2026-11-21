import { useCallback } from "react";
import type { ReactNode } from "react";
import type { AppAppearanceMode } from "../../theme/appTheme";

/** One of the plate's light / dark / system buttons: the app's own setting (AppThemeProvider). */
export function ThemeModeButton({
  mode,
  label,
  pressed,
  onSelect,
  children,
}: {
  mode: AppAppearanceMode;
  label: string;
  pressed: boolean;
  onSelect: (mode: AppAppearanceMode) => void;
  children: ReactNode;
}) {
  const handleClick = useCallback(() => onSelect(mode), [mode, onSelect]);
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={handleClick}
      className={[
        "grid size-7 cursor-pointer place-items-center rounded-control text-foreground-muted outline-none hover:text-foreground focus-visible:shadow-focus",
        "aria-pressed:bg-layer-popover aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-line-hairline",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
