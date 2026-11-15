import { createContext } from "react";

/** Layout redesign §5: this thread is shown in the workspace (it offers no "Open in workspace" there). */
export const InWorkspaceContext = createContext(false);

/** Layout redesign §5: a thread shown in the workspace — its channel's name, for "Reply to #channel" (F3b). */
export const WorkspaceThreadChannelContext = createContext<string | null>(null);
