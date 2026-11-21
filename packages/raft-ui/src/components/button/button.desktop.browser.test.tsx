import "./button.test.css";
import { afterEach, expect, test } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../lib/theme/theme-provider";
import { Button } from "./button";

// A Button follows Feishu's specs: on a desktop (from 768px) its label is
// 14px, and the default control height (`lg`, `icon-lg`) is 32px with an 18px
// icon and a 44px hit area; on a phone it keeps 13px labels and 44px controls
// with 22px icons. The sizes switch in the token layer (`text-control`,
// `control-*`), in light and dark alike. Measured in a real browser.

const it = test.skipIf(typeof window === "undefined");

afterEach(cleanup);

const MODES = ["light", "dark"] as const;

async function viewport(width: number) {
  const { page } = await import("vite-plus/test/browser/context");
  await page.viewport(width, 800);
}

function renderButton(mode: (typeof MODES)[number], size?: "md" | "lg" | "xl" | "icon-lg") {
  render(
    <ThemeProvider mode={mode}>
      <Button
        data-testid="button"
        size={size}
        aria-label={size === "icon-lg" ? "Search" : undefined}
      >
        {size === "icon-lg" ? <svg data-testid="icon" viewBox="0 0 24 24" /> : "Assign"}
      </Button>
    </ThemeProvider>,
  );
  return screen.getByTestId("button");
}

const height = (element: Element) => element.getBoundingClientRect().height;

/**
 * The height of the button's ::after hit area. An absolute ::after is placed
 * from the padding box, inside the border, so the border doesn't count.
 */
function hitHeight(button: HTMLElement) {
  const style = getComputedStyle(button);
  const after = getComputedStyle(button, "::after");
  if (after.position !== "absolute") return height(button);
  const px = Number.parseFloat;
  const padding = height(button) - px(style.borderTopWidth) - px(style.borderBottomWidth);
  return padding - px(after.top) - px(after.bottom);
}

for (const mode of MODES) {
  it(`${mode}: on a phone the default Button's label is 13px`, async () => {
    await viewport(390);
    expect(getComputedStyle(renderButton(mode)).fontSize).toBe("13px");
  });

  it(`${mode}: on a desktop the default Button's label is 14px`, async () => {
    await viewport(1280);
    expect(getComputedStyle(renderButton(mode)).fontSize).toBe("14px");
  });

  it(`${mode}: the default Button is 36px on a phone and 32px with a mouse (Raft redesign), with a 44px hit area`, async () => {
    for (const width of [390, 1280]) {
      await viewport(width);
      const button = renderButton(mode);
      expect(height(button), `at ${width}px`).toBe(width < 768 ? 36 : 32);
      expect(hitHeight(button), `at ${width}px`).toBeGreaterThanOrEqual(44);
      cleanup();
    }
  });

  it(`${mode}: on a phone a large Button is 36px and an icon-lg button 40px, with a 20px icon (mobile spec 11/21)`, async () => {
    await viewport(390);
    expect(height(renderButton(mode, "lg"))).toBe(36);
    cleanup();
    expect(height(renderButton(mode, "icon-lg"))).toBe(40);
    expect(height(screen.getByTestId("icon"))).toBe(20);
    cleanup();
    expect(height(renderButton(mode, "xl"))).toBe(52);
  });

  it(`${mode}: on a desktop they are 32px with a 16px icon (Raft redesign) and keep a 44px hit area`, async () => {
    await viewport(1280);
    const large = renderButton(mode, "lg");
    expect(height(large)).toBe(32);
    expect(hitHeight(large)).toBeGreaterThanOrEqual(44);
    cleanup();
    const icon = renderButton(mode, "icon-lg");
    expect(height(icon)).toBe(32);
    expect(hitHeight(icon)).toBeGreaterThanOrEqual(44);
    expect(height(screen.getByTestId("icon"))).toBe(16);
    cleanup();
    expect(height(renderButton(mode, "xl"))).toBe(40);
  });
}
