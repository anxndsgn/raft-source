import { createContext } from "react";

/**
 * Layout redesign 4.5: a head's Back as a crumb, "‹ <where it goes> /", where a page is pushed into the side panel
 * (a member's details over the channel's members). Null: the usual arrow.
 */
export const PanelBackCrumbContext = createContext<string | null>(null);
