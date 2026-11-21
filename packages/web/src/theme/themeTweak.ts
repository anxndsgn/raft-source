import type { RaftThemeId } from "@botiverse/raft-shared";

/**
 * A member's local tweak of a server's theme (Edit theme): a frame colour that
 * replaces the preset's in light and dark alike, and one corner radius the
 * other radii follow. Kept on this device only, per server, under
 * `raft:theme-tweak:v1:<serverId>`; never sent to the server. The preset
 * itself is the server theme (serverTheme.ts) and is stored on the membership.
 *
 * Pure: the colour math, the radius scale, the stored form and the CSS that
 * applies a tweak. boot/bootInlineScript.ts repeats themeTweakCss in ES5 for
 * the first paint (tests/themeTweak.test.ts keeps the two equal).
 */

export const THEME_TWEAK_STORAGE_PREFIX = "raft:theme-tweak:v1:";

/** The five corner steps. 0 is the default square set, 8 the `data-shape="rounded"` set. */
export const THEME_TWEAK_RADII = [0, 2, 4, 8, 12] as const;
export type ThemeTweakRadius = (typeof THEME_TWEAK_RADII)[number];

/** An OKLCH colour: lightness 0-1, chroma, hue in degrees. */
export interface ThemeFrame {
  l: number;
  c: number;
  h: number;
}

export interface ThemeTweak {
  frame: ThemeFrame | null;
  radius: ThemeTweakRadius;
}

export const NO_THEME_TWEAK: ThemeTweak = { frame: null, radius: 0 };

/** The plate's edge: distance from its centre is chroma, up to this. */
export const THEME_FRAME_CHROMA_MAX = 0.2;

/** The lightness ramp's nine steps, dark to light. */
export const THEME_FRAME_LIGHTNESS_STEPS = [0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86, 0.94] as const;

/** Below this, the frame's text is hard to read (WCAG 1.4.11 for graphics and large text). */
export const THEME_FRAME_MIN_CONTRAST = 3;

/** The foundation's ink (`--sticker-ink`, `--accent-on-frame`). */
export const THEME_INK = "oklch(0.2228 0.0025 67.7)";
export const THEME_WHITE = "oklch(1 0 0)";

/**
 * Each preset's frame in light and dark (raft-ui themes.json `--layer-frame`;
 * Raft Yellow is foundation.css's `--accent-frame` in both). The preset dots
 * show the light one; the plate starts from the one on screen.
 */
export const RAFT_THEME_FRAMES: Record<RaftThemeId, { light: ThemeFrame; dark: ThemeFrame }> = {
  raft: { light: { l: 0.8826, c: 0.1648, h: 92.22 }, dark: { l: 0.8826, c: 0.1648, h: 92.22 } },
  boring: { light: { l: 0.975, c: 0, h: 0 }, dark: { l: 0.19, c: 0, h: 0 } },
  bots: { light: { l: 0.82, c: 0.04, h: 240 }, dark: { l: 0.31, c: 0.04, h: 240 } },
  critters: { light: { l: 0.87, c: 0.07, h: 60 }, dark: { l: 0.31, c: 0.045, h: 60 } },
  space: { light: { l: 0.3, c: 0.1, h: 293 }, dark: { l: 0.29, c: 0.085, h: 293 } },
  desk: { light: { l: 0.83, c: 0.06, h: 75 }, dark: { l: 0.31, c: 0.04, h: 75 } },
  food: { light: { l: 0.88, c: 0.065, h: 355 }, dark: { l: 0.31, c: 0.055, h: 355 } },
  quest: { light: { l: 0.4, c: 0.12, h: 25 }, dark: { l: 0.31, c: 0.08, h: 25 } },
  weather: { light: { l: 0.86, c: 0.085, h: 222 }, dark: { l: 0.3, c: 0.055, h: 245 } },
  plants: { light: { l: 0.8, c: 0.075, h: 158 }, dark: { l: 0.3, c: 0.05, h: 158 } },
  spooky: { light: { l: 0.77, c: 0.14, h: 52 }, dark: { l: 0.27, c: 0.06, h: 300 } },
};

// ---------------------------------------------------------------- storage

function isThemeTweakRadius(value: unknown): value is ThemeTweakRadius {
  return typeof value === "number" && (THEME_TWEAK_RADII as readonly number[]).includes(value);
}

function isFiniteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

/** A stored frame: lightness 0-1, chroma 0-0.4, hue 0-360. Anything else is no frame at all. */
export function isThemeFrame(value: unknown): value is ThemeFrame {
  if (!value || typeof value !== "object") return false;
  const { l, c, h } = value as Record<string, unknown>;
  return isFiniteIn(l, 0, 1) && isFiniteIn(c, 0, 0.4) && isFiniteIn(h, 0, 360);
}

/** The stored tweak, or null when there is none or it isn't one this build wrote. */
export function parseThemeTweak(raw: string | null | undefined): ThemeTweak | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { frame, radius } = value as Record<string, unknown>;
  if (frame !== null && !isThemeFrame(frame)) return null;
  if (!isThemeTweakRadius(radius)) return null;
  return { frame: frame ? { l: frame.l, c: frame.c, h: frame.h } : null, radius };
}

export function serializeThemeTweak(tweak: ThemeTweak): string {
  return JSON.stringify({ frame: tweak.frame ? { l: tweak.frame.l, c: tweak.frame.c, h: tweak.frame.h } : null, radius: tweak.radius });
}

/** No frame and square corners: the preset as it is, nothing to keep or apply. */
export function isThemeTweakEmpty(tweak: ThemeTweak | null | undefined): boolean {
  return !tweak || (tweak.frame === null && tweak.radius === 0);
}

// ---------------------------------------------------------------- colour

/** OKLCH to linear sRGB (Björn Ottosson's OKLab matrices), unclamped. */
export function oklchToLinearSrgb({ l, c, h }: ThemeFrame): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
    -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
    -0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
  ];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** WCAG relative luminance of the colour, clipped into sRGB. */
export function relativeLuminance(frame: ThemeFrame): number {
  const [r, g, b] = oklchToLinearSrgb(frame).map(clamp01);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(luminanceA: number, luminanceB: number): number {
  return (Math.max(luminanceA, luminanceB) + 0.05) / (Math.min(luminanceA, luminanceB) + 0.05);
}

const INK_LUMINANCE = relativeLuminance({ l: 0.2228, c: 0.0025, h: 67.7 });

/** The frame's text colour: ink or white, whichever stands out more, and its contrast. */
export function frameInk(frame: ThemeFrame): { ink: "ink" | "white"; contrast: number } {
  const luminance = relativeLuminance(frame);
  const onInk = contrastRatio(luminance, INK_LUMINANCE);
  const onWhite = contrastRatio(luminance, 1);
  return onInk >= onWhite ? { ink: "ink", contrast: onInk } : { ink: "white", contrast: onWhite };
}

/** `#rrggbb`, clipped into sRGB. */
export function frameHex(frame: ThemeFrame): string {
  const gamma = (x: number) => {
    const v = clamp01(x);
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  return `#${oklchToLinearSrgb(frame).map((x) => Math.round(gamma(x) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** Four decimals at most, no trailing zeros: the same text in the CSS here and in the boot script. */
function num(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

export function frameCss({ l, c, h }: ThemeFrame, alpha?: number): string {
  return `oklch(${num(l)} ${num(c)} ${num(h)}${alpha === undefined ? "" : ` / ${num(alpha)}`})`;
}

// ---------------------------------------------------------------- plate

/**
 * Screen angle (degrees, y down: right 0, down 90) of each plate corner and
 * the hue its label names: top right Red 25, bottom right Yellow 95, bottom
 * left Green 150, top left Blue 260; between two corners hue moves linearly.
 */
const PLATE_CORNERS: ReadonlyArray<readonly [number, number]> = [[-45, 25], [45, 95], [135, 150], [225, 260], [315, 385]];

const mod = (value: number, by: number) => ((value % by) + by) % by;

export function plateAngleToHue(angle: number): number {
  const a = mod(angle + 45, 360) - 45;
  for (let i = 0; i < 4; i += 1) {
    const [a0, h0] = PLATE_CORNERS[i];
    const [a1, h1] = PLATE_CORNERS[i + 1];
    if (a >= a0 && a <= a1) return mod(h0 + ((a - a0) / (a1 - a0)) * (h1 - h0), 360);
  }
  return 25;
}

export function hueToPlateAngle(hue: number): number {
  const h = mod(hue - 25, 360) + 25;
  for (let i = 0; i < 4; i += 1) {
    const [a0, h0] = PLATE_CORNERS[i];
    const [a1, h1] = PLATE_CORNERS[i + 1];
    if (h >= h0 && h <= h1) return a0 + ((h - h0) / (h1 - h0)) * (a1 - a0);
  }
  return -45;
}

/** Where the knob sits, in percent of the plate (the edge is 90% of the way out). */
export function platePosition({ c, h }: ThemeFrame): { x: number; y: number } {
  const angle = (hueToPlateAngle(h) * Math.PI) / 180;
  const distance = Math.min(1, c / THEME_FRAME_CHROMA_MAX) * 0.9;
  return { x: 50 + Math.cos(angle) * distance * 50, y: 50 + Math.sin(angle) * distance * 50 };
}

/** The colour at a point of the plate (dx, dy from -1 to 1 across it), keeping the lightness. */
export function frameAtPlatePoint(dx: number, dy: number, lightness: number): ThemeFrame {
  const distance = Math.min(1, Math.hypot(dx, dy) / 0.9);
  return { l: lightness, c: distance * THEME_FRAME_CHROMA_MAX, h: plateAngleToHue((Math.atan2(dy, dx) * 180) / Math.PI) };
}

/** The ramp step nearest the lightness. */
export function nearestLightnessStep(lightness: number): number {
  let nearest = 0;
  THEME_FRAME_LIGHTNESS_STEPS.forEach((step, index) => {
    if (Math.abs(step - lightness) < Math.abs(THEME_FRAME_LIGHTNESS_STEPS[nearest] - lightness)) nearest = index;
  });
  return nearest;
}

// ---------------------------------------------------------------- CSS

/**
 * The radius scale for one r: island r, container and dialog 0.75r, control
 * (and the per-device control and bar-button corners) 0.5r, chip and sticker
 * 0.25r; the pill stays round. r = 0 is the default square set, r = 8 the
 * `data-shape="rounded"` set (raft-ui styles.css, Shape and accent).
 */
export function themeTweakRadiusVariables(radius: ThemeTweakRadius): Record<string, string> {
  const px = (value: number) => `${num(value)}px`;
  return {
    "--radius-sticker": px(radius * 0.25),
    "--radius-chip": px(radius * 0.25),
    "--radius-control": px(radius * 0.5),
    "--radius-container": px(radius * 0.75),
    "--radius-dialog": px(radius * 0.75),
    "--radius-island": px(radius),
    "--control-radius": px(radius * 0.5),
    "--bar-button-radius": px(radius * 0.5),
  };
}

/**
 * What a frame colour sets, in both modes: the frame and accent, its dim
 * step, the ink or white type on it, the brand tokens that are the frame's
 * colour (the selection, a soft brand wash), and the selected rail item back
 * to the canvas (a theme's dark mode may use brand there, which is now the
 * frame). `brandStrong` is text on the page: darker than the frame in light,
 * lighter in dark.
 */
export function themeTweakFrameVariables(frame: ThemeFrame): {
  both: Record<string, string>;
  light: Record<string, string>;
  dark: Record<string, string>;
} {
  const color = frameCss(frame);
  const white = frameInk(frame).ink === "white";
  const on = white ? THEME_WHITE : THEME_INK;
  return {
    both: {
      "--accent-frame": color,
      "--layer-frame": color,
      "--accent-frame-dim": frameCss({ l: Math.max(0, frame.l - 0.2), c: frame.c * 0.7, h: frame.h }),
      "--accent-on-frame": on,
      "--foreground-on-frame": on,
      "--foreground-on-frame-muted": white ? "oklch(1 0 0 / 0.7)" : "oklch(0.2228 0.0025 67.7 / 0.7)",
      "--fill-frame-medium": white ? "oklch(1 0 0 / 0.07)" : "oklch(0.2228 0.0025 67.7 / 0.06)",
      "--line-frame-active": "transparent",
      "--layer-frame-active": "var(--layer-canvas)",
      "--foreground-on-frame-active": "var(--foreground)",
      "--brand-400": color,
      "--brand-glow": color,
      "--brand-soft": frameCss(frame, 0.25),
      "--brand-edge": "transparent",
      "--selection": frameCss(frame, 0.35),
    },
    light: { "--brand-strong": frameCss({ l: Math.min(frame.l, 0.42), c: frame.c * 0.6, h: frame.h }) },
    dark: { "--brand-strong": frameCss({ l: Math.max(frame.l, 0.82), c: frame.c, h: frame.h }) },
  };
}

const block = (selector: string, variables: Record<string, string>) =>
  `${selector}{${Object.entries(variables).map(([name, value]) => `${name}:${value} !important;`).join("")}}`;

/**
 * The stylesheet that applies a tweak: `[data-theme-tweak]` on <html> and on
 * every portal (raft-ui carries it there, theme-scope.ts). `!important`
 * because a theme's own rules (`.dark[data-theme="bots"]`) are more specific
 * than an attribute alone. Empty for no tweak.
 */
export function themeTweakCss(tweak: ThemeTweak | null): string {
  if (!tweak || isThemeTweakEmpty(tweak)) return "";
  const both: Record<string, string> = {};
  let css = "";
  if (tweak.frame) {
    const frame = themeTweakFrameVariables(tweak.frame);
    Object.assign(both, frame.both);
    if (tweak.radius !== 0) Object.assign(both, themeTweakRadiusVariables(tweak.radius));
    css += block("[data-theme-tweak]", both);
    css += block(":root[data-theme-tweak],.light[data-theme-tweak]", frame.light);
    css += block(".dark[data-theme-tweak]", frame.dark);
    css += `@media (prefers-color-scheme: dark){${block(":root:not(.light):not(.dark)[data-theme-tweak]", frame.dark)}}`;
    return css;
  }
  return block("[data-theme-tweak]", themeTweakRadiusVariables(tweak.radius));
}
