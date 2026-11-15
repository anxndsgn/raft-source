import { Suspense, useCallback, useMemo } from "react";
import { lazyPanel } from "../../boot/deferredUi";
import { WorkspaceTabStrip } from "../../apps/artifacts/WorkspaceTabStrip";
import type { WorkspaceMember } from "../../apps/artifacts/artifactViewerStore";
import type { ProfilePanelProps } from "../../components/profile/ProfilePanel";
import { ProfileCardFooter } from "../../components/message/ProfileCardFooter";
import { PanelHeadBelowContext, PanelHeadHiddenContext } from "../../components/ui/panelBackCrumb";
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
  const strip = useMemo(() => <ProfileCardFooter type={member.type} id={member.id} />, [member.id, member.type]);
  const openProfile = useCallback((type: "agent" | "human", id: string) => openMemberTab({ type, id }), [openMemberTab]);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workspace-member">
      <WorkspaceTabStrip />
      {/* No head row of its own (the tab names it); under where it was, the side panel's strip: what they are
          doing now and Message (ProfileCardFooter, as ChannelMembers gives it). */}
      <PanelHeadHiddenContext.Provider value><PanelHeadBelowContext.Provider value={strip}>
        <Suspense fallback={null}>
          <ProfilePanel target={member} presentation="embedded" onClose={onClose} onOpenProfile={openProfile} />
        </Suspense>
      </PanelHeadBelowContext.Provider></PanelHeadHiddenContext.Provider>
    </div>
  );
}
