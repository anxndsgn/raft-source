import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useDomMeasureEffect, useEventBridge } from "../../hooks/effectPrimitives";
import type { LiveAgentActivityItem } from "../../utils/liveAgentActivity";
import { formatActivityTextDescriptor } from "../../utils/activity";
import AvatarSlot from "../ui/AvatarSlot";
import AgentActivitySubscription from "../agent/AgentActivitySubscription";

/** The pill's height and the panel's corner: 16 on both (owner, Figmama prototype v6). */
const PILL_HEIGHT = 32;
const PANEL_WIDTH = 320;
const ROW_HEIGHT = 44;
const PANEL_INSET = 4;
const MAX_ROWS = 6;
const EASE = "cubic-bezier(.32,.72,0,1)";

/**
 * Working now in a conversation (owner 7974ec89, Figmama prototype v6 "正在工作胶囊展开"): the pill grows in place
 * into the list of who is working, its bottom-left corner fixed. Width from the pill's to 320 and height to the rows'
 * together in 200ms, the corner 16 throughout; the pill's line fades out and its faces slide to their rows (20 to 24),
 * the names and what each is doing fade in after. No scrollbar while it grows (past six rows the list scrolls once it
 * has). A row opens that agent beside the conversation and folds the panel back; so do Escape and a press outside.
 * Reduced motion: it switches without the transitions.
 */
export function WorkingPillPanel({
  items,
  typingAgentIds,
  label,
  faces,
  onOpenAgent,
  testId,
}: {
  items: readonly LiveAgentActivityItem[];
  typingAgentIds?: ReadonlySet<string>;
  /** The pill's line ("2 个 Agent 正在这里工作"), its accessible name too. */
  label: string;
  /** The pill's stacked faces. */
  faces: ReactNode;
  onOpenAgent: (agentId: string) => void;
  testId: string;
}) {
  const { formatMessage } = useIntl();
  // closed: the pill in the flow, as wide as its line; opening/closing: held at the pill's width, about to grow or
  // just shrunk back; open: the panel.
  const [phase, setPhase] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const open = phase === "open";
  const [scrollable, setScrollable] = useState(false);
  const [pillWidth, setPillWidth] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rows = Math.min(items.length, MAX_ROWS);

  // Opening: from the pill's width to the panel's on the next frame. Closing: back at the pill's width, then in the
  // flow again once the motion is done.
  useDomMeasureEffect(() => {
    if (phase === "opening") {
      const frame = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(frame);
    }
    if (phase === "closing") {
      const timer = window.setTimeout(() => setPhase("closed"), reduced() ? 0 : 220);
      return () => window.clearTimeout(timer);
    }
  }, [phase]);

  // Past six rows the list scrolls, only once it has grown (no scrollbar during the motion).
  useDomMeasureEffect(() => {
    if (!open || items.length <= MAX_ROWS) {
      setScrollable(false);
      return;
    }
    const timer = window.setTimeout(() => setScrollable(true), 220);
    return () => window.clearTimeout(timer);
  }, [open, items.length]);

  const reduced = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Each face slides from where it sat in the pill to its row's avatar (FLIP).
  const slideFaces = useCallback(() => {
    const root = rootRef.current;
    const head = headRef.current;
    if (!root || !head || reduced()) return;
    const from = [...head.querySelectorAll<HTMLElement>("[data-slot=avatar]")].map((face) => face.getBoundingClientRect());
    const box = root.getBoundingClientRect();
    const panelTop = box.bottom - (PANEL_INSET * 2 + rows * ROW_HEIGHT);
    requestAnimationFrame(() => {
      const avatars = listRef.current?.querySelectorAll<HTMLElement>("[data-row-avatar]") ?? [];
      avatars.forEach((avatar, index) => {
        const targetLeft = box.left + PANEL_INSET + 8;
        const targetTop = panelTop + PANEL_INSET + index * ROW_HEIGHT + 10;
        const start = from[index];
        if (!start) {
          avatar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 80, fill: "backwards" });
          return;
        }
        avatar.animate(
          [{ transform: `translate(${start.left - targetLeft}px, ${start.top - targetTop}px) scale(${start.width / 24})` }, { transform: "none" }],
          { duration: 220, easing: EASE },
        );
      });
    });
  }, [rows]);

  const toggle = useCallback(() => {
    if (phase === "closed") {
      setPillWidth(Math.ceil(rootRef.current?.getBoundingClientRect().width ?? 0));
      slideFaces();
      setPhase("opening");
    } else if (phase === "open") {
      setPhase("closing");
    }
  }, [phase, slideFaces]);
  const close = useCallback(() => setPhase((current) => (current === "open" || current === "opening" ? "closing" : current)), []);

  useEventBridge<PointerEvent>(open && typeof document !== "undefined" ? document : null, "pointerdown", (event) => {
    if (rootRef.current && !rootRef.current.contains(event.target as Node)) close();
  });
  useEventBridge<KeyboardEvent>(open && typeof document !== "undefined" ? document : null, "keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
    headRef.current?.focus();
  });

  const openAgent = (agentId: string) => {
    close();
    onOpenAgent(agentId);
  };

  const height = open ? PANEL_INSET * 2 + rows * ROW_HEIGHT : PILL_HEIGHT;
  const width = phase === "closed" ? undefined : open ? PANEL_WIDTH : pillWidth;
  const inFlow = phase === "closed";
  return (
    <div
      ref={rootRef}
      data-testid={testId}
      data-open={open ? "" : undefined}
      className="pointer-events-auto relative overflow-hidden rounded-[16px] bg-layer-canvas shadow-[0_0_0_1px_var(--line-floating),0_6px_20px_-8px_rgb(0_0_0/0.25)] transition-[width,height] duration-200 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none"
      style={{ width, height }}
    >
      {open ? <AgentActivitySubscription agentIdKey={items.map((item) => item.agentId).join(",")} /> : null}
      <div
        ref={listRef}
        role="list"
        aria-label={formatMessage({ id: "layout.workingNow.title" })}
        id={`${testId}-list`}
        className={`absolute inset-0 p-1 ${scrollable ? "overflow-y-auto" : "overflow-hidden"} ${open ? "opacity-100" : "pointer-events-none opacity-0 transition-opacity duration-75"}`}
        data-testid="working-now-list"
      >
        {phase === "open" || phase === "closing" ? items.map((item) => {
          const text = typingAgentIds?.has(item.agentId)
            ? formatMessage({ id: "message.agentTyping.typingRow" })
            : item.textDescriptor
              ? formatActivityTextDescriptor(formatMessage, item.textDescriptor)
              : item.text;
          return (
            <button
              key={item.agentId}
              type="button"
              role="listitem"
              onClick={() => openAgent(item.agentId)}
              className="flex h-11 w-full items-center gap-2.5 rounded-[12px] px-2 text-left outline-none hover:bg-fill-medium focus-visible:shadow-focus"
              data-agent-id={item.agentId}
            >
              <span data-row-avatar="" className="flex size-6 shrink-0 will-change-transform [&_[data-slot=avatar]]:size-6 [&_[data-slot=avatar]]:rounded-full [&_[data-slot=avatar-image]]:rounded-full [&_[data-slot=avatar-fallback]]:rounded-full">
                <AvatarSlot context="compact-row" type="agent" agentAvatarUrl={item.agentAvatarUrl} presence={item.activity === "error" ? "error" : "busy"} />
              </span>
              <span className="flex min-w-0 flex-col motion-safe:animate-[working-row-in_160ms_80ms_both]">
                <span className="truncate text-[13px] leading-[18px] font-semibold text-foreground">{item.agentName}</span>
                <span className="truncate text-[12px] leading-4 text-foreground-muted">{text}</span>
              </span>
            </button>
          );
        }) : null}
      </div>
      <button
        ref={headRef}
        type="button"
        aria-expanded={open}
        aria-controls={`${testId}-list`}
        aria-label={label}
        onClick={toggle}
        data-testid="agent-typing-trigger"
        className={`${inFlow ? "relative" : "absolute inset-x-0 bottom-0"} flex h-8 items-center gap-1.5 pr-2.5 pl-1.5 text-left text-[12px] leading-4 whitespace-nowrap text-foreground-muted outline-none focus-visible:shadow-focus ${open ? "pointer-events-none opacity-0 transition-opacity duration-100" : "opacity-100"} [&_[data-slot=avatar]]:size-5 [&_[data-slot=avatar]]:rounded-full [&_[data-slot=avatar]]:border-0 [&_[data-slot=avatar]]:shadow-none [&_[data-slot=avatar-image]]:rounded-full [&_[data-slot=avatar-fallback]]:rounded-full`}
      >
        {faces}
        <span className="min-w-0 truncate">{label}</span>
      </button>
    </div>
  );
}
