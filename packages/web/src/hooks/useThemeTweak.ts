import { useSyncExternalStore } from "react";
import { getActiveThemeTweak, subscribeThemeTweak } from "../theme/themeTweakRoot";
import type { ThemeTweak } from "../theme/themeTweak";

/** The current server's local theme tweak on this device (theme/themeTweakRoot.ts), or null. */
export function useThemeTweak(): ThemeTweak | null {
  return useSyncExternalStore(subscribeThemeTweak, getActiveThemeTweak, getActiveThemeTweak);
}
