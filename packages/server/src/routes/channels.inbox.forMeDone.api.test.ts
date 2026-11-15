/**
 * For me (task #10 item 7): a conversation's replies and @s leave For me once handled there (opened, Done, Done
 * all), apart from the read position; a later @ brings the row back; All still lists it.
 */
import assert from "node:assert/strict";

import { tokenForHuman } from "../test/integration/credentials";
import { createApiTest } from "../test/integration/apiTest";
import { getDb } from "../db/index";
import { messageMentions } from "../db/schema";
import { addMember } from "../services/serverService";
import { addHuman, createChannel, type InboxItem } from "../services/channelService";
import { createMessage } from "../services/messageService";
import { createServer, headers, seedUser } from "./channels.api.fixtures";

const test = createApiTest({ humanActivityMuteFlagDefaultEnabled: true });

type InboxResponse = { items: InboxItem[]; totalCount: number };

test("For me: a handled conversation leaves For me until the next @, and stays in All", async ({ app }) => {
  const owner = await seedUser("for-me-owner@slock.test", "for-me-owner");
  const peer = await seedUser("for-me-peer@slock.test", "for-me-peer");
  const server = await createServer("For Me Server", "for-me-server", owner.id);
  await addMember(server.id, peer.id);
  const channel = await createChannel(server.id, "for-me-room");
  await addHuman(channel.id, owner.id);
  await addHuman(channel.id, peer.id);
  const mention = async (content: string) => {
    const message = await createMessage(channel.id, "user", peer.id, content);
    await getDb().insert(messageMentions).values({
      messageId: message.id, messageSeq: message.seq, serverId: server.id, channelId: channel.id,
      targetType: "user", targetId: owner.id, handleAtSendTime: owner.name, notifiedAt: new Date(),
    });
    return message;
  };
  await mention("@for-me-owner have a look");

  const token = await tokenForHuman(owner.email);
  const inbox = async (filter: string): Promise<InboxResponse> => {
    const res = await fetch(`${app.baseUrl}/api/channels/inbox?filter=${filter}&limit=30&offset=0`, { headers: headers(token, server.id) });
    assert.equal(res.status, 200, await res.clone().text());
    return await res.json() as InboxResponse;
  };
  const listed = (body: InboxResponse) => body.items.some((item) => item.kind === "channel" && item.channelId === channel.id);
  const done = async (keys: unknown) => fetch(`${app.baseUrl}/api/channels/inbox/for-me/done`, {
    method: "POST",
    headers: { ...headers(token, server.id), "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  });

  assert.ok(listed(await inbox("unread_mentions")), "the @ waits in For me");

  const marked = await done([`conv:${channel.id}`]);
  assert.equal(marked.status, 200, await marked.clone().text());
  const forMe = await inbox("unread_mentions");
  assert.ok(!listed(forMe), "handled: out of For me");
  assert.ok(listed(await inbox("all")), "still in All");

  await mention("@for-me-owner one more thing");
  assert.ok(listed(await inbox("unread_mentions")), "a later @ brings it back");

  assert.equal((await done(["nope"])).status, 400);
  assert.equal((await done([])).status, 400);

  // Tasks, reviews and questions: listed back for the web to leave out.
  const taskKey = `task:${channel.id}`;
  assert.equal((await done([taskKey])).status, 200);
  const list = await fetch(`${app.baseUrl}/api/channels/inbox/for-me/done`, { headers: headers(token, server.id) });
  const body = await list.json() as { items: Array<{ itemKey: string }> };
  assert.deepEqual(body.items.map((item) => item.itemKey), [taskKey]);
  const questions = await fetch(`${app.baseUrl}/api/channels/inbox/for-me/questions`, { headers: headers(token, server.id) });
  assert.equal(questions.status, 200);
  assert.deepEqual((await questions.json() as { items: unknown[] }).items, []);
});
