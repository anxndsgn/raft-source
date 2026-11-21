import { useCallback } from "react";
import type { RaftThemeId } from "@botiverse/raft-shared";
import { useOptionalAppTheme } from "../../hooks/useAppTheme";
import { useThemeTweak } from "../../hooks/useThemeTweak";
import { NO_THEME_TWEAK, RAFT_THEME_FRAMES } from "../../theme/themeTweak";
import type { ThemeFrame, ThemeTweak, ThemeTweakRadius } from "../../theme/themeTweak";
import { getActiveThemeTweak, setServerThemeTweak } from "../../theme/themeTweakRoot";

export interface ThemeEditorState {
  /** The tweak on this device (no frame and square corners when there is none). */
  tweak: ThemeTweak;
  /** The frame on screen: the tweak's, else the preset's in the current mode. */
  frame: ThemeFrame;
  setFrame: (frame: ThemeFrame) => void;
  setRadius: (radius: ThemeTweakRadius) => void;
  /** Restore preset: the preset's own frame colour again; the corners stay. */
  resetFrame: () => void;
}

/** The Edit theme panel's state for one server: every change is applied and stored at once (themeTweakRoot.ts). */
export function useThemeEditor(serverId: string, theme: RaftThemeId): ThemeEditorState {
  const tweak = useThemeTweak() ?? NO_THEME_TWEAK;
  const mode = useOptionalAppTheme()?.resolvedMode ?? "light";
  const frame = tweak.frame ?? RAFT_THEME_FRAMES[theme][mode];
  // Read the latest tweak, not this render's: a drag sends several changes per frame.
  const update = useCallback((patch: Partial<ThemeTweak>) => {
    setServerThemeTweak(serverId, { ...(getActiveThemeTweak() ?? NO_THEME_TWEAK), ...patch });
  }, [serverId]);
  const setFrame = useCallback((next: ThemeFrame) => update({ frame: next }), [update]);
  const setRadius = useCallback((radius: ThemeTweakRadius) => update({ radius }), [update]);
  const resetFrame = useCallback(() => update({ frame: null }), [update]);
  return { tweak, frame, setFrame, setRadius, resetFrame };
}
