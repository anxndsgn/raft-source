import { useCallback } from "react";
import { useArtifactViewerStore } from "../../apps/artifacts/artifactViewerStore";
import type { WorkspaceMember } from "../../apps/artifacts/artifactViewerStore";
import { useAgentStore } from "../../store/agentStore";
import { useServerStore } from "../../store/serverStore";

/** Opens a member's details as a workspace tab (Team page PRD §5.2), named after them. */
export function useOpenMemberTab() {
  return useCallback((member: WorkspaceMember) => {
    let title = member.id;
    if (member.type === "agent") {
      const agent = useAgentStore.getState().agents.find((a) => a.id === member.id);
      if (agent) title = agent.displayName || agent.name;
    } else {
      const person = useServerStore.getState().members.find((m) => m.userId === member.id);
      if (person) title = person.displayName || person.name;
    }
    useArtifactViewerStore.getState().openMemberTab(member, title);
  }, []);
}
