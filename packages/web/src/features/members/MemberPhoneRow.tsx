import { SidebarItem, SidebarItemContent, SidebarItemSubtitle, SidebarItemTitle } from "@botiverse/raft-ui";
import { memo, useCallback, useId } from "react";
import type { ReactNode } from "react";
import { AgentStateMark } from "@botiverse/raft-ui-ext";
import { useAgentNow } from "../team/useAgentNow";
import { useIntl } from "react-intl";
import { MemberEntryAppTag, MemberEntryAvatar, MemberEntryRoleWord, YouSuffix } from "./MemberEntryParts";
import { agentRuntimeFacts } from "./memberEntryFacts";
import { useRuntimeDeprecatedHere } from "../../hooks/useServerRuntimeCatalog";
import { MemberMenuTrigger } from "./MemberMenuTrigger";
import type { MemberEntry } from "./membersPageModel";

/**
 * A member on a phone (raft-design Members › On a phone): the sidebar row the
 * phone's lists of places use, one button that opens the profile. Like the
 * desktop table (Team page PRD §5.2, Figmama 11/16): an agent leads with its
 * state mark and its second line is what it is doing now and its runtime
 * ("Computer offline · Kimi CLI", "Working · 12 min · Codex CLI"); a person
 * leads with a small avatar and has no second line (a Guest: its channel).
 */
export const MemberPhoneRow = memo(function MemberPhoneRow({ entry, isSelf, held, resetsAt, onOpen }: {
  entry: MemberEntry;
  isSelf: boolean;
  /** An agent held by a usage limit (the inbox's notice), and when it resumes. */
  held: boolean;
  resetsAt: string | null;
  onOpen: (entry: MemberEntry) => void;
}) {
  const { formatMessage } = useIntl();
  if (entry.kind === "agent") return <AgentPhoneRow entry={entry} isSelf={isSelf} held={held} resetsAt={resetsAt} onOpen={onOpen} />;
  const second = entry.member.role === "guest" && entry.member.guestChannel
    ? formatMessage({ id: "layout.sidebar.guestChannel" }, { channel: entry.member.guestChannel.name })
    : null;
  return (
    <PhoneRow entry={entry} isSelf={isSelf} lead={<MemberEntryAvatar entry={entry} context="sidebar-list" />} second={second} onOpen={onOpen} />
  );
});

function AgentPhoneRow({ entry, isSelf, held, resetsAt, onOpen }: {
  entry: Extract<MemberEntry, { kind: "agent" }>;
  isSelf: boolean;
  held: boolean;
  resetsAt: string | null;
  onOpen: (entry: MemberEntry) => void;
}) {
  const { formatMessage } = useIntl();
  const deprecatedHere = useRuntimeDeprecatedHere();
  const now = useAgentNow(entry.agent, held ? resetsAt : undefined);
  const { runtime } = agentRuntimeFacts(entry.agent, formatMessage, deprecatedHere);
  const lead = (
    <span className="flex size-4 shrink-0 items-center justify-center" data-testid="member-row-mark">
      <AgentStateMark state={now.mark} label={now.title} />
    </span>
  );
  return <PhoneRow entry={entry} isSelf={isSelf} lead={lead} second={[now.word, runtime].filter(Boolean).join(" · ")} onOpen={onOpen} />;
}

function PhoneRow({ entry, isSelf, lead, second, onOpen }: {
  entry: MemberEntry;
  isSelf: boolean;
  lead: ReactNode;
  second: string | null;
  onOpen: (entry: MemberEntry) => void;
}) {
  const { formatMessage } = useIntl();
  const handleClick = useCallback(() => onOpen(entry), [entry, onOpen]);
  const id = useId();
  const secondText = second;
  return (
    <MemberMenuTrigger
      entry={entry}
      render={<SidebarItem type="button" wrap={Boolean(secondText)} />}
      onClick={handleClick}
      aria-label={formatMessage({ id: "members.page.openProfile" }, { name: entry.name })}
      aria-describedby={secondText ? `${id}-meta ${id}-second` : `${id}-meta`}
      data-testid={`member-row-${entry.id}`}
      data-member-entry-id={entry.id}
      data-slot="sidebar-item"
      className="w-full"
    >
      {lead}
      <SidebarItemContent stacked>
        <span className="flex min-w-0 items-baseline gap-1">
          <SidebarItemTitle data-testid="member-entry-name">{entry.name}</SidebarItemTitle>
          <span id={`${id}-meta`} className="contents">
            {isSelf ? <YouSuffix /> : null}
            <MemberEntryRoleWord entry={entry} className="shrink-0 text-caption font-medium text-foreground-hint" />
            <MemberEntryAppTag entry={entry} className="self-center" />
          </span>
        </span>
        {secondText ? (
          <SidebarItemSubtitle id={`${id}-second`} data-testid="member-row-now">{secondText}</SidebarItemSubtitle>
        ) : null}
      </SidebarItemContent>
    </MemberMenuTrigger>
  );
}
