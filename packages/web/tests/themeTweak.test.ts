import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BOOT_HINTS_SCRIPT,
  BOOT_SERVER_THEME_STORAGE_PREFIX,
  BOOT_THEME_TWEAK_STATEMENT,
  BOOT_THEME_TWEAK_STORAGE_PREFIX,
  BOOT_THEME_TWEAK_STYLE_ID,
} from "../src/boot/bootInlineScript";
import {
  contrastRatio,
  frameAtPlatePoint,
  frameHex,
  frameInk,
  hueToPlateAngle,
  isThemeTweakEmpty,
  nearestLightnessStep,
  parseThemeTweak,
  plateAngleToHue,
  platePosition,
  RAFT_THEME_FRAMES,
  relativeLuminance,
  serializeThemeTweak,
  THEME_FRAME_LIGHTNESS_STEPS,
  THEME_TWEAK_RADII,
  THEME_TWEAK_STORAGE_PREFIX,
  themeTweakCss,
  themeTweakRadiusVariables,
} from "../src/theme/themeTweak";
import type { ThemeTweak } from "../src/theme/themeTweak";
import { THEME_TWEAK_STYLE_ID } from "../src/theme/themeTweakRoot";

const RAFT_UI = new URL("../../raft-ui/src/", import.meta.url);
const stylesCss = readFileSync(new URL("styles.css", RAFT_UI), "utf8");

/** The declarations of the first rule whose selector list is exactly `selector`. */
function ruleDeclarations(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries(
    body.split(";").map((part) => part.replace(/\/\*[\s\S]*?\*\//g, "").trim()).filter(Boolean).map((part) => {
      const colon = part.indexOf(":");
      return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()];
    }),
  );
}

test("radius r = 8 is exactly the rounded shape of raft-ui styles.css", () => {
  assert.deepEqual(themeTweakRadiusVariables(8), ruleDeclarations(stylesCss, '[data-shape="rounded"]'));
});

test("radius r = 0 is exactly the default square shape", () => {
  const square = ruleDeclarations(stylesCss, ':root,\n[data-shape="square"]');
  // The scale's defaults (@theme) are 0, and the control and bar-button corners are set to 0 on :root.
  for (const name of ["--radius-sticker", "--radius-chip", "--radius-control", "--radius-container", "--radius-dialog", "--radius-island"]) {
    assert.match(stylesCss, new RegExp(`\\n  ${name}: 0px;`), name);
  }
  assert.deepEqual(themeTweakRadiusVariables(0), {
    "--radius-sticker": "0px",
    "--radius-chip": "0px",
    "--radius-control": "0px",
    "--radius-container": "0px",
    "--radius-dialog": "0px",
    "--radius-island": "0px",
    ...square,
  });
  assert.equal(themeTweakCss({ frame: null, radius: 0 }), "", "no tweak, no stylesheet");
});

test("the other steps follow the scale: island r, container 0.75r, control 0.5r, chip 0.25r", () => {
  assert.deepEqual(themeTweakRadiusVariables(12), {
    "--radius-sticker": "3px",
    "--radius-chip": "3px",
    "--radius-control": "6px",
    "--radius-container": "9px",
    "--radius-dialog": "9px",
    "--radius-island": "12px",
    "--control-radius": "6px",
    "--bar-button-radius": "6px",
  });
  assert.doesNotMatch(themeTweakCss({ frame: null, radius: 4 }), /--radius-pill/);
});

test("the frame's text is ink or white, whichever has the higher contrast", () => {
  assert.equal(frameInk(RAFT_THEME_FRAMES.raft.light).ink, "ink", "Raft Yellow");
  assert.equal(frameInk(RAFT_THEME_FRAMES.space.light).ink, "white", "Space's deep violet");
  assert.equal(frameInk({ l: 0.94, c: 0.05, h: 200 }).ink, "ink");
  assert.equal(frameInk({ l: 0.3, c: 0.1, h: 260 }).ink, "white");
  for (const l of [0.3, 0.5, 0.62, 0.7, 0.94]) {
    const frame = { l, c: 0.12, h: 150 };
    const { ink, contrast } = frameInk(frame);
    const onWhite = contrastRatio(relativeLuminance(frame), 1);
    const onInk = contrastRatio(relativeLuminance(frame), relativeLuminance({ l: 0.2228, c: 0.0025, h: 67.7 }));
    assert.equal(contrast, Math.max(onWhite, onInk));
    assert.equal(ink, onInk >= onWhite ? "ink" : "white");
  }
  assert.ok(frameInk({ l: 0.62, c: 0.1, h: 25 }).contrast < 5, "a mid frame reads poorly either way");
  assert.equal(frameHex({ l: 1, c: 0, h: 0 }), "#ffffff");
  assert.equal(frameHex({ l: 0, c: 0, h: 0 }), "#000000");
  const css = themeTweakCss({ frame: RAFT_THEME_FRAMES.space.light, radius: 0 });
  assert.match(css, /--foreground-on-frame:oklch\(1 0 0\) !important;/);
  assert.match(css, /--accent-on-frame:oklch\(1 0 0\) !important;/);
});

test("plate angle and hue round trip, and the corners are the hues they name", () => {
  assert.equal(plateAngleToHue(-45), 25, "top right: red");
  assert.equal(plateAngleToHue(45), 95, "bottom right: yellow");
  assert.equal(plateAngleToHue(135), 150, "bottom left: green");
  assert.equal(plateAngleToHue(225), 260, "top left: blue");
  for (let hue = 0; hue < 360; hue += 7.5) {
    assert.ok(Math.abs(plateAngleToHue(hueToPlateAngle(hue)) - hue) < 1e-9, `hue ${hue}`);
  }
  for (let angle = -45; angle < 315; angle += 10) {
    assert.ok(Math.abs(hueToPlateAngle(plateAngleToHue(angle)) - angle) < 1e-9, `angle ${angle}`);
  }
  const frame = { l: 0.7, c: 0.12, h: 200 };
  const { x, y } = platePosition(frame);
  const back = frameAtPlatePoint(x / 50 - 1, y / 50 - 1, 0.7);
  assert.ok(Math.abs(back.c - 0.12) < 1e-9 && Math.abs(back.h - 200) < 1e-9);
  assert.equal(frameAtPlatePoint(0, 0, 0.5).c, 0, "the centre is grey");
  assert.equal(frameAtPlatePoint(1, 1, 0.5).c, 0.2, "the edge is the most colourful");
});

test("the lightness ramp is nine steps from .30 to .94", () => {
  assert.deepEqual([...THEME_FRAME_LIGHTNESS_STEPS], [0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86, 0.94]);
  assert.equal(nearestLightnessStep(0.8826), 7);
  assert.equal(nearestLightnessStep(0), 0);
});

test("parseThemeTweak keeps what this build wrote and rejects anything else", () => {
  const tweak: ThemeTweak = { frame: { l: 0.7, c: 0.1, h: 200 }, radius: 4 };
  assert.deepEqual(parseThemeTweak(serializeThemeTweak(tweak)), tweak);
  assert.deepEqual(parseThemeTweak('{"frame":null,"radius":8}'), { frame: null, radius: 8 });
  for (const raw of [
    null, "", "not json", "null", "[]", "42", '"x"', "{}",
    '{"frame":null}', '{"frame":null,"radius":3}', '{"frame":null,"radius":"8"}', '{"frame":null,"radius":-0.5}',
    '{"frame":{"l":0.5,"c":0.1},"radius":0}', '{"frame":{"l":2,"c":0.1,"h":20},"radius":0}',
    '{"frame":{"l":0.5,"c":-1,"h":20},"radius":0}', '{"frame":{"l":0.5,"c":0.1,"h":400},"radius":0}',
    '{"frame":{"l":"0.5","c":0.1,"h":20},"radius":0}', '{"frame":"red","radius":0}', '{"frame":[0.5,0.1,20],"radius":0}',
  ]) {
    assert.equal(parseThemeTweak(raw), null, String(raw));
  }
  assert.ok(isThemeTweakEmpty({ frame: null, radius: 0 }));
  assert.ok(!isThemeTweakEmpty({ frame: null, radius: 2 }));
});

test("the preset frames are raft-ui's", () => {
  const themes = JSON.parse(readFileSync(new URL("themes.json", RAFT_UI), "utf8")).themes as Record<string, Record<"light" | "dark", Record<string, string>>>;
  const foundation = readFileSync(new URL("foundation.css", RAFT_UI), "utf8");
  const css = ({ l, c, h }: { l: number; c: number; h: number }) => `${l} ${c} ${h}`;
  const parse = (value: string) => value.replace(/^oklch\(|\)$/g, "").split(" ").map(Number).join(" ");
  assert.match(foundation, new RegExp(`--accent-frame: oklch\\(${css(RAFT_THEME_FRAMES.raft.light)}\\);`));
  for (const [id, frames] of Object.entries(RAFT_THEME_FRAMES)) {
    if (id === "raft") continue;
    assert.equal(css(frames.light), parse(themes[id].light["--layer-frame"]), `${id} light`);
    assert.equal(css(frames.dark), parse(themes[id].dark["--layer-frame"]), `${id} dark`);
  }
});

/** The boot script's statement on a page whose storage holds this tweak: the stylesheet it writes. */
function bootTweakCss(stored: string | null): { css: string | null; attribute: boolean } {
  const styles: { id: string; textContent: string }[] = [];
  let attribute = false;
  const document = {
    createElement: () => ({ id: "", textContent: "" }),
    head: { appendChild: (element: { id: string; textContent: string }) => styles.push(element) },
  };
  const d = { setAttribute: (name: string) => { attribute = name === "data-theme-tweak"; } };
  const s = { getItem: (key: string) => (key === `${BOOT_THEME_TWEAK_STORAGE_PREFIX}srv-1` ? stored : null) };
  new Function("document", "d", "s", "sid", BOOT_THEME_TWEAK_STATEMENT)(document, d, s, "srv-1");
  assert.ok(styles.length <= 1);
  if (styles[0]) assert.equal(styles[0].id, THEME_TWEAK_STYLE_ID);
  return { css: styles[0]?.textContent ?? null, attribute };
}

test("the boot script writes the same stylesheet as themeTweakCss, and nothing for what parseThemeTweak rejects", () => {
  assert.equal(BOOT_THEME_TWEAK_STORAGE_PREFIX, THEME_TWEAK_STORAGE_PREFIX);
  assert.equal(BOOT_THEME_TWEAK_STYLE_ID, THEME_TWEAK_STYLE_ID);
  assert.ok(BOOT_HINTS_SCRIPT.includes(BOOT_THEME_TWEAK_STATEMENT));
  let cases = 0;
  for (const radius of THEME_TWEAK_RADII) {
    const frames = [null, ...Object.values(RAFT_THEME_FRAMES).flatMap((f) => [f.light, f.dark])];
    for (let l = 0.3; l <= 0.94; l += 0.08) frames.push({ l, c: 0.137, h: (l * 997) % 360 });
    for (const frame of frames) {
      const tweak = { frame, radius };
      const expected = themeTweakCss(tweak);
      const boot = bootTweakCss(serializeThemeTweak(tweak));
      assert.equal(boot.css, expected || null, JSON.stringify(tweak));
      assert.equal(boot.attribute, expected !== "");
      cases += 1;
    }
  }
  assert.ok(cases > 100);
  for (const raw of [null, "nope", "[]", '{"frame":null,"radius":3}', '{"frame":{"l":2,"c":0,"h":0},"radius":0}', '{"frame":{"l":0.5,"c":0.1,"h":20}}']) {
    assert.deepEqual(bootTweakCss(raw), { css: null, attribute: false }, String(raw));
  }
});

test("the boot script finds the tweak by the server id the theme cache keeps beside the slug", () => {
  const stored: Record<string, string> = {
    slock_access_token: "t",
    [`${BOOT_SERVER_THEME_STORAGE_PREFIX}srv-9`]: JSON.stringify({ theme: "bots", decor: true, slug: "demo" }),
    [`${BOOT_THEME_TWEAK_STORAGE_PREFIX}srv-9`]: serializeThemeTweak({ frame: { l: 0.6, c: 0.15, h: 30 }, radius: 8 }),
  };
  const keys = Object.keys(stored);
  const storage = { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (key: string) => stored[key] ?? null };
  const styles: { id: string; textContent: string }[] = [];
  const attributes: Record<string, string> = {};
  const document = {
    documentElement: {
      classList: { add: () => {} },
      dataset: {} as Record<string, string>,
      style: { setProperty: () => {} },
      setAttribute: (name: string, value: string) => { attributes[name] = value; },
    },
    getElementById: () => null,
    createElement: () => ({ id: "", textContent: "" }),
    head: { appendChild: (element: { id: string; textContent: string }) => styles.push(element) },
  };
  new Function("document", "localStorage", "location", "navigator", BOOT_HINTS_SCRIPT)(
    document, storage, new URL("/s/demo/channel/general", "https://app.raft.build"), { languages: [] },
  );
  assert.equal(document.documentElement.dataset.theme, "bots");
  assert.equal(attributes["data-theme-tweak"], "");
  assert.deepEqual(styles.map((style) => style.textContent), [themeTweakCss({ frame: { l: 0.6, c: 0.15, h: 30 }, radius: 8 })]);
});
