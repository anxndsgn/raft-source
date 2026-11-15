import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { ChevronRight } from "lucide-react";

import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useChannelStore } from "../../store/channelStore";
import { useThreadStore } from "../../store/threadStore";
import { WorkspaceTabStrip } from "../../apps/artifacts/WorkspaceTabStrip";
import { findStoredChannel } from "../../store/storedChannel";
import type { WorkspaceThread } from "../../apps/artifacts/artifactViewerStore";
import { AuthenticatedThreadPanel } from "./AuthenticatedThreadPanel";
import { InWorkspaceContext } from "./workspaceThreadContext";

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
      {/* Doc §5 (A): the second row — where it is from on the left, the way back on the right; no head of its own. */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line-seam px-4 text-footnote text-foreground-muted md:pointer-fine:h-panel-header" data-testid="workspace-thread-source">
        <span className="min-w-0 flex-1 truncate">
          {formatMessage({ id: replies ? "workspace.thread.fromWithReplies" : "workspace.thread.from" }, { channel: channelName ? `#${channelName}` : "", count: replies })}
        </span>
        <button type="button" className="inline-flex shrink-0 items-center gap-0.5 rounded-control px-1 py-0.5 text-foreground hover:overlay-subtle" onClick={viewInChannel} data-testid="workspace-thread-view-in-channel">
          {formatMessage({ id: "message.threadPanel.viewInChannel" })}
          <ChevronRight size={14} aria-hidden />
        </button>
      </div>
      <InWorkspaceContext.Provider value>
      <AuthenticatedThreadPanel
        edge="inset"
        hideHeader
        onClose={onClose}
        composerAutoFocus={false}
        threadIdentity={identity}
      />
      </InWorkspaceContext.Provider>
    </div>
  );
}
