import assert from "node:assert/strict";
import { test } from "vitest";
import { channelTypeSupportsReplyMode, provisionalTaskTitle, replyExcerpt } from "./replyMode";
import { formatAgentMessageLine, formatAgentReplyHeaderFields, formatAgentReplyQuoteSuffix } from "./agentMessageText";

test("reply excerpt: the first non-empty line, cut at 80 characters", () => {
  assert.equal(replyExcerpt("\n\n  first line  \nsecond"), "first line");
  assert.equal(replyExcerpt("x".repeat(100)), `${"x".repeat(79)}…`);
  assert.equal(Array.from(replyExcerpt("汉".repeat(100))).length, 80);
  assert.equal(replyExcerpt(""), "");
});

test("provisional task title: the first sentence, without its full stop", () => {
  assert.equal(provisionalTaskTitle("Fix the login page. It crashes on Safari."), "Fix the login page");
  assert.equal(provisionalTaskTitle("修复登录页。Safari 上会崩。"), "修复登录页");
  assert.equal(provisionalTaskTitle("Can you check the deploy? It looks stuck"), "Can you check the deploy?");
  assert.equal(provisionalTaskTitle("v1.2 is out\nmore"), "v1.2 is out");
  assert.equal(Array.from(provisionalTaskTitle("长".repeat(200))).length, 60);
});

test("reply mode is for public and private regular channels only", () => {
  assert.equal(channelTypeSupportsReplyMode("channel"), true);
  assert.equal(channelTypeSupportsReplyMode("private"), true);
  for (const type of ["dm", "thread", "task", "joint", null]) assert.equal(channelTypeSupportsReplyMode(type), false);
});

test("agent message line: reply_to= and task= in the header, the original under the body", () => {
  const replyTo = { message_id: "3f2a1c9e-0000-4000-8000-000000000000", sender_name: "Anna", excerpt: "Can you check the deploy?", deleted: false };
  assert.equal(formatAgentReplyHeaderFields({ reply_to: replyTo, linked_tasks: [3, 5] }), " reply_to=3f2a1c9e task=#3,#5");
  assert.equal(formatAgentReplyHeaderFields({}), "");
  assert.equal(formatAgentReplyQuoteSuffix({ reply_to: replyTo }), "\n  ↳ replying to @Anna msg=3f2a1c9e: Can you check the deploy?");
  assert.equal(formatAgentReplyQuoteSuffix({ reply_to: { ...replyTo, deleted: true, sender_name: null, excerpt: "" } }), "\n  ↳ replying to msg=3f2a1c9e (original deleted)");
  const line = formatAgentMessageLine({
    channel_type: "channel",
    channel_name: "general",
    message_id: "aaaaaaaa-0000-4000-8000-000000000000",
    timestamp: "2026-11-14T10:00:00.000Z",
    sender_type: "agent",
    sender_name: "Betty",
    content: "Done.",
    reply_to: replyTo,
    linked_tasks: [3],
  });
  assert.match(line, /^\[target=#general msg=aaaaaaaa time=2026-11-14 10:00:00Z type=agent reply_to=3f2a1c9e task=#3\] @Betty: Done\.\n  ↳ replying to @Anna msg=3f2a1c9e: Can you check the deploy\?/);
});
