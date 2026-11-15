import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { ChevronRight } from "lucide-react";
import { TextLink } from "@botiverse/raft-ui";
import { SourceBar, SourceBarActions, SourceBarText } from "@botiverse/raft-ui-ext";

import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useChannelStore } from "../../store/channelStore";
import { useThreadStore } from "../../store/threadStore";
import { WorkspaceTabStrip } from "../../apps/artifacts/WorkspaceTabStrip";
import { findStoredChannel } from "../../store/storedChannel";
import type { WorkspaceThread } from "../../apps/artifacts/artifactViewerStore";
import { AuthenticatedThreadPanel } from "./AuthenticatedThreadPanel";
import { InWorkspaceContext, WorkspaceThreadChannelContext } from "./workspaceThreadContext";

/**
 * Layout redesign §5 (Figmama 11/15): a thread moved into the workspace, a tab like an Artifact's — kept across
 * channels. Its source bar says where it is from and leads back to its message; replies still go to that channel.
 */
export function WorkspaceThreadPanel({ thread, onClose }: { thread: WorkspaceThread; onClose: () => void }) {
  const { formatMessage } = useIntl();
  const nav = useAppNavigate();
  const replies = useThreadStore((s) => s.summaries[thread.parentMessageId]?.replyCount ?? 0);
  const channelName = useChannelStore((s) => findStoredChannel(s, thread.parentChannelId)?.name ?? null);
  const identity = useMemo(() => ({ parentMessageId: thread.parentMessageId, parentChannelId: thread.parentChannelId, threadChannelId: thread.threadChannelId }), [thread.parentChannelId, thread.parentMessageId, thread.threadChannelId]);
  const viewInChannel = useCallback(() => nav.toMessage(thread.parentChannelId, thread.parentMessageId), [nav, thread.parentChannelId, thread.parentMessageId]);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workspace-thread">
      <WorkspaceTabStrip />
      {/* Doc §5 (A): the second row, raft-ui-ext's SourceBar — where it is from, the way back. */}
      <SourceBar data-testid="workspace-thread-source">
        <SourceBarText>
          {formatMessage({ id: replies ? "workspace.thread.fromWithReplies" : "workspace.thread.from" }, { channel: channelName ? `#${channelName}` : "", count: replies })}
        </SourceBarText>
        <SourceBarActions>
          <TextLink render={<button type="button" />} className="inline-flex items-center gap-0.5 text-caption" onClick={viewInChannel} data-testid="workspace-thread-view-in-channel">
            {formatMessage({ id: "message.threadPanel.viewInChannel" })}
            <ChevronRight size={14} aria-hidden />
          </TextLink>
        </SourceBarActions>
      </SourceBar>
      <InWorkspaceContext.Provider value><WorkspaceThreadChannelContext.Provider value={channelName}>
      <AuthenticatedThreadPanel
        edge="inset"
        hideHeader
        onClose={onClose}
        composerAutoFocus={false}
        threadIdentity={identity}
      />
      </WorkspaceThreadChannelContext.Provider></InWorkspaceContext.Provider>
    </div>
  );
}
