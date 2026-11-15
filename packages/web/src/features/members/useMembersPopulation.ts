import { useMemo } from "react";
import { useServerPermissions } from "../../hooks/useServerPermissions";
import { isAgentInMemberLists, useAgentStore } from "../../store/agentStore";
import { useServerStore } from "../../store/serverStore";
import { agentEntry, humanEntry } from "./membersPageModel";
import type { MemberEntry, MembersPopulation } from "./membersPageModel";

/**
 * Who the viewer may see on the Members page and the Team page's head, as the
 * sidebar's Members list decided it: a member of a server that hides its
 * people sees no Humans (nor who made an agent: no By creator); only owners
 * and admins see the guests, among the Humans. One reading for the page and
 * the Team head's counts, so the two never disagree.
 */
export function useMembersPopulation() {
  const hideHumansSetting = useServerStore((s) => s.current?.hideHumansFromMembers === true);
  const members = useServerStore((s) => s.members);
  const membersLoadError = useServerStore((s) => s.membersLoadError);
  const allAgents = useAgentStore((s) => s.agents);
  const agentsLoading = useAgentStore((s) => s.loading);
  const { role } = useServerPermissions();
  const showHumans = !(role === "member" && hideHumansSetting);
  const showGuests = role === "owner" || role === "admin";
  const memberListAgents = useMemo(() => allAgents.filter(isAgentInMemberLists), [allAgents]);
  const population = useMemo<MembersPopulation>(() => {
    const humans: MemberEntry[] = [];
    for (const member of members) {
      if (member.role === "guest" ? showGuests : showHumans) humans.push(humanEntry(member));
    }
    return { humans, agents: memberListAgents.map(agentEntry) };
  }, [memberListAgents, members, showGuests, showHumans]);
  // Members always holds the viewer once it has loaded; agents say so themselves.
  const loading = (members.length === 0 && !membersLoadError) || (agentsLoading && allAgents.length === 0);
  return { population, memberListAgents, showHumans, loading, membersLoadError };
}
