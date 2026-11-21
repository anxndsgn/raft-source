import { test } from "vitest";
import assert from "node:assert/strict";
import { conversationSeamMin } from "../src/components/layout/rowLayout";
import { WORKSPACE_TIMELINE_MIN } from "../src/components/task/sideAreaLayoutRedesign";

// owner 19e73a49: with a workspace open, dragging the channel's side panel wider (its left edge) widened the
// conversation's island into the workspace and, kept up, crashed the page. A seam drag must count the timeline's own
// minimum there (480), not the row's 160, so the panel stops where the timeline can give no more.
test("a seam drag beside an open workspace keeps the timeline's 480", () => {
  assert.equal(conversationSeamMin(true), WORKSPACE_TIMELINE_MIN);
  assert.equal(WORKSPACE_TIMELINE_MIN, 480);
});

test("without a workspace the conversation still goes to the row's 160", () => {
  assert.equal(conversationSeamMin(false), 160);
});
