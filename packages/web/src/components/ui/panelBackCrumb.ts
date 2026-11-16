import { createContext } from "react";
import type { ReactNode } from "react";

/**
 * Layout redesign 4.5: where a pushed page's Back goes ("Back to members"), its label — a member's details over the
 * channel's members. Null: the usual Back, shown only where the head shows one.
 */
export const PanelBackCrumbContext = createContext<string | null>(null);

/**
 * Team page v2.1 §5.4.1: a member's state in their details' head, after the name (the mark and a short status). Its
 * head is then the plain one: the name and the status, then Message ⋯ ⤢ ×.
 */
export const PanelHeadStatusContext = createContext<ReactNode>(null);

/** Layout redesign 7.1: a member's details opened from a channel they are not in (ChannelMembers' `profileOnly`). */
export const MemberOutsideChannelContext = createContext(false);
