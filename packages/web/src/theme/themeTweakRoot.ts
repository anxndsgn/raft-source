import { isThemeTweakEmpty, parseThemeTweak, serializeThemeTweak, THEME_TWEAK_STORAGE_PREFIX, themeTweakCss } from "./themeTweak";
import type { ThemeTweak } from "./themeTweak";
import { refreshSystemBarColor } from "./systemBarColor";

/**
 * The current server's local theme tweak (themeTweak.ts) on <html>: a
 * `data-theme-tweak` attribute (raft-ui copies it onto every portal) and one
 * `<style id="raft-theme-tweak">` whose rule matches it. The boot script
 * writes the same element before the first paint (bootInlineScript.ts), so
 * a reload shows the tweaked frame at once; serverTheme.ts's sync switches it
 * with the current server.
 */

export const THEME_TWEAK_STYLE_ID = "raft-theme-tweak";
export const THEME_TWEAK_ATTRIBUTE = "data-theme-tweak";

function storage(): Storage | null {
  try {
    const value = globalThis.localStorage;
    return value && typeof value.getItem === "function" ? value : null;
  } catch {
    return null;
  }
}

export function readThemeTweak(serverId: string): ThemeTweak | null {
  try {
    return parseThemeTweak(storage()?.getItem(`${THEME_TWEAK_STORAGE_PREFIX}${serverId}`));
  } catch {
    return null;
  }
}

function writeThemeTweak(serverId: string, tweak: ThemeTweak | null): void {
  try {
    const key = `${THEME_TWEAK_STORAGE_PREFIX}${serverId}`;
    if (isThemeTweakEmpty(tweak)) storage()?.removeItem(key);
    else storage()?.setItem(key, serializeThemeTweak(tweak as ThemeTweak));
  } catch {
    // A full or blocked storage keeps the tweak for this visit only.
  }
}

/** A server this person left keeps no tweak either. */
export function forgetThemeTweak(serverId: string): void {
  try {
    storage()?.removeItem(`${THEME_TWEAK_STORAGE_PREFIX}${serverId}`);
  } catch {
    // Storage unavailable: nothing to forget.
  }
}

/** Puts a tweak on <html>, or takes it off. */
export function applyRootThemeTweak(tweak: ThemeTweak | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const css = themeTweakCss(tweak);
  let style = document.getElementById(THEME_TWEAK_STYLE_ID);
  if (!css) {
    style?.remove();
    if (!root.hasAttribute(THEME_TWEAK_ATTRIBUTE)) return;
    root.removeAttribute(THEME_TWEAK_ATTRIBUTE);
  } else {
    if (!style) {
      style = document.createElement("style");
      style.id = THEME_TWEAK_STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
    root.setAttribute(THEME_TWEAK_ATTRIBUTE, "");
  }
  refreshSystemBarColor();
}

// The current server's tweak, for the editor (hooks/useThemeTweak.ts).
let activeServerId: string | null = null;
let activeTweak: ThemeTweak | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

export function subscribeThemeTweak(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActiveThemeTweak(): ThemeTweak | null {
  return activeTweak;
}

/** The server that became current (or none): its stored tweak goes on <html>. */
export function activateServerThemeTweak(serverId: string | null): void {
  activeServerId = serverId;
  activeTweak = serverId ? readThemeTweak(serverId) : null;
  applyRootThemeTweak(activeTweak);
  notify();
}

/** The editor's change: kept on this device for the server, and shown at once when it is current. */
export function setServerThemeTweak(serverId: string, tweak: ThemeTweak | null): void {
  const next = isThemeTweakEmpty(tweak) ? null : tweak;
  writeThemeTweak(serverId, next);
  if (serverId !== activeServerId) return;
  activeTweak = next;
  applyRootThemeTweak(next);
  notify();
}

/** Picking a preset drops the frame colour and keeps the corners. */
export function clearServerThemeTweakFrame(serverId: string): void {
  const current = serverId === activeServerId ? activeTweak : readThemeTweak(serverId);
  if (!current?.frame) return;
  setServerThemeTweak(serverId, { ...current, frame: null });
}
