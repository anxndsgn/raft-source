// `raft message retag <msgId> --add <n> --remove <n> | --none`
// → POST /internal/agent-api/messages/:msgId/tasks
//
// Reply mode: link a channel message to tasks of its channel, or unlink it.

import type { Command } from "commander";

import { asMessageId } from "@botiverse/raft-shared/src/agentCliSurface";
import { createAgentApiSurfaceClient } from "../../agentApiPath";
import { defineCommand, registerCliCommand } from "../../core/command";
import type { CommandRuntimeOptions } from "../../core/context";
import { rateLimitedResponseError } from "../../core/apiFailure";
import { cliError } from "../../core/errors";
import { writeText, adoptCliReplyText } from "../../core/renderer";

interface RetagOpts {
  add?: string[];
  remove?: string[];
  none?: boolean;
}

function parseTaskNumbers(flag: string, values: string[] | undefined): number[] {
  const numbers: number[] = [];
  for (const raw of values ?? []) {
    for (const part of raw.split(/[\s,]+/).filter(Boolean)) {
      const n = Number(part.replace(/^#/, ""));
      if (!Number.isInteger(n) || n <= 0) throw cliError("INVALID_TASK_NUMBER", `${flag} expects a task number like 3 or #3, got "${part}".`);
      if (!numbers.includes(n)) numbers.push(n);
    }
  }
  return numbers;
}

export const messageRetagCommand = defineCommand(
  {
    name: "retag",
    description: "Link a message to tasks of its channel, or unlink it (channels that use replies)",
    arguments: ["<msgId>"],
    options: [
      { flags: "--add <task>", description: "Link the message to this task number (repeatable)", parse: (value: string, prev: string[] = []) => prev.concat(value) },
      { flags: "--remove <task>", description: "Unlink the message from this task number (repeatable)", parse: (value: string, prev: string[] = []) => prev.concat(value) },
      { flags: "--none", description: "Unlink the message from every task" },
    ],
    helpAfter:
      "\nWhen you take on a person's message that is new work, link it to its task: an existing one with --add, or create the task first (raft task create).\n",
  },
  async (ctx, msgId: string, opts: RetagOpts) => {
    if (!msgId?.trim()) throw cliError("INVALID_ARG", "A message id is required: raft message retag <msgId> --add <task>");
    const add = parseTaskNumbers("--add", opts.add);
    const remove = parseTaskNumbers("--remove", opts.remove);
    if (opts.none && (add.length > 0 || remove.length > 0)) {
      throw cliError("INVALID_ARG", "--none unlinks every task: it cannot be combined with --add or --remove.");
    }
    if (!opts.none && add.length === 0 && remove.length === 0) {
      throw cliError("INVALID_ARG", "Name what to change: --add <task>, --remove <task>, or --none.");
    }
    const agentContext = ctx.loadAgentContext();
    const client = ctx.createApiClient(agentContext);
    const agentApi = createAgentApiSurfaceClient(client);
    const res = await agentApi.messages.retag(
      { msgId: asMessageId(msgId.trim()) },
      { ...(add.length > 0 ? { add } : {}), ...(remove.length > 0 ? { remove } : {}), ...(opts.none ? { none: true } : {}) },
    );
    if (!res.ok || !res.data) {
      const rateLimited = rateLimitedResponseError(res);
      if (rateLimited) throw rateLimited;
      const code = res.status >= 500 ? "SERVER_5XX" : "RETAG_FAILED";
      throw cliError(code, res.error ?? `HTTP ${res.status}`);
    }
    const list = (ns: number[]) => ns.map((n) => `#${n}`).join(", ");
    const parts = [
      res.data.added.length > 0 ? `linked to ${list(res.data.added)}` : null,
      res.data.removed.length > 0 ? `unlinked from ${list(res.data.removed)}` : null,
    ].filter(Boolean);
    const now = res.data.taskNumbers.length > 0 ? `Tasks now: ${list(res.data.taskNumbers)}.` : "Linked to no task now.";
    writeText(ctx.io, adoptCliReplyText(`Message ${msgId.trim().slice(0, 8)} ${parts.length > 0 ? parts.join("; ") : "unchanged"}. ${now}\n`));
  },
);

export function registerRetagCommand(parent: Command, runtimeOptions: CommandRuntimeOptions = {}): void {
  registerCliCommand(parent, messageRetagCommand, runtimeOptions);
}
