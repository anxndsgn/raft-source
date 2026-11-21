/**
 * @vitest-environment jsdom
 */
import { afterEach, expect, test } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../lib/theme/theme-provider";
import { PanelNotice, PanelNoticeActions, PanelNoticeContent } from "./panel-notice";

if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(cleanup);

function renderNotice(status?: "warning" | "destructive") {
  render(
    <ThemeProvider>
      <PanelNotice data-testid="notice" status={status}>
        <PanelNoticeContent>Failed to authenticate</PanelNoticeContent>
        <PanelNoticeActions data-testid="actions">
          <button type="button">Copy</button>
        </PanelNoticeActions>
      </PanelNotice>
    </ThemeProvider>,
  );
  return {
    notice: screen.getByTestId("notice").className.split(/\s+/),
    actions: screen.getByTestId("actions").className.split(/\s+/),
  };
}

// Raft redesign (the banner rule, Figmama 11/21 8bcdd507): a panel notice is
// 5% ink with no edge; a status only colours its icon.
test("a raft panel notice draws no edge of its own", () => {
  const { notice } = renderNotice();
  expect(notice).not.toContain("border-b");
  expect(notice).not.toContain("border-line-hairline");
});

test("a raft panel notice takes the panel's edges and the 5% fill, a warning icon by default", () => {
  const { notice } = renderNotice();
  expect(notice).toContain("px-(--column-margin)");
  expect(notice).toContain("bg-fill-medium");
  expect(notice).toContain("[&>svg]:text-presence-error");
});

test("a destructive panel notice takes the danger icon on the 5% fill", () => {
  const { notice } = renderNotice("destructive");
  expect(notice).toContain("bg-fill-medium");
  expect(notice).toContain("[&>svg]:text-danger");
});

test("trailing actions overhang the padding so a 32px button does not grow the strip", () => {
  const { actions } = renderNotice();
  expect(actions).toContain("-my-1.5");
});
