import { Suspense, useCallback } from "react";
import { lazyPanel } from "../../boot/deferredUi";
import { WorkspaceTabStrip } from "../../apps/artifacts/WorkspaceTabStrip";
import type { WorkspaceMember } from "../../apps/artifacts/artifactViewerStore";
import type { ProfilePanelProps } from "../../components/profile/ProfilePanel";
import { useOpenMemberTab } from "./useOpenMemberTab";

const ProfilePanel = lazyPanel<ProfilePanelProps>(() => import("../../components/profile/ProfilePanel"));

/**
 * Team page PRD §5.2/5.4 (T3): a person's or an agent's details in the
 * workspace, a tab beside the others — the very component the side panel
 * opens for a member in a channel (layout redesign 7.1), not a second one:
 * its head, what it is doing and Message, then its tabs. A creator or an
 * agent it made opens as its own tab.
 */
export function WorkspaceMemberPanel({ member, onClose }: { member: WorkspaceMember; onClose: () => void }) {
  const openMemberTab = useOpenMemberTab();
  const openProfile = useCallback((type: "agent" | "human", id: string) => openMemberTab({ type, id }), [openMemberTab]);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workspace-member">
      <WorkspaceTabStrip />
      <Suspense fallback={null}>
        <ProfilePanel target={member} presentation="embedded" onClose={onClose} onOpenProfile={openProfile} />
      </Suspense>
    </div>
  );
}
