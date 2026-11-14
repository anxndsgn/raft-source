import { create } from "zustand";
import { replyExcerpt } from "@botiverse/raft-shared";

import api from "../api/client";
import { registerTimelineViewReadHold } from "./autoReadHold";
import { useReplyTargetStore } from "./replyTargetStore";
import type { Message } from "./messageStore";
import { coerceWireMessageSeqs } from "./wireMessageSeq";

/**
 * Reply mode, step 2: the channel timeline's filtered views (one at a time per
 * channel): a task's messages, one reply chain, or what concerns me. Kept for
 * this page's life only (a reload shows everything again). The timeline
 * renders the view's messages with "N hidden · show" rows between them; the
 * composer links what it sends to the view's task (task view) or replies on
 * the chain (chain view). While a view is open the channel's read position
 * does not move (autoReadHold asks `isTimelineViewOpen`).
 */

export type TimelineViewSpec =
  | { kind: "task"; taskNumber: number; title?: string }
  | { kind: "chain"; messageId: string; senderName?: string; excerpt?: string }
  | { kind: "mine" };

export interface TimelineViewState {
  spec: TimelineViewSpec;
  /** The view this one was opened from (one level), for "‹ back". */
  prev: TimelineViewSpec | null;
  messages: Message[];
  /** Per view message id: timeline messages hidden right before it. */
  hiddenBefore: Record<string, number>;
  /** Hidden runs shown in place, by the view message they precede. */
  expanded: Record<string, Message[]>;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  /** The channel's newest seq when the view opened: newer messages outside it are counted. */
  sinceSeq: number | null;
  newOutside: number;
  /** Opened from Activity with unread messages the view hides (the read position stayed). */
  hiddenUnread: { count: number; firstSeq: number | null; firstId: string | null } | null;
  /** A message to scroll to once loaded. */
  focusMessageId: string | null;
  /** Bumped on every (re)load, so the timeline remounts on a new view. */
  key: number;
  /** Chain view: the reply target the view set on the composer (cleared with the view if untouched). */
  autoReplyTargetId: string | null;
}

function clearAutoReplyTarget(channelId: string, view: TimelineViewState | undefined) {
  if (!view?.autoReplyTargetId) return;
  const replyTargets = useReplyTargetStore.getState();
  if (replyTargets.targets[channelId]?.messageId === view.autoReplyTargetId) replyTargets.clearReplyTarget(channelId);
}

type ViewPage = {
  messages: Message[];
  hasMore: boolean;
  total: number;
  hiddenBefore: Record<string, number>;
  newOutside: number;
  hiddenUnread: { count: number; firstSeq: number | null; firstId: string | null } | null;
  latestSeq: number;
  channelLatestSeq: number;
  readThroughSeq: number | null;
};

const PAGE_LIMIT = 50;
let keyCounter = 0;

function sameSpec(a: TimelineViewSpec | null | undefined, b: TimelineViewSpec | null | undefined): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "task" && b.kind === "task") return a.taskNumber === b.taskNumber;
  if (a.kind === "chain" && b.kind === "chain") return a.messageId === b.messageId;
  return true;
}

function viewQuery(spec: TimelineViewSpec): string {
  if (spec.kind === "task") return `view=task&task=${spec.taskNumber}`;
  if (spec.kind === "chain") return `view=chain&message=${encodeURIComponent(spec.messageId)}`;
  return "view=mine";
}

async function fetchViewPage(channelId: string, spec: TimelineViewSpec, opts: { before?: number; since?: number | null; readThrough?: string } = {}): Promise<ViewPage> {
  const params = [viewQuery(spec), `limit=${PAGE_LIMIT}`];
  if (opts.before !== undefined) params.push(`before=${opts.before}`);
  if (opts.since !== undefined && opts.since !== null) params.push(`since=${opts.since}`);
  if (opts.readThrough) params.push(`readThrough=${encodeURIComponent(opts.readThrough)}`);
  const { data } = await api.get(`/messages/channel/${channelId}/view?${params.join("&")}`);
  const page = data as ViewPage;
  return { ...page, messages: coerceWireMessageSeqs(page.messages ?? []) };
}

/** Whether the person sees this channel through a view right now (read position held). */
export function isTimelineViewOpen(channelId: string | null | undefined): boolean {
  return !!channelId && (pendingViewHolds.has(channelId) || !!useTimelineViewStore.getState().views[channelId]);
}

/** Channels whose view is being decided (Activity asks the server first): their read position is held meanwhile. */
const pendingViewHolds = new Set<string>();
export function holdReadWhileViewPending(channelId: string): () => void {
  pendingViewHolds.add(channelId);
  return () => { pendingViewHolds.delete(channelId); };
}

registerTimelineViewReadHold(isTimelineViewOpen);

/** Whether the view open in this channel (if any) shows this message; true without a view. */
export function timelineViewHasMessage(channelId: string, messageId: string): boolean {
  const view = useTimelineViewStore.getState().views[channelId];
  if (!view) return true;
  return view.messages.some((m) => m.id === messageId)
    || Object.values(view.expanded).some((run) => run.some((m) => m.id === messageId));
}

/** The task number the composer of this channel links its messages to (task view), if any. */
export function timelineViewComposerTaskNumber(channelId: string): number | null {
  const spec = useTimelineViewStore.getState().views[channelId]?.spec;
  return spec?.kind === "task" ? spec.taskNumber : null;
}

interface TimelineViewStoreState {
  views: Record<string, TimelineViewState>;
  /**
   * Opens a view (replacing the one open; the replaced one is kept as `prev`).
   * `readThrough`: opened from Activity at that message — the server counts
   * unread messages the view hides up to it; with none, the read position
   * moves to it (`onReadThrough`), otherwise it stays and the bar says so.
   */
  openView: (channelId: string, spec: TimelineViewSpec, opts?: {
    focusMessageId?: string;
    readThrough?: string;
    onReadThrough?: (seq: number) => void;
    keepPrev?: boolean;
  }) => Promise<void>;
  closeView: (channelId: string) => void;
  backView: (channelId: string) => void;
  refreshView: (channelId: string) => Promise<void>;
  loadOlder: (channelId: string) => Promise<void>;
  expandHidden: (channelId: string, beforeMessageId: string) => Promise<void>;
  clearFocus: (channelId: string) => void;
}

export const useTimelineViewStore = create<TimelineViewStoreState>((set, get) => ({
  views: {},

  openView: async (channelId, spec, opts = {}) => {
    const current = get().views[channelId];
    if (current && sameSpec(current.spec, spec) && !opts.readThrough) {
      if (opts.focusMessageId) set((state) => ({ views: { ...state.views, [channelId]: { ...current, focusMessageId: opts.focusMessageId! } } }));
      return;
    }
    const prev = opts.keepPrev ? current?.prev ?? null : current ? current.spec : null;
    clearAutoReplyTarget(channelId, current);
    const key = ++keyCounter;
    set((state) => ({
      views: {
        ...state.views,
        [channelId]: {
          spec, prev, messages: [], hiddenBefore: {}, expanded: {}, total: 0, hasMore: false,
          loading: true, error: null, sinceSeq: null, newOutside: 0, hiddenUnread: null,
          focusMessageId: opts.focusMessageId ?? null, key, autoReplyTargetId: null,
        },
      },
    }));
    try {
      const page = await fetchViewPage(channelId, spec, { readThrough: opts.readThrough });
      if (get().views[channelId]?.key !== key) return;
      const hiddenUnread = page.hiddenUnread && page.hiddenUnread.count > 0 ? page.hiddenUnread : null;
      if (opts.readThrough && !hiddenUnread && page.readThroughSeq) opts.onReadThrough?.(page.readThroughSeq);
      // Chain view: the composer replies to the chain's newest message (its bar can be dismissed).
      let autoReplyTargetId: string | null = null;
      const newest = spec.kind === "chain" ? page.messages[page.messages.length - 1] : undefined;
      if (newest && !useReplyTargetStore.getState().targets[channelId]) {
        useReplyTargetStore.getState().setReplyTarget(channelId, {
          messageId: newest.id,
          senderName: newest.senderDisplayName || newest.senderName || "",
          excerpt: replyExcerpt(newest.content ?? ""),
        });
        autoReplyTargetId = newest.id;
      }
      set((state) => ({
        views: {
          ...state.views,
          [channelId]: {
            ...state.views[channelId]!,
            messages: page.messages,
            hiddenBefore: page.hiddenBefore,
            total: page.total,
            hasMore: page.hasMore,
            loading: false,
            sinceSeq: page.channelLatestSeq,
            hiddenUnread,
            autoReplyTargetId,
          },
        },
      }));
    } catch (err) {
      if (get().views[channelId]?.key !== key) return;
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "error";
      set((state) => ({ views: { ...state.views, [channelId]: { ...state.views[channelId]!, loading: false, error: message } } }));
    }
  },

  closeView: (channelId) => set((state) => {
    if (!state.views[channelId]) return state;
    clearAutoReplyTarget(channelId, state.views[channelId]);
    const { [channelId]: _closed, ...rest } = state.views;
    return { views: rest };
  }),

  backView: (channelId) => {
    const prev = get().views[channelId]?.prev;
    if (!prev) return;
    void get().openView(channelId, prev, { keepPrev: false });
    // The view we came back to has no "back" of its own.
    set((state) => state.views[channelId] ? { views: { ...state.views, [channelId]: { ...state.views[channelId]!, prev: null } } } : state);
  },

  refreshView: async (channelId) => {
    const view = get().views[channelId];
    if (!view || view.loading) return;
    const key = view.key;
    try {
      const page = await fetchViewPage(channelId, view.spec, { since: view.sinceSeq });
      const latest = get().views[channelId];
      if (!latest || latest.key !== key) return;
      // Keep the older pages already loaded; the first page replaces its range.
      const firstSeq = page.messages[0]?.seq ?? Number.MAX_SAFE_INTEGER;
      const older = latest.messages.filter((m) => (m.seq ?? 0) < firstSeq);
      set((state) => ({
        views: {
          ...state.views,
          [channelId]: {
            ...latest,
            messages: [...older, ...page.messages],
            hiddenBefore: { ...latest.hiddenBefore, ...page.hiddenBefore },
            total: page.total,
            hasMore: older.length > 0 ? latest.hasMore : page.hasMore,
            newOutside: page.newOutside,
          },
        },
      }));
    } catch {
      // A failed refresh keeps what is shown.
    }
  },

  loadOlder: async (channelId) => {
    const view = get().views[channelId];
    if (!view || view.loading || !view.hasMore) return;
    const oldest = view.messages[0]?.seq;
    if (oldest === undefined) return;
    const key = view.key;
    set((state) => ({ views: { ...state.views, [channelId]: { ...view, loading: true } } }));
    try {
      const page = await fetchViewPage(channelId, view.spec, { before: oldest });
      const latest = get().views[channelId];
      if (!latest || latest.key !== key) return;
      set((state) => ({
        views: {
          ...state.views,
          [channelId]: {
            ...latest,
            messages: [...page.messages, ...latest.messages],
            hiddenBefore: { ...page.hiddenBefore, ...latest.hiddenBefore },
            hasMore: page.hasMore,
            loading: false,
          },
        },
      }));
    } catch {
      const latest = get().views[channelId];
      if (latest && latest.key === key) set((state) => ({ views: { ...state.views, [channelId]: { ...latest, loading: false } } }));
    }
  },

  expandHidden: async (channelId, beforeMessageId) => {
    const view = get().views[channelId];
    if (!view) return;
    const index = view.messages.findIndex((m) => m.id === beforeMessageId);
    if (index < 0) return;
    const existing = view.expanded[beforeMessageId] ?? [];
    const upTo = existing[0]?.seq ?? view.messages[index]!.seq ?? 0;
    const after = index > 0 ? view.messages[index - 1]!.seq ?? 0 : 0;
    const key = view.key;
    // The hidden run, oldest first, up to 200 at a time (its newest end is
    // nearest the view message, so a long run is read from that end).
    const { data } = await api.get(`/messages/channel/${channelId}?before=${upTo}&limit=200`);
    const latest = get().views[channelId];
    if (!latest || latest.key !== key) return;
    const fetched = coerceWireMessageSeqs((data.messages ?? data) as Message[])
      .filter((m) => (m.seq ?? 0) > after && (m.seq ?? 0) < upTo)
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    const inView = new Set(latest.messages.map((m) => m.id));
    const run = fetched.filter((m) => !inView.has(m.id));
    const remaining = Math.max(0, (latest.hiddenBefore[beforeMessageId] ?? 0) - run.length);
    set((state) => ({
      views: {
        ...state.views,
        [channelId]: {
          ...latest,
          expanded: { ...latest.expanded, [beforeMessageId]: [...run, ...(latest.expanded[beforeMessageId] ?? [])] },
          hiddenBefore: { ...latest.hiddenBefore, [beforeMessageId]: remaining },
        },
      },
    }));
  },

  clearFocus: (channelId) => set((state) => {
    const view = state.views[channelId];
    if (!view || !view.focusMessageId) return state;
    return { views: { ...state.views, [channelId]: { ...view, focusMessageId: null } } };
  }),
}));

/**
 * The rows the timeline shows for a view: each view message, preceded by its
 * hidden run when expanded. `hiddenRowBefore` says where a "N hidden" row
 * goes (before which message, how many).
 */
export function timelineViewRows(view: TimelineViewState): { messages: Message[]; hiddenRowBefore: Map<string, { count: number; viewMessageId: string }>; expandedIds: Set<string> } {
  const messages: Message[] = [];
  const hiddenRowBefore = new Map<string, { count: number; viewMessageId: string }>();
  const expandedIds = new Set<string>();
  for (const message of view.messages) {
    const run = view.expanded[message.id];
    const left = view.hiddenBefore[message.id] ?? 0;
    if (run && run.length > 0) {
      // A run longer than one read keeps its older part hidden, above it.
      if (left > 0) hiddenRowBefore.set(run[0]!.id, { count: left, viewMessageId: message.id });
      for (const m of run) { messages.push(m); expandedIds.add(m.id); }
    } else if (left > 0) {
      hiddenRowBefore.set(message.id, { count: left, viewMessageId: message.id });
    }
    messages.push(message);
  }
  return { messages, hiddenRowBefore, expandedIds };
}

