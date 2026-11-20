import "./task-chip.test.css";
import { afterEach, expect, test } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../lib/theme/theme-provider";
import { TaskChip } from "./task-chip";
import type { TaskStatusId } from "./task-status.recipe";

// A task chip inside a message shows `#N` in the same colours as the task chip
// under the message, in light and dark. Before, the inline chip was grey in
// light and yellow (in progress) in dark. Real browser only: jsdom does not
// resolve colours.

const it = test.skipIf(typeof window === "undefined");

afterEach(cleanup);

const STATUSES: TaskStatusId[] = ["backlog", "todo", "in-progress", "in-review", "done", "closed"];

for (const mode of ["light", "dark"] as const) {
  it(`${mode}: the inline chip's text colour is the task chip's`, () => {
    render(
      <ThemeProvider mode={mode}>
        {STATUSES.map((status) => (
          <p key={status}>
            <TaskChip variant="inline" status={status} data-testid={`inline-${status}`}>
              #1
            </TaskChip>{" "}
            <TaskChip status={status} data-testid={`badge-${status}`}>
              #1
            </TaskChip>
          </p>
        ))}
      </ThemeProvider>,
    );
    const colour = (id: string) => getComputedStyle(screen.getByTestId(id)).color;
    // Ink on the status wash: the status rides the fill (asserted below), the
    // text stays readable ink.
    for (const status of STATUSES) {
      expect(colour(`inline-${status}`), status).toBe(colour(`badge-${status}`));
    }
  });

  // The inline chip's fill and border are the task chip's too. Before, the
  // inline chip sat on one neutral grey fill with no visible border, whatever
  // the status.
  // Raft redesign (Figmama 11/20): no chip has a tint or an outline; the
  // status pixel alone carries the status.
  it(`${mode}: the inline chip and the task chip draw no fill or border`, () => {
    render(
      <ThemeProvider mode={mode}>
        {STATUSES.map((status) => (
          <p key={status}>
            <TaskChip variant="inline" status={status} data-testid={`inline-${status}`}>
              #1
            </TaskChip>{" "}
            <TaskChip status={status} data-testid={`badge-${status}`}>
              #1
            </TaskChip>
          </p>
        ))}
      </ThemeProvider>,
    );
    const style = (id: string) => getComputedStyle(screen.getByTestId(id));
    for (const status of STATUSES) {
      for (const id of [`inline-${status}`, `badge-${status}`]) {
        expect(style(id).backgroundColor, id).toBe("rgba(0, 0, 0, 0)");
        expect(style(id).borderTopWidth, id).toBe("0px");
        expect(style(id).boxShadow, id).toBe("none");
      }
    }
  });
}
