import { createContext } from "react";
import type { ReactNode } from "react";

/**
 * Layout redesign 4.5: where a pushed page's Back goes ("Back to members"), its label — a member's details over the
 * channel's members. Null: the usual Back, shown only where the head shows one.
 */
export const PanelBackCrumbContext = createContext<string | null>(null);

/** Layout redesign 7.1: what stands right under a head (a member's "now": their task, Message), its page's own. */
export const PanelHeadBelowContext = createContext<ReactNode>(null);

/** Layout redesign 7.1: a member's details opened from a channel they are not in (ChannelMembers' `profileOnly`). */
export const MemberOutsideChannelContext = createContext(false);

/**
 * Team page PRD §5.4 (Figmama 11/16): a member's details in a workspace tab have no head row of their own — the
 * tab names them, its × closes and the strip's ⤢ expands — only what stands under it (their "now" and Message).
 */
export const PanelHeadHiddenContext = createContext(false);
