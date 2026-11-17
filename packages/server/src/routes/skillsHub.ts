import { DAEMON_CAPABILITY_SKILLS_HUB_CONFIG_PUSH, type ServerCapability, type SkillsHubItemKind } from "@botiverse/raft-shared";
import { Router, type NextFunction, type Request, type Response, type Router as RouterType } from "express";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { agents } from "../db/schema";
import { actorHasServerCapabilityInServer, getActorServerRoleInServer, userCanActOnAgentResource } from "../lib/actorPermissions";
import { guardUuidPathParams } from "../lib/uuidPathParams";
import { bumpAgentConfigRevision } from "../services/agentConfigRevision";
import type { AgentOrchestrator } from "../services/agentOrchestrator";
import { scanGithubMarketplace } from "../services/skillsHubGithub";
import {
  createSkillsHubItem,
  skillsHubSkillIdsByName,
  deleteSkillsHubItem,
  getAgentSkillsHubCatalog,
  listSkillsHubItemAgents,
  listSkillsHubItems,
  SkillsHubError,
  updateSkillsHubItem,
  validateMarketplaceSource,
  writeAgentSkillsHubConfig,
} from "../services/skillsHubService";

export const skillsHubRouter: RouterType = Router();
guardUuidPathParams(skillsHubRouter, { agentId: "Agent", itemId: "Skills Hub item" });

function body(req: Request): Record<string, unknown> {
  return typeof req.body === "object" && req.body !== null && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
}

function pathParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value;
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new SkillsHubError(`${field} must be a non-empty string of at most ${max} characters`, "skills_hub_invalid");
  }
  return value;
}

function optionalNullableString(value: unknown, field: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.length > max) {
    throw new SkillsHubError(`${field} must be a string of at most ${max} characters`, "skills_hub_invalid");
  }
  return value.trim() || null;
}

function requiredKind(value: unknown): SkillsHubItemKind {
  if (value === "skill" || value === "plugin") return value;
  throw new SkillsHubError("kind must be 'skill' or 'plugin'", "skills_hub_invalid");
}

function sendSkillsHubError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof SkillsHubError) {
    const status = error.code.endsWith("not_found") ? 404
      : error.code === "skills_hub_name_taken" ? 409
      : error.code === "skills_hub_github_unavailable" ? 502
      : 400;
    res.status(status).json({ error: error.message, code: error.code });
    return;
  }
  next(error);
}

function requireCapability(capability: ServerCapability) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!await actorHasServerCapabilityInServer(req.serverId!, "user", req.userId!, capability)) {
        res.status(403).json({ error: `${capability} capability required`, code: "skills_hub_forbidden" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireAgentCapabilityOrCreator(capability: ServerCapability) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = pathParam(req.params.agentId);
      const [agent] = await getDb()
        .select({ creatorType: agents.creatorType, creatorId: agents.creatorId, assistantOwnerUserId: agents.assistantOwnerUserId })
        .from(agents)
        .where(and(eq(agents.id, agentId), eq(agents.serverId, req.serverId!)));
      const callerRole = await getActorServerRoleInServer(req.serverId!, "user", req.userId!);
      if (!agent || !userCanActOnAgentResource(callerRole, req.userId!, agent, capability)) {
        res.status(403).json({ error: `${capability} capability or agent creator authority required`, code: "skills_hub_forbidden" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Running agents pick up hub changes on their next launch; restart them now. */
/**
 * The agents restart on their new skills and plugins. A Computer that compares
 * the Skills Hub in its runtime spec takes the config push and restarts the
 * agent once idle; any other one (or an agent whose Computer is not connected
 * here) is restarted at once, as before.
 */
async function restartAgents(req: Request, agentIds: string[]): Promise<void> {
  const orchestrator = req.app.get("agentOrchestrator") as AgentOrchestrator | undefined;
  if (!orchestrator) return;
  for (const agentId of new Set(agentIds)) {
    try {
      const [agent] = await getDb().select({ machineId: agents.machineId }).from(agents).where(eq(agents.id, agentId)).limit(1);
      if (agent && orchestrator.hasMachineCapability(agent.machineId, DAEMON_CAPABILITY_SKILLS_HUB_CONFIG_PUSH)) {
        await bumpAgentConfigRevision(getDb(), [agentId]);
        if (await orchestrator.applyAgentConfig(agentId) === "pushed") continue;
      }
      await orchestrator.resetAgent(agentId, "restart", { restartIfStopped: false });
    } catch (error) {
      console.warn(`[skills-hub] restart of agent ${agentId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

skillsHubRouter.get("/items", async (req, res, next) => {
  try {
    res.json(await listSkillsHubItems(req.serverId!));
  } catch (error) {
    sendSkillsHubError(error, res, next);
  }
});

skillsHubRouter.post("/items", requireCapability("manageIntegrations"), async (req, res, next) => {
  try {
    const input = body(req);
    const kind = requiredKind(input.kind);
    // Adding skills is off (anxndsgn, 2026-11-17): only plugins can be added.
    if (kind === "skill") throw new SkillsHubError("Adding skills is turned off; only plugins can be added", "skills_hub_invalid");
    res.status(201).json(await createSkillsHubItem({
      serverId: req.serverId!,
      userId: req.userId!,
      kind,
      name: requiredString(input.name, "name", 201),
      description: optionalNullableString(input.description, "description", 2_000) ?? null,
      content: null,
      marketplaceSource: kind === "plugin" ? validateMarketplaceSource(input.marketplaceSource) : null,
    }));
  } catch (error) {
    sendSkillsHubError(error, res, next);
  }
});

skillsHubRouter.patch("/items/:itemId", requireCapability("manageIntegrations"), async (req, res, next) => {
  try {
    const input = body(req);
    const itemId = pathParam(req.params.itemId);
    const view = await updateSkillsHubItem({
      serverId: req.serverId!,
      userId: req.userId!,
      itemId,
      ...(input.name !== undefined ? { name: requiredString(input.name, "name", 201) } : {}),
      ...(input.description !== undefined ? { description: optionalNullableString(input.description, "description", 2_000) ?? null } : {}),
      ...(input.content !== undefined ? { content: requiredString(input.content, "content", 300_000) } : {}),
      ...(input.marketplaceSource !== undefined ? { marketplaceSource: validateMarketplaceSource(input.marketplaceSource) } : {}),
    });
    res.json(view);
    await restartAgents(req, await listSkillsHubItemAgents(req.serverId!, itemId));
  } catch (error) {
    sendSkillsHubError(error, res, next);
  }
});

skillsHubRouter.delete("/items/:itemId", requireCapability("manageIntegrations"), async (req, res, next) => {
  try {
    const affected = await deleteSkillsHubItem(req.serverId!, pathParam(req.params.itemId));
    res.status(204).end();
    await restartAgents(req, affected);
  } catch (error) {
    sendSkillsHubError(error, res, next);
  }
});

skillsHubRouter.get("/agents/:agentId", requireAgentCapabilityOrCreator("editAgents"), async (req, res, next) => {
  try {
    res.json(await getAgentSkillsHubCatalog(req.serverId!, pathParam(req.params.agentId)));
  } catch (error) {
    sendSkillsHubError(error, res, next);
  }
});

skillsHubRouter.put("/agents/:agentId", requireAgentCapabilityOrCreator("editAgents"), async (req, res, next) => {
  try {
    const input = body(req);
    const agentId = pathParam(req.params.agentId);
    if (!Array.isArray(input.enabledItemIds) || !input.enabledItemIds.every((id) => typeof id === "string")) {
      throw new SkillsHubError("enabledItemIds must be an array of item ids", "skills_hub_invalid");
    }
    if (input.useHostSkills !== undefined && typeof input.useHostSkills !== "boolean") {
      throw new SkillsHubError("useHostSkills must be a boolean", "skills_hub_invalid");
    }
    const changed = await getDb().transaction((tx) => writeAgentSkillsHubConfig({
      serverId: req.serverId!,
      userId: req.userId!,
      agentId,
      enabledItemIds: input.enabledItemIds as string[],
      ...(typeof input.useHostSkills === "boolean" ? { useHostSkills: input.useHostSkills } : {}),
    }, tx));
    res.json(await getAgentSkillsHubCatalog(req.serverId!, agentId));
    if (changed) await restartAgents(req, [agentId]);
  } catch (error) {
    sendSkillsHubError(error, res, next);
  }
});

/** List the plugins of the marketplace at a GitHub address (nothing is saved). */
skillsHubRouter.post("/plugins/scan", requireCapability("manageIntegrations"), async (req, res, next) => {
  try {
    const url = requiredString(body(req).url, "url", 1_000);
    const [{ ref, marketplace }, existing] = await Promise.all([
      scanGithubMarketplace(url),
      skillsHubSkillIdsByName(req.serverId!, undefined, "plugin"),
    ]);
    res.json({
      repo: `${ref.owner}/${ref.repo}`,
      ref: ref.ref,
      commitSha: ref.commitSha,
      marketplace: marketplace.name,
      plugins: marketplace.plugins.map((plugin) => {
        const id = `${plugin.name}@${marketplace.name}`;
        return { ...plugin, id, existingItemId: existing.get(id) ?? null };
      }),
    });
  } catch (error) {
    sendSkillsHubError(error, res, next);
  }
});
