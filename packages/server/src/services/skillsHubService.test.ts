import { dbTest as test } from "../test/integration/dbTest";
import { closeTestDatabase } from "../test/integration/database";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db/index";
import { agents, serverMembers, servers, users } from "../db/schema";
import {
  buildSkillsHubLaunchProjection,
  createSkillsHubItem,
  deleteSkillsHubItem,
  getAgentSkillsHubCatalog,
  SkillsHubError,
  updateSkillsHubItem,
  writeAgentSkillsHubConfig,
} from "./skillsHubService";

afterEach(async () => {
  await closeTestDatabase();
});

async function seed() {
  const db = getDb();
  const slug = `hub-${randomUUID().slice(0, 8)}`;
  const [owner] = await db.insert(users).values({
    email: `${slug}@example.com`,
    name: `Hub ${slug}`,
    passwordHash: "hash",
    emailVerified: true,
  }).returning();
  const [server] = await db.insert(servers).values({ name: "Hub", slug, ownerId: owner!.id }).returning();
  await db.insert(serverMembers).values({ serverId: server!.id, userId: owner!.id, role: "owner" });
  const [agent] = await db.insert(agents).values({
    serverId: server!.id,
    name: "hub-agent",
    status: "inactive",
    runtime: "claude",
    model: "sonnet",
  }).returning();
  return { userId: owner!.id, serverId: server!.id, agentId: agent!.id };
}

test("skills hub: items are enabled per agent and shipped on launch", async ({ db: _db }) => {
  const { userId, serverId, agentId } = await seed();
  const skill = await createSkillsHubItem({
    serverId, userId, kind: "skill", name: "review", description: "Code review",
    content: "---\nname: review\n---\nReview code.", marketplaceSource: null,
  });
  const plugin = await createSkillsHubItem({
    serverId, userId, kind: "plugin", name: "figma@claude-plugins", description: null, content: null,
    marketplaceSource: { source: "github", repo: "anthropics/claude-plugins" },
  });

  const empty = await buildSkillsHubLaunchProjection(serverId, agentId);
  assert.deepEqual(empty, { skills: [], plugins: [], useHostSkills: true });

  assert.equal(await writeAgentSkillsHubConfig({ serverId, userId, agentId, enabledItemIds: [skill.id, plugin.id], useHostSkills: false }), true);
  const catalog = await getAgentSkillsHubCatalog(serverId, agentId);
  assert.equal(catalog.useHostSkills, false);
  assert.deepEqual(catalog.items.map((item) => [item.name, item.enabled]).sort(), [["figma@claude-plugins", true], ["review", true]]);

  assert.deepEqual(await buildSkillsHubLaunchProjection(serverId, agentId), {
    skills: [{ name: "review", content: "---\nname: review\n---\nReview code." }],
    plugins: [{ name: "figma@claude-plugins", marketplaceSource: { source: "github", repo: "anthropics/claude-plugins" } }],
    useHostSkills: false,
  });

  // Writing the same config again is not a change (no needless restart).
  assert.equal(await writeAgentSkillsHubConfig({ serverId, userId, agentId, enabledItemIds: [plugin.id, skill.id], useHostSkills: false }), false);

  await updateSkillsHubItem({ serverId, userId, itemId: skill.id, content: "v2" });
  assert.equal((await buildSkillsHubLaunchProjection(serverId, agentId)).skills[0]?.content, "v2");

  assert.deepEqual(await deleteSkillsHubItem(serverId, skill.id), [agentId]);
  assert.deepEqual((await buildSkillsHubLaunchProjection(serverId, agentId)).skills, []);
});

test("skills hub: names are validated and unique per kind", async ({ db: _db }) => {
  const { userId, serverId, agentId } = await seed();
  await assert.rejects(
    createSkillsHubItem({ serverId, userId, kind: "skill", name: "../evil", description: null, content: "x", marketplaceSource: null }),
    (error: unknown) => error instanceof SkillsHubError && error.code === "skills_hub_invalid",
  );
  await assert.rejects(
    createSkillsHubItem({ serverId, userId, kind: "plugin", name: "no-marketplace", description: null, content: null, marketplaceSource: null }),
    (error: unknown) => error instanceof SkillsHubError && error.code === "skills_hub_invalid",
  );
  await createSkillsHubItem({ serverId, userId, kind: "skill", name: "dup", description: null, content: "x", marketplaceSource: null });
  await assert.rejects(
    createSkillsHubItem({ serverId, userId, kind: "skill", name: "dup", description: null, content: "y", marketplaceSource: null }),
    (error: unknown) => error instanceof SkillsHubError && error.code === "skills_hub_name_taken",
  );
  await assert.rejects(
    writeAgentSkillsHubConfig({ serverId, userId, agentId, enabledItemIds: [randomUUID()] }),
    (error: unknown) => error instanceof SkillsHubError && error.code === "skills_hub_item_not_found",
  );
});

test("skills hub: another server's items cannot be enabled", async ({ db: _db }) => {
  const a = await seed();
  const b = await seed();
  const foreign = await createSkillsHubItem({
    serverId: b.serverId, userId: b.userId, kind: "skill", name: "theirs", description: null, content: "x", marketplaceSource: null,
  });
  await assert.rejects(
    writeAgentSkillsHubConfig({ serverId: a.serverId, userId: a.userId, agentId: a.agentId, enabledItemIds: [foreign.id] }),
    (error: unknown) => error instanceof SkillsHubError && error.code === "skills_hub_item_not_found",
  );
});
