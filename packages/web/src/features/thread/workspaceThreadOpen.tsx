import { useCallback, useContext } from "react";
import { InWorkspaceContext } from "./workspaceThreadContext";
import { useIntl } from "react-intl";
import { PanelAction } from "@botiverse/raft-ui";
import { SquareArrowOutUpRight } from "lucide-react";

import Tooltip from "../../components/ui/Tooltip";
import { useArtifactViewerStore } from "../../apps/artifacts/artifactViewerStore";
import { useThreadStore } from "../../store/threadStore";
import { useMessageStore } from "../../store/messageStore";
import type { Message } from "../../store/messageStore";

/**
 * Layout redesign §5 (Figmama 11/15): the side panel's thread opened in the workspace — a tab named after its
 * channel and the start of its message; the side panel closes. A desktop's side thread only.
 */
export function OpenThreadInWorkspaceAction({ parentChannelId, parentMessageId, threadChannelId, channelName, messages }: {
  parentChannelId: string;
  parentMessageId: string;
  threadChannelId: string | null;
  channelName: string | null;
  messages: Message[];
}) {
  const { formatMessage } = useIntl();
  const inWorkspace = useContext(InWorkspaceContext);
  const label = formatMessage({ id: "workspace.thread.open" });
  const open = useCallback(() => {
    const parent = messages.find((m) => m.id === parentMessageId)
      ?? useMessageStore.getState().channelMessages[parentChannelId]?.find((m) => m.id === parentMessageId);
    const text = parent?.content?.replace(/\s+/g, " ").trim() ?? "";
    const title = [channelName ? `#${channelName}` : null, text.slice(0, 24) || null].filter(Boolean).join(" · ");
    useArtifactViewerStore.getState().openThreadTab({ parentChannelId, parentMessageId, threadChannelId }, parentChannelId, title);
    useThreadStore.getState().closeThread();
  }, [channelName, messages, parentChannelId, parentMessageId, threadChannelId]);
  if (inWorkspace || typeof window === "undefined" || window.innerWidth < 768) return null;
  return (
    <Tooltip content={label}>
      <PanelAction onClick={open} aria-label={label} data-testid="thread-open-in-workspace">
        <SquareArrowOutUpRight />
      </PanelAction>
    </Tooltip>
  );
}
