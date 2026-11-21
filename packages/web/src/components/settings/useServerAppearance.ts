import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { isRaftThemeId, PRO_RAFT_THEME_IDS } from "@botiverse/raft-shared";
import type { RaftThemeId } from "@botiverse/raft-shared";
import api from "../../api/client";
import { useCurrentServerLook } from "../../hooks/useServerTheme";
import { useServerStore } from "../../store/serverStore";
import type { Server } from "../../store/serverStore";
import { openUpgradeDialog } from "../../store/upgradeDialogStore";
import { clearServerThemeTweakFrame } from "../../theme/themeTweakRoot";
import type { ServerThemeLook } from "../../theme/serverTheme";

type Appearance = { theme: RaftThemeId | null; themeDecor: boolean };

function readAppearance(data: unknown): Appearance | null {
  if (!data || typeof data !== "object") return null;
  const record = data as { theme?: unknown; themeDecor?: unknown };
  const theme = record.theme === null ? null : isRaftThemeId(record.theme) ? record.theme : undefined;
  if (theme === undefined || typeof record.themeDecor !== "boolean") return null;
  return { theme, themeDecor: record.themeDecor };
}

export interface ServerAppearanceControls {
  server: Server | null;
  look: ServerThemeLook | null;
  freePlan: boolean;
  /** The last save's failure, or "". */
  error: string;
  /** Picks a preset: saves it (a Pro theme on Free opens the upgrade dialog instead) and drops the local frame colour. */
  pickTheme: (value: string) => void;
  setDecor: (checked: boolean) => void;
}

/**
 * The current server's look for this member (design/foundations/themes.md),
 * read fresh when the caller mounts, and its two saves (PATCH
 * /servers/:id/appearance-settings): choosing applies at once, a failed save
 * puts what the server last confirmed back. Settings › Theme and the Edit
 * theme panel both use it.
 */
export function useServerAppearance(): ServerAppearanceControls {
  const { formatMessage } = useIntl();
  const server = useServerStore((state) => state.current);
  const plan = useServerStore((state) => state.billing?.plan || state.current?.plan);
  const applyServerPatch = useServerStore((state) => state.applyServerPatch);
  const look = useCurrentServerLook();
  const [error, setError] = useState("");
  // Only the latest save may put an earlier look back.
  const saveSequence = useRef(0);
  const confirmed = useRef<Appearance | null>(null);
  const serverId = server?.id;

  // The server list carries the look; read it fresh once the page opens.
  useEffect(() => {
    if (!serverId) return;
    let cancelled = false;
    api.get(`/servers/${serverId}/appearance-settings`)
      .then(({ data }) => {
        const appearance = readAppearance(data);
        if (cancelled || !appearance) return;
        confirmed.current = appearance;
        if (saveSequence.current > 0) return;
        applyServerPatch({ id: serverId, ...appearance });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [applyServerPatch, serverId]);

  const save = useCallback(async (patch: Partial<Appearance>) => {
    const current = useServerStore.getState().current;
    if (!current) return;
    // A failed save goes back to what the server last confirmed, not to the
    // previous optimistic value: two saves that both fail leave nothing unsaved on screen.
    const fallback: Appearance = confirmed.current ?? { theme: current.theme ?? null, themeDecor: current.themeDecor !== false };
    const sequence = ++saveSequence.current;
    setError("");
    applyServerPatch({ id: current.id, ...patch });
    try {
      // The store keeps Raft Yellow as no theme (null); the API names it
      // "raft" and rejects null (servers.ts › appearance-settings).
      const body = patch.theme === null ? { ...patch, theme: "raft" } : patch;
      const { data } = await api.patch(`/servers/${current.id}/appearance-settings`, body);
      const saved = readAppearance(data);
      if (saved) confirmed.current = saved;
      if (saved && sequence === saveSequence.current) applyServerPatch({ id: current.id, ...saved });
    } catch {
      if (sequence !== saveSequence.current) return;
      applyServerPatch({ id: current.id, ...fallback });
      setError(formatMessage({ id: "settings.theme.saveFailed" }));
    }
  }, [applyServerPatch, formatMessage]);

  const freePlan = !plan || plan === "free";
  const storedTheme = server?.theme ?? "raft";
  const pickTheme = useCallback((value: string) => {
    if (!isRaftThemeId(value) || !serverId) return;
    // Compare with the stored choice, not the look: a stored Pro theme shows as
    // Raft Yellow on Free, and picking Raft Yellow must still clear it.
    // Picking the preset already chosen puts its own colours back.
    if (value === storedTheme) {
      clearServerThemeTweakFrame(serverId);
      return;
    }
    if (freePlan && PRO_RAFT_THEME_IDS.includes(value)) {
      openUpgradeDialog("pro_theme");
      return;
    }
    // A preset is its own colours: the local frame colour goes, the corners stay.
    clearServerThemeTweakFrame(serverId);
    void save({ theme: value === "raft" ? null : value });
  }, [freePlan, save, serverId, storedTheme]);

  const setDecor = useCallback((checked: boolean) => {
    void save({ themeDecor: checked });
  }, [save]);

  return { server, look, freePlan, error, pickTheme, setDecor };
}
