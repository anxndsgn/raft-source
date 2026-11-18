/**
 * @vitest-environment jsdom
 *
 * The jump pills carry the classes of a Button at `outline md` (one recipe,
 * so they can't drift from it), the dismiss button joins the pill on one
 * shared edge, and the controls float on the edge they are given.
 */
import { afterEach, expect, test } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "../button/button";
import {
  MessageListJumpControls,
  MessageListJumpPill,
  MessageListJumpPillDismiss,
  MessageListJumpPillGroup,
} from "./message-list-jump";

afterEach(cleanup);

import { messageListJump } from "./message-list.recipe";

const classes = (element: Element) => element.className.split(/\s+/).sort();

test("a pill has exactly the classes of a Button at outline md, plus its desktop pill (Raft redesign)", () => {
  render(
    <>
      <Button variant="outline" size="md">
        Back to Bottom
      </Button>
      <MessageListJumpPill>Next Unread Thread</MessageListJumpPill>
    </>,
  );
  const button = screen.getByRole("button", { name: "Back to Bottom" });
  const pill = screen.getByRole("button", { name: "Next Unread Thread" });
  // The Button's own classes, merged with the pill's desktop shape as the pill does.
  const merged = buttonVariants({ variant: "outline", size: "md" }).root({ className: messageListJump().pill() });
  expect(classes(pill)).toEqual(merged.split(/\s+/).sort());
  expect(classes(button).length).toBeGreaterThan(0);
  expect(pill.getAttribute("data-slot")).toBe("message-list-jump-pill");
  expect(pill.getAttribute("type")).toBe("button");
  expect(classes(pill.firstElementChild!)).toEqual(classes(button.firstElementChild!));
});

test("the dismiss button takes its name from the consumer and shares the pill's edge", () => {
  render(
    <MessageListJumpPillGroup>
      <MessageListJumpPill>Next Unread Thread</MessageListJumpPill>
      <MessageListJumpPillDismiss aria-label="Dismiss">
        <svg />
      </MessageListJumpPillDismiss>
    </MessageListJumpPillGroup>,
  );
  const dismiss = screen.getByRole("button", { name: "Dismiss" });
  const names = classes(dismiss);
  expect(names).toEqual(expect.arrayContaining(["border-s-0", "rounded-s-none", "size-8"]));
  expect(names).toEqual(expect.arrayContaining(["border-line-strong", "bg-layer-card"]));
  expect(names).toContain("[&_svg:not([class*='size-'])]:size-4");
  expect(names).not.toContain("[&_svg:not([class*='size-'])]:size-[18px]");
  const group = dismiss.parentElement!;
  expect(group.getAttribute("data-slot")).toBe("message-list-jump-pill-group");
  expect(group.className).toContain("*:data-[slot=message-list-jump-pill]:rounded-e-none");
});

test("the controls float at the bottom by default, above what floats there", () => {
  render(
    <>
      <MessageListJumpControls data-testid="bottom" />
      <MessageListJumpControls data-testid="top" side="top" />
    </>,
  );
  const bottom = screen.getByTestId("bottom");
  const top = screen.getByTestId("top");
  expect(bottom.getAttribute("data-side")).toBe("bottom");
  expect(bottom.className).toContain(
    "bottom-[calc(--spacing(3)+var(--message-list-bottom-inset,0px))]",
  );
  expect(top.getAttribute("data-side")).toBe("top");
  expect(top.className).toContain("top-3");
  expect(top.className).not.toContain("bottom-");
});
