import { createContext } from "react";

/**
 * Where a page in the conversation's column (MainLayout's `.thread-main-column`) puts a column of its own beside it in
 * MainLayout's row, so that column stands in the row the #189 rules plan (rowLayout) and the page is the row's
 * conversation: the Tasks page's task beside its list (TasksRoute), as the thread beside its channel. A `contents`
 * element right after the conversation's column, so what is portaled into it is the row's flex item.
 *
 * Undefined outside MainLayout (no row: the page lays the column out itself); null until the slot has mounted.
 */
export const RowColumnSlotContext = createContext<HTMLElement | null | undefined>(undefined);

/**
 * Layout redesign: where the conversation's header goes on a desktop, above
 * MainLayout's row, so the header spans the conversation and its side panel
 * (the side panel belongs to the channel and starts under its header).
 * Undefined outside MainLayout; null until mounted.
 */
export const ConversationHeaderSlotContext = createContext<HTMLElement | null | undefined>(undefined);
