import { create } from "zustand";

import api from "../../api/client";
import { inboxItemChannelId } from "../../store/inboxItem";
import type { InboxItem } from "../../store/inboxStore";
import type { Task } from "../../store/taskStore";

const OPEN = new Set(["todo", "in_progress", "in_review"]);

/**
 * The inbox's For me, handled per item (task #10 item 7; server inbox_for_me_done): a row opened there, its Done,
 * Done all. Replies and @s (`conv:`) the server leaves out of the For me read; tasks (`task:`), reviews (`review:`)
 * and questions (`card:`) the web leaves out with `doneAt` here. Also the open questions asked of the person.
 */
export interface ForMeQuestion {
  messageId: string;
  channelId: string;
  seq: number;
  title: string | null;
  reason: string | null;
  firstQuestion: string | null;
  expiresAt: string | null;
  askedByAgentId: string | null;
  createdAt: string;
}

interface ForMeState {
  serverId: string | null;
  /** task:/review:/card: key → when handled. */
  doneAt: Record<string, string>;
  questions: ForMeQuestion[];
  /** Moves on every handling, so For me's count asks again. */
  version: number;
  load: (serverId: string) => Promise<void>;
  markDone: (keys: string[]) => Promise<void>;
}

export const useForMeStore = create<ForMeState>((set, get) => ({
  serverId: null,
  doneAt: {},
  questions: [],
  version: 0,
  load: async (serverId) => {
    if (get().serverId !== serverId) set({ serverId, doneAt: {}, questions: [] });
    const [done, questions] = await Promise.all([
      api.get<{ items: Array<{ itemKey: string; doneAt: string }> }>("/channels/inbox/for-me/done").catch(() => null),
      api.get<{ items: ForMeQuestion[] }>("/channels/inbox/for-me/questions").catch(() => null),
    ]);
    if (get().serverId !== serverId) return;
    set((state) => ({
      doneAt: done ? { ...Object.fromEntries(done.data.items.map((row) => [row.itemKey, row.doneAt])), ...pendingOnly(state.doneAt, done.data.items) } : state.doneAt,
      questions: questions ? questions.data.items : state.questions,
    }));
  },
  markDone: async (keys) => {
    if (keys.length === 0) return;
    const now = new Date().toISOString();
    set((state) => ({
      doneAt: { ...state.doneAt, ...Object.fromEntries(keys.filter((key) => !key.startsWith("conv:")).map((key) => [key, now])) },
      version: state.version + 1,
    }));
    try {
      await api.post("/channels/inbox/for-me/done", { keys });
    } finally {
      // The count asks again once the server has it.
      set((state) => ({ version: state.version + 1 }));
    }
  },
}));

/** Marks made here the server has not listed yet (a load racing a markDone) stay. */
function pendingOnly(local: Record<string, string>, server: Array<{ itemKey: string }>): Record<string, string> {
  const listed = new Set(server.map((row) => row.itemKey));
  return Object.fromEntries(Object.entries(local).filter(([key]) => !listed.has(key)));
}

/** A conversation row's For me key, or null (an object row is not For me's). */
export function forMeConversationKey(item: InboxItem): string | null {
  const id = inboxItemChannelId(item);
  return id ? `conv:${id.toLowerCase()}` : null;
}

/** Whether `key` was handled after `since` (a task given back to the person later shows again). */
export function handledSince(doneAt: Record<string, string>, key: string, since?: string | null): boolean {
  const at = doneAt[key];
  if (!at) return false;
  return !since || at >= since;
}

/**
 * For me's tasks (task #10 item 7): assigned to me and not done (they leave when done or given to someone else);
 * waiting for my review — in review, created by me (TaskSectionList's rule), not mine to do (they leave when done
 * or sent back). Either leaves early by its Done.
 */
export function forMeTasks(tasks: readonly Task[], viewerId: string | null, doneAt: Record<string, string>) {
  const mineToDo = (t: Task) => t.claimedByType === "user" && t.claimedById === viewerId;
  const mine = tasks
    .filter((t) => mineToDo(t) && OPEN.has(t.status) && !handledSince(doneAt, `task:${t.id}`, t.claimedAt))
    .sort((a, b) => b.taskNumber - a.taskNumber);
  const reviews = tasks
    .filter((t) => t.status === "in_review" && t.createdByType === "user" && t.createdById === viewerId && !mineToDo(t)
      && !handledSince(doneAt, `review:${t.id}`, t.updatedAt))
    .sort((a, b) => b.taskNumber - a.taskNumber);
  return { mine, reviews };
}

/** Open questions asked of me, less those I marked Done. */
export function openQuestions(questions: readonly ForMeQuestion[], doneAt: Record<string, string>): ForMeQuestion[] {
  return questions.filter((q) => !handledSince(doneAt, `card:${q.messageId}`));
}

