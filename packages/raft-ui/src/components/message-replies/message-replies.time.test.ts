/**
 * Reply-preview time contract.
 *
 * The reply time takes the message-header time's type — the sans (Raft
 * redesign: times are Inter, mobile spec 11/21), the mono-meta step, tabular
 * numerals, hint ink — so the two times read as one.
 */
import { expect, test } from "vite-plus/test";
import { messageItem } from "../message-item/message-item.recipe";
import { messageReplies } from "./message-replies.recipe";

test("reply time is sans, mono-meta, tabular — the message-header time's type", () => {
  const reply = messageReplies().time();
  const header = messageItem().time();
  for (const token of ["font-sans", "text-mono-meta", "tabular-nums", "text-foreground-hint"]) {
    expect(reply, `reply time ${token}`).toContain(token);
    expect(header, `header time ${token}`).toContain(token);
  }
  expect(reply).not.toContain("font-mono");
});
