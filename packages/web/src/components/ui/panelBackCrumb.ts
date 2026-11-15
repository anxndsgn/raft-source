import { createContext } from "react";
import type { ReactNode } from "react";

/**
 * Layout redesign 4.5: a head's Back as a crumb, "‹ <where it goes> /", where a page is pushed into the side panel
 * (a member's details over the channel's members). Null: the usual arrow.
 */
export const PanelBackCrumbContext = createContext<string | null>(null);

/** Layout redesign 7.1: what stands right under a head (a member's "now": their task, Message), its page's own. */
export const PanelHeadBelowContext = createContext<ReactNode>(null);
