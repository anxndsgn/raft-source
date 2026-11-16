import { useIntl } from "react-intl";
import { ListRow, ListRowBody, ListRowChevron, ListRowDescription, ListRowIcon, ListRowMeta, ListRowTitle, ListRowTop } from "@botiverse/raft-ui";
import { AgentStateMark } from "@botiverse/raft-ui-ext";

import { useMemberNow } from "./memberNow";

/**
 * Team page v2.1 §5.4.1 (anxndsgn 11/16): a member's state in their details' head, after the name — the mark and a
 * short status ("Working · 3 min", "Held · back 23:00", "Idle"); the status gives way first where the head is narrow.
 */
export function MemberHeadNow({ type, id }: { type: "agent" | "human"; id: string }) {
  const { formatMessage } = useIntl();
  const now = useMemberNow(type, id);
  if (!now.mark) return null;
  const label = formatMessage({ id: `team.state.${now.mark}` });
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-footnote font-normal text-foreground-muted" data-testid="member-head-now">
      <AgentStateMark state={now.mark} label={label} />
      {now.short ? <span className="min-w-0 truncate">{now.short}</span> : null}
    </span>
  );
}

/**
 * Layout redesign 7.1, kept on the profile (v2.1 §5.4.1): what an agent is doing now — "Working on task #6 in #test
 * · 12 min" and its current step (opens the task), or held: why and when it resumes.
 */
export function MemberNowRow({ id }: { id: string }) {
  const now = useMemberNow("agent", id);
  // Only what the head's short status can't say: the task and its step, or why it is held and until when.
  if (!now.title || (!now.current && now.mark !== "held")) return null;
  return (
    <div className="px-(--surface-inset) pt-3" data-testid="profile-card-footer">
      <ListRow variant="plain" interactive={!!now.current} onClick={now.current ? now.openCurrent : undefined} className="min-w-0" data-testid="profile-card-current-task">
        {now.mark ? <ListRowIcon className="w-3 justify-center self-start pt-1"><AgentStateMark state={now.mark} /></ListRowIcon> : null}
        <ListRowBody>
          <ListRowTop>
            <ListRowTitle className="whitespace-normal">{now.title}</ListRowTitle>
            {now.mark === "working" && now.startedAt ? <ListRowMeta className="font-mono text-mono-meta">{now.shortSpan(now.startedAt)}</ListRowMeta> : null}
          </ListRowTop>
          {now.step ? <ListRowDescription>{now.step}</ListRowDescription> : null}
        </ListRowBody>
        {now.current ? <ListRowChevron /> : null}
      </ListRow>
    </div>
  );
}
