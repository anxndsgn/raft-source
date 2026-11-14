/**
 * Reply mode (channels.reply_mode, PRD "取消 thread，用回复和 task 接着说"):
 * agents reply with `--reply-to` and link messages to tasks; a message wakes
 * only the agents it concerns; old threads are read-only.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "../db/index";
import { channels, messageMentions, messages, messageTasks, taskEvents, tasks, userChannelReadCursors, users } from "../db/schema";
import { createApiTest } from "../test/integration/apiTest";
import { fixturePasswordHash } from "../test/integration/credentials";
import { mintAgentCredential } from "../services/agentCredentialService";
import { createAgent } from "../services/agentService";
import { addAgent, addHuman, createChannel, getOrCreateThread, updateChannel } from "../services/channelService";
import { broadcastAndDeliver, createMessage } from "../services/messageService";
import { createServer } from "../services/serverService";
import { taskLinkedMessageSummary } from "../services/replyModeService";
import { listTaskHistory } from "../services/taskService";
import type { AgentOrchestrator } from "../services/agentOrchestrator";

const test = createApiTest();

type Delivery = { agentId: string; messageId: string; message: Record<string, unknown> };

function installRecordingOrchestrator(app: { set: (key: string, value: unknown) => void }): Delivery[] {
  const deliveries: Delivery[] = [];
  const deliverMessage = async (agentId: string, message: Record<string, unknown>) => {
    deliveries.push({ agentId, messageId: String(message.message_id), message });
    return { status: "queued" as const };
  };
  app.set("agentOrchestrator", {
    deliverMessage,
    deliverMessagesOnChannel: (_channelId: string, batch: ReadonlyArray<{ agentId: string; message: Record<string, unknown> }>) =>
      batch.map(({ agentId, message }) => deliverMessage(agentId, message)),
    loadDeliveryGates: async () => null,
    recordAgentRaftAction: async () => {},
    endAgentTypingForPostedMessage: async () => {},
  });
  return deliveries;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 300));
}

async function setup(slug: string) {
  const [owner] = await getDb().insert(users).values({
    email: `${slug}-${randomUUID()}@slock.test`,
    name: `${slug}-${randomUUID().slice(0, 8)}`,
    displayName: `${slug} owner`,
    passwordHash: await fixturePasswordHash("password123"),
    emailVerified: true,
    profileSetupCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
  }).returning();
  const server = await createServer(`ReplyMode ${slug}`, `${slug}-${randomUUID()}`, owner!.id);
  const channel = await createChannel(server.id, slug);
  await addHuman(channel.id, owner!.id);
  const agents = [];
  for (const name of ["a", "b", "c"]) {
    const agent = await createAgent(server.id, `${slug}-${name}-${randomUUID().slice(0, 6)}`, { runtime: "claude" });
    await addAgent(channel.id, agent.id);
    const { apiKey } = await mintAgentCredential({
      agentId: agent.id,
      scopes: ["send", "read", "tasks", "channels"],
      name: `reply-mode-${randomUUID().slice(0, 6)}`,
      issuedVia: "computer", createdByUserId: null,
    });
    agents.push({ ...agent, key: apiKey });
  }
  return { owner: owner!, server, channel, a: agents[0]!, b: agents[1]!, c: agents[2]! };
}

type Body = { [key: string]: unknown; code?: string; error?: string };

async function agentCall(baseUrl: string, apiKey: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}/internal/agent-api/${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() as Body };
}

async function agentSend(baseUrl: string, apiKey: string, body: Record<string, unknown>) {
  return agentCall(baseUrl, apiKey, "POST", "v2/send", { idempotencyKey: randomUUID(), continueAnyway: true, sendDraft: true, ...body });
}

function sentId(body: Body): string {
  const message = (body.message ?? body) as { id?: string; messageId?: string };
  const id = message.id ?? message.messageId ?? (body as { messageId?: string }).messageId;
  assert.equal(typeof id, "string", JSON.stringify(body));
  return id!;
}

function wokenFor(deliveries: Delivery[], messageId: string): string[] {
  return deliveries.filter((d) => d.messageId === messageId).map((d) => d.agentId).sort();
}

async function humanSend(app: { app: { get: (key: string) => unknown } }, channelId: string, userId: string, content: string, reply?: { replyToMessageId: string | null; taskIds: string[] }) {
  const message = await broadcastAndDeliver(app.app.get("io") as never, app.app.get("agentOrchestrator") as AgentOrchestrator, {
    channelId,
    senderType: "user",
    senderId: userId,
    senderName: "owner",
    content,
    ...(reply ? { reply } : {}),
  });
  return message.id;
}

test("reply mode: who a message wakes", async ({ app }) => {
  const deliveries = installRecordingOrchestrator(app.app);
  const { owner, channel, a, b, c } = await setup("rm-route");
  await updateChannel(channel.id, { replyMode: true });

  // 6: a person's message with nothing else wakes every agent.
  const question = await humanSend(app, channel.id, owner.id, "Who can look at the deploy?");
  await settle();
  assert.deepEqual(wokenFor(deliveries, question), [a.id, b.id, c.id].sort());

  // 5: an agent's message with nothing else wakes no agent.
  const notice = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "FYI: deploy started" });
  assert.equal(notice.status, 200, JSON.stringify(notice.body));
  await settle();
  assert.deepEqual(wokenFor(deliveries, sentId(notice.body)), []);

  // 1: a reply wakes the original's author and the chain (only agents are woken).
  const answer = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "I'll take it", replyTo: question.slice(0, 8) });
  assert.equal(answer.status, 200, JSON.stringify(answer.body));
  await settle();
  const answerId = sentId(answer.body);
  assert.deepEqual(wokenFor(deliveries, answerId), [], "the original is a person's: no agent is woken");
  const [stored] = await getDb().select().from(messages).where(eq(messages.id, answerId));
  assert.equal(stored!.replyToMessageId, question);
  // The person replied to sees it in Activity, like a mention.
  const attention = await getDb().select().from(messageMentions).where(eq(messageMentions.messageId, answerId));
  assert.deepEqual(attention.map((row) => [row.targetId, row.source]), [[owner.id, "reply"]]);

  const followUp = await agentSend(app.baseUrl, b.key, { target: `#${channel.name}`, content: "Need a hand?", replyTo: answerId });
  assert.equal(followUp.status, 200, JSON.stringify(followUp.body));
  await settle();
  assert.deepEqual(wokenFor(deliveries, sentId(followUp.body)), [a.id], "the chain above: a");
  const delivered = deliveries.find((d) => d.messageId === sentId(followUp.body))!.message;
  assert.equal((delivered.reply_to as { message_id: string }).message_id, answerId);

  // 2: a mention still wakes whoever it names.
  const mention = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: `@${c.name} can you check?` });
  await settle();
  assert.deepEqual(wokenFor(deliveries, sentId(mention.body)), [c.id]);
});

test("reply mode: task links, inheritance and retag", async ({ app }) => {
  const deliveries = installRecordingOrchestrator(app.app);
  const { owner, channel, a, b, c } = await setup("rm-task");
  await updateChannel(channel.id, { replyMode: true });
  const [task] = await getDb().insert(tasks).values({
    channelId: channel.id, taskNumber: 1, title: "Fix deploy", status: "in_progress",
    createdByType: "user", createdById: owner.id, claimedByType: "agent", claimedById: c.id, claimedAt: new Date(),
  }).returning();

  // 4: an agent's message linked to a task wakes its followers (assignee c).
  const update = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "Progress on deploy", tasks: [1] });
  assert.equal(update.status, 200, JSON.stringify(update.body));
  await settle();
  const updateId = sentId(update.body);
  assert.deepEqual(wokenFor(deliveries, updateId), [c.id]);

  // A reply inherits the original's tasks; a has written in the task now.
  const reply = await agentSend(app.baseUrl, b.key, { target: `#${channel.name}`, content: "Looks good", replyTo: updateId });
  await settle();
  const replyId = sentId(reply.body);
  const links = await getDb().select().from(messageTasks).where(eq(messageTasks.messageId, replyId));
  assert.deepEqual(links.map((l) => l.taskId), [task!.id]);
  assert.deepEqual(wokenFor(deliveries, replyId), [a.id, c.id].sort());

  // Unknown task number.
  const unknown = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "x", tasks: [99] });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.code, "task_not_found");

  // Retag: unlink and link again; both are recorded on the task.
  const removed = await agentCall(app.baseUrl, a.key, "POST", `messages/${replyId}/tasks`, { remove: [1] });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.deepEqual(removed.body.taskNumbers, []);
  const added = await agentCall(app.baseUrl, a.key, "POST", `messages/${replyId}/tasks`, { add: [1] });
  assert.deepEqual(added.body.taskNumbers, [1]);
  const events = await getDb().select().from(taskEvents).where(eq(taskEvents.taskId, task!.id));
  assert.ok(events.some((e) => e.eventType === "message_unlinked"));
  assert.ok(events.filter((e) => e.eventType === "message_linked").length >= 2);

  // read --task and --replies.
  const byTask = await agentCall(app.baseUrl, a.key, "GET", `history?channel=${encodeURIComponent(`#${channel.name}`)}&task=1`);
  assert.equal(byTask.status, 200, JSON.stringify(byTask.body));
  assert.deepEqual((byTask.body.messages as Array<{ id: string }>).map((m) => m.id), [updateId, replyId]);
  const chain = await agentCall(app.baseUrl, a.key, "GET", `history?channel=${encodeURIComponent(`#${channel.name}`)}&replies=${replyId.slice(0, 8)}`);
  assert.deepEqual((chain.body.messages as Array<{ id: string }>).map((m) => m.id), [updateId, replyId]);
});

test("reply mode: replies stay on one timeline; old threads are read-only", async ({ app }) => {
  installRecordingOrchestrator(app.app);
  const { owner, server, channel, a } = await setup("rm-scope");
  const root = await createMessage(channel.id, "user", owner.id, "old topic");
  const thread = await getOrCreateThread(root.id, owner.id, "user");
  const inThread = await createMessage(thread.id, "user", owner.id, "old reply");
  const other = await createChannel(server.id, `rm-other-${randomUUID().slice(0, 6)}`);
  const elsewhere = await createMessage(other.id, "user", owner.id, "elsewhere");

  // Off: no replies.
  const off = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "x", replyTo: root.id });
  assert.equal(off.status, 400);
  assert.equal(off.body.code, "reply_mode_off");

  await updateChannel(channel.id, { replyMode: true });
  const [row] = await getDb().select({ replyMode: channels.replyMode }).from(channels).where(eq(channels.id, channel.id));
  assert.equal(row!.replyMode, true);

  const toThreadMessage = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "x", replyTo: inThread.id });
  assert.equal(toThreadMessage.status, 404, "a message inside a thread is not on the timeline");
  const toOtherChannel = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "x", replyTo: elsewhere.id });
  assert.equal(toOtherChannel.status, 404, "another channel's message");

  const intoOldThread = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}:${root.id.slice(0, 8)}`, content: "late" });
  assert.equal(intoOldThread.status, 409, JSON.stringify(intoOldThread.body));
  assert.equal(intoOldThread.body.code, "thread_closed_reply_mode");
  assert.match(String(intoOldThread.body.error), /--reply-to/);
  const threadMessages = await getDb().select().from(messages).where(and(eq(messages.channelId, thread.id)));
  assert.equal(threadMessages.length, 1, "nothing was posted in the old thread");
});

test("reply mode: turning it on retires in_review and links existing task discussions", async ({ app: _app }) => {
  const { owner, channel } = await setup("rm-enable");
  const host = await createMessage(channel.id, "user", owner.id, "Please fix the build");
  const thread = await getOrCreateThread(host.id, owner.id, "user");
  const threadReply = await createMessage(thread.id, "user", owner.id, "details in the thread");
  const [task] = await getDb().insert(tasks).values({
    channelId: channel.id, taskNumber: 1, title: "Fix the build", status: "in_review",
    createdByType: "user", createdById: owner.id, messageId: host.id, sourceMessageId: host.id,
  }).returning();

  await updateChannel(channel.id, { replyMode: true });
  const [after] = await getDb().select().from(tasks).where(eq(tasks.id, task!.id));
  assert.equal(after!.status, "done");
  const linked = (await getDb().select().from(messageTasks).where(eq(messageTasks.taskId, task!.id))).map((l) => l.messageId).sort();
  assert.deepEqual(linked, [host.id, threadReply.id].sort());

  // Again: nothing new.
  await updateChannel(channel.id, { replyMode: false });
  await updateChannel(channel.id, { replyMode: true });
  assert.equal((await getDb().select().from(messageTasks).where(eq(messageTasks.taskId, task!.id))).length, 2);
});

test("reply mode loop guard: past 20 agent messages in a chain, agents (and their mentions) wake no one", async ({ app }) => {
  const deliveries = installRecordingOrchestrator(app.app);
  const { owner, channel, a, b } = await setup("rm-loop");
  await updateChannel(channel.id, { replyMode: true });
  let previous = await humanSend(app, channel.id, owner.id, "start");
  for (let i = 0; i < 20; i += 1) {
    const sender = i % 2 === 0 ? a : b;
    const sent = await agentSend(app.baseUrl, sender.key, { target: `#${channel.name}`, content: `turn ${i}`, replyTo: previous });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    previous = sentId(sent.body);
  }
  await settle();
  assert.deepEqual(wokenFor(deliveries, previous), [a.id], "the 20th agent message still wakes the chain");
  const over = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: `@${b.name} again`, replyTo: previous });
  await settle();
  assert.deepEqual(wokenFor(deliveries, sentId(over.body)), [], "the 21st wakes no agent, even by @mention");
  const notices = await getDb().select().from(messages).where(and(eq(messages.channelId, channel.id), eq(messages.systemSubtype, "reply_mode.loop_paused")));
  assert.equal(notices.length, 1, "the people in the chain are told once");
  assert.match(notices[0]!.content, new RegExp(`@${owner.name}`));

  // A person speaking in the chain resets it.
  const human = await humanSend(app, channel.id, owner.id, "carry on", { replyToMessageId: sentId(over.body), taskIds: [] });
  const resumed = await agentSend(app.baseUrl, b.key, { target: `#${channel.name}`, content: "ok", replyTo: human });
  await settle();
  assert.deepEqual(wokenFor(deliveries, sentId(resumed.body)), [a.id]);
});

test("reply mode without task v2: task create with a source message links it instead of refusing", async ({ app }) => {
  installRecordingOrchestrator(app.app);
  const { owner, channel, a } = await setup("rm-create");
  const ask = await humanSend(app, channel.id, owner.id, "Please fix the deploy script");

  // Off: refused as before (no task v2 here).
  const refused = await agentCall(app.baseUrl, a.key, "POST", "tasks", {
    channel: `#${channel.name}`, tasks: [{ title: "Fix deploy script", source_message_id: ask.slice(0, 8) }],
  });
  assert.equal(refused.status, 403, JSON.stringify(refused.body));
  assert.equal(refused.body.code, "task_v2_not_enabled");

  // On: created, and the source message is linked to it.
  await updateChannel(channel.id, { replyMode: true });
  const created = await agentCall(app.baseUrl, a.key, "POST", "tasks", {
    channel: `#${channel.name}`, tasks: [{ title: "Fix deploy script", source_message_id: ask.slice(0, 8) }], assignee: `@${a.name}`,
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const [envelope] = created.body.tasks as Array<{ taskNumber: number; linkedMessageId?: string }>;
  assert.equal(envelope!.linkedMessageId, ask);
  const [task] = await getDb().select().from(tasks).where(and(eq(tasks.channelId, channel.id), eq(tasks.taskNumber, envelope!.taskNumber)));
  const links = await getDb().select().from(messageTasks).where(eq(messageTasks.messageId, ask));
  assert.deepEqual(links.map((l) => l.taskId), [task!.id]);
  const events = await getDb().select().from(taskEvents).where(eq(taskEvents.taskId, task!.id));
  assert.ok(events.some((e) => e.eventType === "message_linked"));
  // The task dialog's footer counts it; history names it by author and first line.
  assert.deepEqual(await taskLinkedMessageSummary(task!.id), { count: 1, latestMessageId: ask });
  const history = await listTaskHistory(task!.id);
  assert.ok(Array.isArray(history));
  const linkedEvent = history.find((e) => e.eventType === "message_linked");
  assert.equal((linkedEvent!.payload.message as { excerpt: string }).excerpt, "Please fix the deploy script");

  // A reply to the source inherits the new task.
  const reply = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "On it", replyTo: ask.slice(0, 8) });
  assert.equal(reply.status, 200, JSON.stringify(reply.body));
  const replyLinks = await getDb().select().from(messageTasks).where(eq(messageTasks.messageId, sentId(reply.body)));
  assert.deepEqual(replyLinks.map((l) => l.taskId), [task!.id]);
});

test("reply mode views: task, reply chain and mine, with hidden gaps and counts", async ({ app }) => {
  installRecordingOrchestrator(app.app);
  const { readReplyModeViewPage } = await import("../services/replyModeViewService");
  const { owner, channel, a } = await setup("rm-view");
  await updateChannel(channel.id, { replyMode: true });
  const [task] = await getDb().insert(tasks).values({
    channelId: channel.id, taskNumber: 1, title: "Fix deploy", status: "in_progress",
    createdByType: "agent", createdById: a.id,
  }).returning();

  const m1 = await humanSend(app, channel.id, owner.id, "root question");                       // mine
  const noise1 = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "noise 1" });
  const m2 = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "answer", replyTo: m1 }); // reply to me
  const noise2 = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "noise 2" });
  const t1 = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "task progress", tasks: [1] });
  const m3 = await agentSend(app.baseUrl, a.key, { target: `#${channel.name}`, content: "follow-up", replyTo: sentId(m2.body) });
  await settle();
  const ids = { noise1: sentId(noise1.body), m2: sentId(m2.body), noise2: sentId(noise2.body), t1: sentId(t1.body), m3: sentId(m3.body) };

  // Task view: only the linked message; everything before it is hidden.
  const byTask = await readReplyModeViewPage({ channelId: channel.id, userId: owner.id, view: { kind: "task", taskNumber: 1 }, limit: 50 });
  assert.deepEqual(byTask.messageIds, [ids.t1]);
  assert.equal(byTask.total, 1);
  assert.equal(byTask.hiddenBefore[ids.t1], 4);

  // Chain view from the middle: root, reply, reply-to-reply; gaps between them.
  const chain = await readReplyModeViewPage({ channelId: channel.id, userId: owner.id, view: { kind: "chain", messageId: ids.m2 }, limit: 50, sinceSeq: 0 });
  assert.deepEqual(chain.messageIds, [m1, ids.m2, ids.m3]);
  assert.deepEqual([chain.hiddenBefore[m1], chain.hiddenBefore[ids.m2], chain.hiddenBefore[ids.m3]], [0, 1, 2]);
  assert.equal(chain.newOutside, 3, "noise 1, noise 2, task progress");

  // Mine: what I sent, the reply to me, and the reply further down my chain
  // (Activity tells me of it too); not the task (I don't take part yet).
  const mine = await readReplyModeViewPage({ channelId: channel.id, userId: owner.id, view: { kind: "mine" }, limit: 50 });
  assert.deepEqual(mine.messageIds, [m1, ids.m2, ids.m3]);
  // Once I write in the task, its messages are mine too.
  await humanSend(app, channel.id, owner.id, "on it", { replyToMessageId: null, taskIds: [task!.id] });
  await settle();
  const mine2 = await readReplyModeViewPage({ channelId: channel.id, userId: owner.id, view: { kind: "mine" }, limit: 50 });
  assert.ok(mine2.messageIds.includes(ids.t1));

  // Paging: newest first, `hasMore` when older ones are left.
  const page = await readReplyModeViewPage({ channelId: channel.id, userId: owner.id, view: { kind: "chain", messageId: m1 }, limit: 2 });
  assert.deepEqual(page.messageIds, [ids.m2, ids.m3]);
  assert.equal(page.hasMore, true);

  // Hidden unread from the read position through m3, outside the chain view,
  // not my own. (Sending moved my read position: put it back to the start.)
  await getDb().update(userChannelReadCursors).set({ lastReadSeq: 0 })
    .where(and(eq(userChannelReadCursors.userId, owner.id), eq(userChannelReadCursors.channelId, channel.id)));
  const fromInbox = await readReplyModeViewPage({ channelId: channel.id, userId: owner.id, view: { kind: "chain", messageId: ids.m3 }, limit: 50, readThroughSeq: Number.MAX_SAFE_INTEGER });
  assert.equal(fromInbox.hiddenUnread?.count, 3);
});
