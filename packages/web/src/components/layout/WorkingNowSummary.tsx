import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useIntl } from "react-intl";
import { Popover, PopoverContent, PopoverTrigger, ScrollArea } from "@botiverse/raft-ui";
import { nextLiveAgentActivityExpiry } from "../../utils/liveAgentActivity";
import type { LiveAgentActivityItem } from "../../utils/liveAgentActivity";
import { useLiveAgentActivityStore } from "../../store/liveAgentActivityStore";
import { useAgentTypingStore } from "../../store/agentTypingStore";
import { formatActivityTextDescriptor } from "../../utils/activity";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import AvatarSlot from "../ui/AvatarSlot";
import AgentActivitySubscription from "../agent/AgentActivitySubscription";
import { FaceStack } from "./FaceStack";

const MAX_FACES = 3;

/**
 * Live activity (and who is typing) belongs to one workspace: start over when
 * it changes. While the app runs, rows leave on their own (an idle agent after
 * its grace, a silent one after the safety window): pruned at the earliest of
 * those moments, from a store subscription, so the layout never re-renders
 * for it (the Team tab replaced the summary that used to do this).
 */
export function useClearLiveAgentActivityOnServerChange(serverId: string | undefined) {
  useLayoutEffect(() => {
    useLiveAgentActivityStore.getState().clear();
    useAgentTypingStore.getState().clear();
  }, [serverId]);
  useEffect(() => {
    let timeout: number | undefined;
    let scheduled: number | null = null;
    const schedule = (items: readonly LiveAgentActivityItem[]) => {
      const next = nextLiveAgentActivityExpiry(items);
      if (next === scheduled) return;
      window.clearTimeout(timeout);
      scheduled = next;
      if (next === null) return;
      timeout = window.setTimeout(() => {
        scheduled = null;
        useLiveAgentActivityStore.getState().pruneExpired();
      }, Math.max(0, next - Date.now()) + 50);
    };
    schedule(useLiveAgentActivityStore.getState().items);
    const unsubscribe = useLiveAgentActivityStore.subscribe((state) => schedule(state.items));
    return () => {
      unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);
}

/**
 * "Working now" opened from a trigger: one row per agent, what it is doing,
 * and a way to its profile. The workspace summary opens it for everyone at
 * work; a channel's line above the composer (AgentTypingLine) for the agents
 * working there, where an agent about to post reads "Typing…" instead.
 */
export function WorkingNowPopover({
  items,
  typingAgentIds,
  label,
  side = "bottom",
  align,
  testId,
  className,
  children,
}: {
  items: readonly LiveAgentActivityItem[];
  /** Agents about to post where the list was opened: their row says so. */
  typingAgentIds?: ReadonlySet<string>;
  /** The trigger's accessible name. */
  label: string;
  side?: "top" | "bottom";
  align: "start" | "end";
  testId: string;
  className: string;
  /** The trigger's content. */
  children: ReactNode;
}) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger data-testid={testId} aria-label={label} className={className}>
        {children}
      </PopoverTrigger>
      {open ? (
        <PopoverContent
          side={side}
          align={align}
          role="dialog"
          aria-label={formatMessage({ id: "layout.workingNow.title" })}
          className="w-[300px] p-0"
          data-testid="working-now-list"
        >
          {/* What each of them is doing: their detail while the list is open. */}
          <AgentActivitySubscription agentIdKey={items.map((item) => item.agentId).join(",")} />
          <WorkingNowList items={items} typingAgentIds={typingAgentIds} onNavigate={close} />
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

function WorkingNowList({ items, typingAgentIds, onNavigate }: {
  items: readonly LiveAgentActivityItem[];
  typingAgentIds: ReadonlySet<string> | undefined;
  onNavigate: () => void;
}) {
  const { formatMessage } = useIntl();
  const nav = useAppNavigate();
  const openAgent = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const agentId = event.currentTarget.dataset.agentId;
    if (!agentId) return;
    onNavigate();
    nav.toAgent(agentId);
  }, [nav, onNavigate]);
  return (
    <div className="flex flex-col">
      <div className="flex min-h-11 items-center border-b border-line-seam px-4 text-headline">
        {formatMessage({ id: "layout.workingNow.title" })}
      </div>
      {/* Every row is a button that takes focus, so the area is no tab stop. */}
      <ScrollArea tabIndex={-1} className="max-h-[min(60vh,420px)]">
      <ul className="flex flex-col py-1.5">
        {items.map((item) => {
          const text = typingAgentIds?.has(item.agentId)
            ? formatMessage({ id: "message.agentTyping.typingRow" })
            : item.textDescriptor
              ? formatActivityTextDescriptor(formatMessage, item.textDescriptor)
              : item.text;
          return (
            <li key={item.agentId}>
              <button
                type="button"
                data-agent-id={item.agentId}
                onClick={openAgent}
                className="flex w-full items-start gap-3 px-4 py-2 text-left outline-none hover:bg-brand-soft focus-visible:bg-brand-soft"
              >
                <AvatarSlot
                  context="compact-row"
                  type="agent"
                  agentAvatarUrl={item.agentAvatarUrl}
                  presence={item.activity === "error" ? "error" : "busy"}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-callout font-bold text-foreground">{item.agentName}</span>
                  <span className="line-clamp-2 text-footnote text-foreground-muted">{text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      </ScrollArea>
    </div>
  );
}

/**
 * The stack of agents at work: the shared FaceStack, up to three agents in
 * the order they started (the store keeps that order), so the stack changes
 * only when someone starts or stops. `still`: no entrance (the typing line).
 */
export function WorkingFaces({
  items,
  still = false,
  testId = "working-faces",
}: {
  items: readonly Pick<LiveAgentActivityItem, "agentId" | "agentAvatarUrl">[];
  still?: boolean;
  testId?: string;
}) {
  return (
    <FaceStack still={still} testId={testId}>
      {items.slice(0, MAX_FACES).map((item) => (
        <AvatarSlot key={item.agentId} context="face-stack" type="agent" agentAvatarUrl={item.agentAvatarUrl} />
      ))}
    </FaceStack>
  );
}

