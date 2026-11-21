import { cn } from "../cn";
import type { ThemeState } from "./theme-context";
import { useTheme } from "./use-theme";

type ThemeScopeProps = {
  className?: unknown;
};

type ClassNameCallback<ClassName> = Extract<
  NonNullable<ClassName>,
  (state: never) => string | undefined
>;

type ClassNameState<Props extends ThemeScopeProps> = Parameters<
  ClassNameCallback<Props["className"]>
>[0];

/**
 * Carry the provider's resolved mode (`light` / `dark`) onto content that
 * renders outside its subtree (a portal), so a dark island's popup stays dark,
 * and the root's look attributes with it (rootLookAttributes).
 */
export function resolveThemeScopeProps<Props extends ThemeScopeProps>(
  { className, ...props }: Props,
  { resolvedMode }: Pick<ThemeState, "resolvedMode">,
): Omit<Props, "className"> & { className?: Props["className"] } {
  const resolvedClassName =
    typeof className === "function"
      ? (state: ClassNameState<Props>) =>
          cn((className as ClassNameCallback<Props["className"]>)(state), resolvedMode)
      : typeof className === "string"
        ? cn(className, resolvedMode)
        : (className ?? resolvedMode);

  return {
    ...rootLookAttributes(),
    ...props,
    className: resolvedClassName as Props["className"],
  };
}

/** The look attributes the app sets on the root (a server's theme, the
 *  shape, the accent, a member's local tweak of the theme). A portal's mode
 *  class starts a new `.light` / `.dark` scope, which falls back to the
 *  default look unless the portal carries them too: without them a popup's
 *  frame accent was always the default yellow under any theme (Raft
 *  redesign, Figmama 11/20). */
const ROOT_LOOK_ATTRIBUTES = ["data-theme", "data-shape", "data-accent", "data-theme-tweak"] as const;

function rootLookAttributes(): Partial<Record<(typeof ROOT_LOOK_ATTRIBUTES)[number], string>> {
  if (typeof document === "undefined") return {};
  const root = document.documentElement;
  const attributes: Partial<Record<(typeof ROOT_LOOK_ATTRIBUTES)[number], string>> = {};
  for (const name of ROOT_LOOK_ATTRIBUTES) {
    const value = root.getAttribute(name);
    if (value !== null) attributes[name] = value;
  }
  return attributes;
}

export function useThemeScopeProps<Props extends ThemeScopeProps>(props: Props) {
  const themeState = useTheme();
  return resolveThemeScopeProps(props, themeState);
}
