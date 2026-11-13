import { and, asc, eq, inArray } from "drizzle-orm";
import {
  SKILLS_HUB_MAX_CONTENT_BYTES,
  SKILLS_HUB_PLUGIN_NAME_PATTERN,
  SKILLS_HUB_SKILL_NAME_PATTERN,
  type SkillsHubAgentCatalogResponse,
  type SkillsHubCatalogResponse,
  type SkillsHubItemKind,
  type SkillsHubItemView,
  type SkillsHubLaunchProjection,
  type SkillsHubMarketplaceSource,
} from "@botiverse/raft-shared";
import { getDb, type DatabaseExecutor } from "../db/index";
import { agents, skillsHubAgentSettings, skillsHubAssignments, skillsHubItems } from "../db/schema";

export class SkillsHubError extends Error {
  constructor(
    message: string,
    readonly code:
      | "skills_hub_invalid"
      | "skills_hub_item_not_found"
      | "skills_hub_agent_not_found"
      | "skills_hub_name_taken",
  ) {
    super(message);
    this.name = "SkillsHubError";
  }
}

type ItemRow = typeof skillsHubItems.$inferSelect;

function toView(row: ItemRow): SkillsHubItemView {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    content: row.kind === "skill" ? row.content ?? "" : null,
    marketplaceSource: row.kind === "plugin" ? row.marketplaceSource ?? null : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function validateSkillsHubName(kind: SkillsHubItemKind, name: string): string {
  const trimmed = name.trim();
  const pattern = kind === "skill" ? SKILLS_HUB_SKILL_NAME_PATTERN : SKILLS_HUB_PLUGIN_NAME_PATTERN;
  if (!pattern.test(trimmed)) {
    throw new SkillsHubError(
      kind === "skill"
        ? "Skill name must be 1-64 chars of lowercase letters, digits, '.', '_' or '-'"
        : "Plugin name must look like <plugin>@<marketplace>",
      "skills_hub_invalid",
    );
  }
  return trimmed;
}

export function validateSkillsHubContent(content: string): string {
  if (Buffer.byteLength(content, "utf8") > SKILLS_HUB_MAX_CONTENT_BYTES) {
    throw new SkillsHubError(`SKILL.md must be at most ${SKILLS_HUB_MAX_CONTENT_BYTES} bytes`, "skills_hub_invalid");
  }
  if (!content.trim()) throw new SkillsHubError("SKILL.md content is required", "skills_hub_invalid");
  return content;
}

export function validateMarketplaceSource(value: unknown): SkillsHubMarketplaceSource | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new SkillsHubError("marketplaceSource must be an object", "skills_hub_invalid");
  }
  const v = value as Record<string, unknown>;
  if (v.source === "github" && typeof v.repo === "string" && /^[\w.-]+\/[\w.-]+$/.test(v.repo.trim())) {
    return { source: "github", repo: v.repo.trim() };
  }
  if (v.source === "git" && typeof v.url === "string" && /^(https:\/\/|git@)\S+$/.test(v.url.trim())) {
    return { source: "git", url: v.url.trim() };
  }
  throw new SkillsHubError("marketplaceSource must be {source:'github',repo:'owner/name'} or {source:'git',url}", "skills_hub_invalid");
}

/** Postgres unique_violation; drizzle wraps the driver error in `cause`. */
function isUniqueViolation(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && typeof current === "object" && depth < 4; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function listSkillsHubItems(serverId: string, db: DatabaseExecutor = getDb()): Promise<SkillsHubCatalogResponse> {
  const rows = await db.select().from(skillsHubItems)
    .where(eq(skillsHubItems.serverId, serverId))
    .orderBy(asc(skillsHubItems.kind), asc(skillsHubItems.name));
  return { items: rows.map(toView) };
}

export async function createSkillsHubItem(input: {
  serverId: string;
  userId: string;
  kind: SkillsHubItemKind;
  name: string;
  description: string | null;
  content: string | null;
  marketplaceSource: SkillsHubMarketplaceSource | null;
}, db: DatabaseExecutor = getDb()): Promise<SkillsHubItemView> {
  const name = validateSkillsHubName(input.kind, input.name);
  const content = input.kind === "skill" ? validateSkillsHubContent(input.content ?? "") : null;
  try {
    const [row] = await db.insert(skillsHubItems).values({
      serverId: input.serverId,
      kind: input.kind,
      name,
      description: input.description,
      content,
      marketplaceSource: input.kind === "plugin" ? input.marketplaceSource : null,
      createdByUserId: input.userId,
      updatedByUserId: input.userId,
    }).returning();
    return toView(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw new SkillsHubError(`A ${input.kind} named "${name}" already exists`, "skills_hub_name_taken");
    throw error;
  }
}

export async function updateSkillsHubItem(input: {
  serverId: string;
  userId: string;
  itemId: string;
  name?: string;
  description?: string | null;
  content?: string;
  marketplaceSource?: SkillsHubMarketplaceSource | null;
}, db: DatabaseExecutor = getDb()): Promise<SkillsHubItemView> {
  const [current] = await db.select().from(skillsHubItems)
    .where(and(eq(skillsHubItems.id, input.itemId), eq(skillsHubItems.serverId, input.serverId)));
  if (!current) throw new SkillsHubError("Skills Hub item not found", "skills_hub_item_not_found");
  const patch: Partial<typeof skillsHubItems.$inferInsert> = { updatedByUserId: input.userId, updatedAt: new Date() };
  if (input.name !== undefined) patch.name = validateSkillsHubName(current.kind, input.name);
  if (input.description !== undefined) patch.description = input.description;
  if (input.content !== undefined && current.kind === "skill") patch.content = validateSkillsHubContent(input.content);
  if (input.marketplaceSource !== undefined && current.kind === "plugin") patch.marketplaceSource = input.marketplaceSource;
  try {
    const [row] = await db.update(skillsHubItems).set(patch)
      .where(and(eq(skillsHubItems.id, input.itemId), eq(skillsHubItems.serverId, input.serverId)))
      .returning();
    return toView(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw new SkillsHubError(`A ${current.kind} with that name already exists`, "skills_hub_name_taken");
    throw error;
  }
}

/** Deletes the item and returns the agents that had it enabled (to restart). */
export async function deleteSkillsHubItem(serverId: string, itemId: string, db: DatabaseExecutor = getDb()): Promise<string[]> {
  const affected = await db.select({ agentId: skillsHubAssignments.agentId }).from(skillsHubAssignments)
    .where(and(eq(skillsHubAssignments.itemId, itemId), eq(skillsHubAssignments.serverId, serverId)));
  const deleted = await db.delete(skillsHubItems)
    .where(and(eq(skillsHubItems.id, itemId), eq(skillsHubItems.serverId, serverId)))
    .returning({ id: skillsHubItems.id });
  if (deleted.length === 0) throw new SkillsHubError("Skills Hub item not found", "skills_hub_item_not_found");
  return affected.map((row) => row.agentId);
}

/** Agents that currently have the item enabled. */
export async function listSkillsHubItemAgents(serverId: string, itemId: string, db: DatabaseExecutor = getDb()): Promise<string[]> {
  const rows = await db.select({ agentId: skillsHubAssignments.agentId }).from(skillsHubAssignments)
    .where(and(eq(skillsHubAssignments.itemId, itemId), eq(skillsHubAssignments.serverId, serverId)));
  return rows.map((row) => row.agentId);
}

async function requireAgent(serverId: string, agentId: string, db: DatabaseExecutor): Promise<void> {
  const [agent] = await db.select({ id: agents.id }).from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.serverId, serverId)));
  if (!agent) throw new SkillsHubError("Agent not found", "skills_hub_agent_not_found");
}

async function readUseHostSkills(agentId: string, db: DatabaseExecutor): Promise<boolean> {
  const [row] = await db.select({ useHostSkills: skillsHubAgentSettings.useHostSkills })
    .from(skillsHubAgentSettings)
    .where(eq(skillsHubAgentSettings.agentId, agentId));
  return row?.useHostSkills ?? true;
}

export async function getAgentSkillsHubCatalog(serverId: string, agentId: string, db: DatabaseExecutor = getDb()): Promise<SkillsHubAgentCatalogResponse> {
  await requireAgent(serverId, agentId, db);
  const [{ items }, enabledRows, useHostSkills] = await Promise.all([
    listSkillsHubItems(serverId, db),
    db.select({ itemId: skillsHubAssignments.itemId }).from(skillsHubAssignments)
      .where(and(eq(skillsHubAssignments.serverId, serverId), eq(skillsHubAssignments.agentId, agentId))),
    readUseHostSkills(agentId, db),
  ]);
  const enabled = new Set(enabledRows.map((row) => row.itemId));
  return {
    items: items.map((item) => ({ ...item, enabled: enabled.has(item.id) })),
    useHostSkills,
  };
}

/**
 * Replace the agent's hub configuration: the exact set of enabled item ids
 * and, when given, the host-skills switch. Returns true when anything changed.
 */
export async function writeAgentSkillsHubConfig(input: {
  serverId: string;
  userId: string;
  agentId: string;
  enabledItemIds: string[];
  useHostSkills?: boolean;
}, db: DatabaseExecutor = getDb()): Promise<boolean> {
  await requireAgent(input.serverId, input.agentId, db);
  const wanted = [...new Set(input.enabledItemIds)];
  if (wanted.length > 0) {
    const known = await db.select({ id: skillsHubItems.id }).from(skillsHubItems)
      .where(and(eq(skillsHubItems.serverId, input.serverId), inArray(skillsHubItems.id, wanted)));
    if (known.length !== wanted.length) throw new SkillsHubError("Unknown Skills Hub item", "skills_hub_item_not_found");
  }
  const currentRows = await db.select({ itemId: skillsHubAssignments.itemId }).from(skillsHubAssignments)
    .where(and(eq(skillsHubAssignments.serverId, input.serverId), eq(skillsHubAssignments.agentId, input.agentId)));
  const current = new Set(currentRows.map((row) => row.itemId));
  const wantedSet = new Set(wanted);
  const toRemove = [...current].filter((id) => !wantedSet.has(id));
  const toAdd = wanted.filter((id) => !current.has(id));
  let changed = false;
  if (toRemove.length > 0) {
    await db.delete(skillsHubAssignments).where(and(
      eq(skillsHubAssignments.agentId, input.agentId),
      inArray(skillsHubAssignments.itemId, toRemove),
    ));
    changed = true;
  }
  if (toAdd.length > 0) {
    await db.insert(skillsHubAssignments).values(toAdd.map((itemId) => ({
      serverId: input.serverId,
      agentId: input.agentId,
      itemId,
      updatedByUserId: input.userId,
    }))).onConflictDoNothing();
    changed = true;
  }
  if (input.useHostSkills !== undefined && input.useHostSkills !== await readUseHostSkills(input.agentId, db)) {
    await db.insert(skillsHubAgentSettings).values({
      agentId: input.agentId,
      serverId: input.serverId,
      useHostSkills: input.useHostSkills,
      updatedByUserId: input.userId,
    }).onConflictDoUpdate({
      target: skillsHubAgentSettings.agentId,
      set: { useHostSkills: input.useHostSkills, updatedByUserId: input.userId, updatedAt: new Date() },
    });
    changed = true;
  }
  return changed;
}

/** The agent's enabled hub items, shaped for agent:start. */
export async function buildSkillsHubLaunchProjection(serverId: string, agentId: string, db: DatabaseExecutor = getDb()): Promise<SkillsHubLaunchProjection> {
  const [rows, useHostSkills] = await Promise.all([
    db.select({ item: skillsHubItems }).from(skillsHubAssignments)
      .innerJoin(skillsHubItems, eq(skillsHubItems.id, skillsHubAssignments.itemId))
      .where(and(eq(skillsHubAssignments.serverId, serverId), eq(skillsHubAssignments.agentId, agentId)))
      .orderBy(asc(skillsHubItems.name)),
    readUseHostSkills(agentId, db),
  ]);
  const projection: SkillsHubLaunchProjection = { skills: [], plugins: [], useHostSkills };
  for (const { item } of rows) {
    if (item.kind === "skill") {
      projection.skills.push({ name: item.name, content: item.content ?? "" });
    } else {
      projection.plugins.push({ name: item.name, marketplaceSource: item.marketplaceSource ?? null });
    }
  }
  return projection;
}
