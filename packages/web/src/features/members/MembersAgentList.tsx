import { ListRow, ListRowBody, ListRowGroup, ListRowIcon, ListRowMeta, ListRowSubtitle, ListRowTitle, Skeleton } from "@botiverse/raft-ui";
import { AgentStateMark } from "@botiverse/raft-ui-ext";
import { useAgentNow } from "../team/useAgentNow";
import { memo, useCallback, useId } from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import StatusDot from "../../components/ui/StatusDot";
import { SkeletonTextBar } from "../../components/ui/Skeleton";
import type { MessageId } from "../../i18n/messages/en";
import type { Machine } from "../../store/machineStore";
import { MemberEntryAppTag, MemberEntryAvatar, MemberEntryRoleWord, YouSuffix } from "./MemberEntryParts";
import { agentReasoningEffortFact, agentRuntimeFacts } from "./memberEntryFacts";
import { useRuntimeDeprecatedHere } from "../../hooks/useServerRuntimeCatalog";
import { MemberMenuTrigger } from "./MemberMenuTrigger";
import { MEMBER_ROW_MIN_H } from "./memberRowHeights";
import { CELL, HEADING_LABEL } from "./membersAgentColumns";
import type { MemberEntry } from "./membersPageModel";

// The columns' tracks, shared by the heading row and every row so they line
// up. Status is as wide as its longest short presence word in this locale
// (StatusColumn), so none is ever cut; Model
// has the most room, for names like "DeepSeek V4 Pro · DeepSeek"; Reasoning
// fits its longest level ("Extra high"). A value cut short shows whole in its
// title. Below 760px of list width the runtime, model and computer fold into
// one mono line under the description; Status stays a column. Reasoning needs
// 1040px of list, as the usage view's Model: at 760px its 96px took the name's
// last room (nothing left for name and description until ~830px, a 23-letter
// name ran into Status until ~1010px), so below 1040px it just hides (a bare
// level in the folded line would say nothing; the profile has it).
const COL_RUNTIME = "hidden w-[104px] shrink-0 @[760px]/members-list:flex";
const COL_MODEL = "hidden w-[176px] shrink-0 @[760px]/members-list:flex";
const COL_REASONING = "hidden w-[96px] shrink-0 @[1040px]/members-list:flex";
const COL_COMPUTER = "hidden w-[136px] shrink-0 @[760px]/members-list:flex";
// The usage view (MembersAgentUsage) has more columns: its Model needs 1040px
// of list, below which it folds under the name with the runtime.
const COL_USAGE_MODEL = "hidden w-[176px] shrink-0 @[1040px]/members-list:flex";

// The name line: the name, then the role word and the app tag on its baseline.
const NAME_LINE = "flex min-w-0 items-baseline gap-2";

// The short presence words a Status cell can say (the column's sizer): an
// agent's activity, "Likely online" before its state arrives, a paused assistant.
const STATUS_WORD_IDS: readonly MessageId[] = [
  "activity.status.online",
  "activity.status.likelyOnline",
  "activity.status.thinkingEllipsis",
  "activity.status.workingEllipsis",
  "activity.status.error",
  "activity.status.offline",
  "assistant.paused.chip",
];

/**
 * A Status cell, or its heading: as wide as the light, its gap and the
 * longest status word in this locale, the same in every row, so the column
 * lines up and "Thinking…" (「思考中…」) is never cut. Every word sits
 * invisible in one grid cell under the visible content (a CSS sizer; no
 * measuring). A block ("Computer access revoked…") is a sentence, not a word:
 * it alone may truncate, whole in its title. The visible content comes first:
 * a grid takes its baseline from its first item, so the heading's "Status"
 * lines up with Runtime, Model and Computer on the heading row's baseline,
 * not with the sizer's larger type.
 */
function StatusColumn({ children, id, testId, role }: { children: ReactNode; id?: string; testId?: string; role?: "columnheader" }) {
  const { formatMessage } = useIntl();
  // The Team page's longer states (PRD §5.2): how long one has worked, a held one's reason and when it resumes.
  const longest = [
    formatMessage({ id: "taskSection.workingFor" }, { minutes: 88 }),
    `${formatMessage({ id: "taskSection.held" })} · ${formatMessage({ id: "taskSection.heldUntil" }, { when: "00:00" })}`,
  ];
  return (
    // Every row's column the sizer's width, its content from the start, a longer one cut (whole in its title).
    <span id={id} role={role} className="grid shrink-0 grid-cols-[minmax(0,1fr)]" data-testid={testId}>
      <span className="col-start-1 row-start-1 flex min-w-0 items-center justify-start overflow-hidden">{children}</span>
      <span aria-hidden className="invisible col-start-1 row-start-1 flex gap-2 text-caption" data-status-sizer="">
        <span className="w-2.5 shrink-0" />
        <span className="grid">
          {STATUS_WORD_IDS.map((wordId) => (
            <span key={wordId} className="col-start-1 row-start-1 whitespace-nowrap">{formatMessage({ id: wordId })}</span>
          ))}
          {longest.map((text) => (
            <span key={text} className="col-start-1 row-start-1 whitespace-nowrap">{text}</span>
          ))}
        </span>
      </span>
    </span>
  );
}

function Fact({ id, value, className, testId }: { id?: string; value: string | null; className: string; testId?: string }) {
  return (
    <span id={id} className={`${className} ${CELL}`} data-testid={testId}>
      {value ? <ListRowMeta title={value}>{value}</ListRowMeta> : <ListRowMeta>—</ListRowMeta>}
    </span>
  );
}

/** A row's usage figures, in the usage view: its cells, and a line under the name when its Computer sends no usage. */
export interface AgentRowUsage {
  cells: ReactNode;
  note: ReactNode;
}

const AgentRow = memo(function AgentRow({ entry, machine, showComputer, selected, usage, held, resetsAt, onOpen }: {
  entry: Extract<MemberEntry, { kind: "agent" }>;
  /** Open in the side panel: ListRow's own selected state (info-soft, no hover). */
  selected: boolean;
  /** The agent's computer, from the page's one lookup. */
  machine: Machine | undefined;
  showComputer: boolean;
  /** The usage view's cells in place of Runtime, Model and Computer. */
  usage?: AgentRowUsage;
  /** Held by a usage limit (the inbox's notice), and when it resumes. */
  held: boolean;
  resetsAt: string | null;
  onOpen: (entry: MemberEntry) => void;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const deprecatedHere = useRuntimeDeprecatedHere();
  const { agent } = entry;
  const handleClick = useCallback(() => onOpen(entry), [entry, onOpen]);
  const id = useId();
  // What it is doing now, in the Team surfaces' one writing (useAgentNow): the mark and the short words.
  const { mark, word: statusWord, title: statusText } = useAgentNow(agent, held ? resetsAt : undefined);
  const { runtime, model } = agentRuntimeFacts(agent, formatMessage, deprecatedHere);
  const reasoning = agentReasoningEffortFact(agent, formatMessage);
  const folded = usage
    ? [model, runtime].filter(Boolean).join(" · ")
    : [runtime, model, showComputer ? machine?.name : null].filter(Boolean).join(" · ");
  const describedBy = (usage
    ? [`${id}-meta`, agent.description ? `${id}-desc` : null, `${id}-status`, `${id}-model`, `${id}-usage`]
    : [
      `${id}-meta`,
      agent.description ? `${id}-desc` : null,
      `${id}-status`,
      `${id}-runtime`,
      `${id}-model`,
      reasoning ? `${id}-reasoning` : null,
      showComputer ? `${id}-computer` : null,
    ]).filter(Boolean).join(" ");
  return (
    <MemberMenuTrigger
      entry={entry}
      render={<ListRow selected={selected} />}
      aria-current={selected ? "true" : undefined}
      onClick={handleClick}
      aria-label={formatMessage({ id: "members.page.openProfile" }, { name: entry.name })}
      aria-describedby={describedBy}
      data-testid={`members-agent-row-${agent.id}`}
      data-member-entry-id={agent.id}
      // Every row the height of one with a description (12 + 22 + 2 + 18 + 12 with a mouse),
      // the name centred on its cells when there is none, as every cell is.
      className={MEMBER_ROW_MIN_H}
    >
      {/* The row leads with the agent's state mark (Team page PRD §5.2, T3; working-agents.md › The state mark). */}
      <ListRowIcon className="w-3 justify-center" data-testid="members-agent-mark">
        <AgentStateMark state={mark} label={statusText} />
      </ListRowIcon>
      <ListRowBody>
        <span className={NAME_LINE}>
          <ListRowTitle className="min-w-[3ch] flex-none" data-testid="member-entry-name">{entry.name}</ListRowTitle>
          <span id={`${id}-meta`} className="contents">
            <MemberEntryRoleWord entry={entry} className="shrink-0 text-caption font-medium text-foreground-hint" />
            <MemberEntryAppTag entry={entry} className="self-center" />
          </span>
        </span>
        {agent.description ? (
          <ListRowSubtitle id={`${id}-desc`} title={agent.description} data-testid="member-entry-description">
            {agent.description}
          </ListRowSubtitle>
        ) : null}
        {folded ? (
          <ListRowMeta className={usage ? "@[1040px]/members-list:hidden" : "@[760px]/members-list:hidden"} aria-hidden>
            {folded}
          </ListRowMeta>
        ) : null}
        {usage?.note}
      </ListRowBody>
      {/* The presence word with its light (Identity and presence), as the agent's profile says it. */}
      <StatusColumn id={`${id}-status`} testId={`members-agent-status-${agent.id}`}>
        <span className={`flex ${CELL} text-caption text-foreground-muted`}>
          <span className="truncate" title={statusText} data-testid="members-agent-status-word">{statusWord}</span>
        </span>
      </StatusColumn>
      {usage ? (
        <>
          <Fact id={`${id}-model`} value={model} className={COL_USAGE_MODEL} />
          <span id={`${id}-usage`} className="contents">{usage.cells}</span>
        </>
      ) : null}
      {usage ? null : <Fact id={`${id}-runtime`} value={runtime} className={COL_RUNTIME} />}
      {usage ? null : <Fact id={`${id}-model`} value={model} className={COL_MODEL} />}
      {usage ? null : (
        <>
          {/* The level alone ("High") says nothing read out of its column: the row's description says what it is. */}
          {reasoning ? <span id={`${id}-reasoning`} hidden>{formatMessage({ id: "members.page.reasoningEffortDescription" }, { level: reasoning })}</span> : null}
          <Fact value={reasoning} className={COL_REASONING} testId={`members-agent-reasoning-${agent.id}`} />
        </>
      )}
      {showComputer && !usage ? (
        // The computer's name with its own light; a dash for an agent on no computer.
        <span id={`${id}-computer`} className={`${COL_COMPUTER} ${CELL}`} data-testid={`members-agent-computer-${agent.id}`}>
          {machine ? (
            <>
              <StatusDot presence={machine.status === "online" ? "online" : "offline"} className="shrink-0" data-testid="members-agent-computer-light" />
              <ListRowMeta title={machine.name}>{machine.name}</ListRowMeta>
            </>
          ) : <ListRowMeta>—</ListRowMeta>}
        </span>
      ) : null}
    </MemberMenuTrigger>
  );
});

/**
 * A person's row in the same table (Team page PRD §5.2): no state mark (people
 * report no presence), the name and role word, the description, and the
 * agent-only cells (status, runtime, model, computer) left empty.
 */
/** A person's row with one line (no description), with a mouse on a desktop: 44 high, its name and role on it. */
const HUMAN_ROW_ONE_LINE = "md:pointer-fine:min-h-11! md:pointer-fine:py-0!";

const HumanRow = memo(function HumanRow({ entry, isSelf, showComputer, selected, onOpen }: {
  entry: Extract<MemberEntry, { kind: "human" }>;
  isSelf: boolean;
  showComputer: boolean;
  selected: boolean;
  onOpen: (entry: MemberEntry) => void;
}) {
  const { formatMessage } = useIntl();
  const handleClick = useCallback(() => onOpen(entry), [entry, onOpen]);
  const { member } = entry;
  return (
    <MemberMenuTrigger
      entry={entry}
      render={<ListRow selected={selected} />}
      aria-current={selected ? "true" : undefined}
      onClick={handleClick}
      aria-label={formatMessage({ id: "members.page.openProfile" }, { name: entry.name })}
      data-testid={`members-human-row-${member.userId}`}
      data-member-entry-id={member.userId}
      // Layout changes (Figmama 11/21): with a mouse a person with no description is one line, 44 high.
      className={member.description ? MEMBER_ROW_MIN_H : `${MEMBER_ROW_MIN_H} ${HUMAN_ROW_ONE_LINE}`}
    >
      {/* No presence for people: their small avatar where an agent's state mark is (Anna 11/16). */}
      <ListRowIcon className="w-3 justify-center" aria-hidden>
        <MemberEntryAvatar entry={entry} context="preview-mini" />
      </ListRowIcon>
      <ListRowBody>
        <span className={NAME_LINE}>
          <ListRowTitle className="min-w-[3ch] flex-none" data-testid="member-entry-name">{entry.name}</ListRowTitle>
          {isSelf ? <YouSuffix /> : null}
          <MemberEntryRoleWord entry={entry} className="shrink-0 text-caption font-medium text-foreground-hint" />
        </span>
        {member.description ? (
          <ListRowSubtitle title={member.description} data-testid="member-entry-description">{member.description}</ListRowSubtitle>
        ) : null}
      </ListRowBody>
      <StatusColumn><span className={`${CELL} text-caption text-foreground-muted`}>—</span></StatusColumn>
      <span className={`${COL_RUNTIME} ${CELL}`} />
      <span className={`${COL_MODEL} ${CELL}`} />
      {showComputer ? <span className={`${COL_COMPUTER} ${CELL}`} /> : null}
    </MemberMenuTrigger>
  );
});

/**
 * An agent's row while the Agents tab loads: AgentRow's own ListRow at the
 * member row's height (MEMBER_ROW_MIN_H, 66px with a mouse), the list-row
 * avatar's 35px box, and bars in its name line and description line, so the
 * rows land where these were (#proj-raft-ui:#231).
 */
export function AgentRowSkeleton() {
  return (
    <ListRow interactive={false} render={<div />} className={MEMBER_ROW_MIN_H} aria-hidden="true" data-skeleton="">
      <Skeleton className="size-[35px] shrink-0" />
      <ListRowBody>
        <span className={NAME_LINE}>
          <ListRowTitle className="min-w-[3ch] flex-none"><SkeletonTextBar className="w-28" /></ListRowTitle>
        </span>
        <ListRowSubtitle><SkeletonTextBar className="w-64 max-w-full" /></ListRowSubtitle>
      </ListRowBody>
    </ListRow>
  );
}

/**
 * One group of the Agents tab (raft-design Members › Agents as a list): a
 * raft-ui ListRowGroup, one ListRow per agent, with Status, Runtime, Model,
 * Reasoning and Computer columns, or in the usage view Status, Model and the usage columns.
 * The column cells and their heading are hand-rolled: the DS has no column
 * part for ListRow yet (an upstream raft-ui candidate), and the Computers list
 * draws its own the same way (mono meta in hint).
 */
export function MembersAgentGroup({ heading, entries, machinesById, showComputer, showColumnHeadings, openKey, selfId, resetsAtByAgent, usage, onOpen }: {
  heading: ReactNode;
  /** `agent:<id>` of the profile open in the side panel. */
  openKey: string | null;
  entries: MemberEntry[];
  machinesById: ReadonlyMap<string, Machine>;
  showComputer: boolean;
  showColumnHeadings: boolean;
  /** The viewer, marked "(you)" among the people. */
  selfId?: string;
  /** Agents held by a usage limit, and when each resumes. */
  resetsAtByAgent?: ReadonlyMap<string, string | null>;
  /** The usage view: each agent's cells (its headings are MembersAgentUsageHeadings, above the groups). */
  usage?: { row: (agentId: string) => AgentRowUsage };
  onOpen: (entry: MemberEntry) => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <section className="@container/members-list flex min-w-0 flex-col" data-testid="members-agent-group">
      {heading || showColumnHeadings ? (
        // The column headings ride on the group's heading line, on the rows'
        // tracks: the same margin, edge and padding as the group and its rows.
        <div className="mx-5 flex min-w-0 items-baseline gap-3 border-x border-transparent pt-4 pr-4 md:pointer-fine:border-x-0 md:pointer-fine:pr-0">
          <div className="min-w-0 flex-1">{heading}</div>
          {showColumnHeadings ? (
            <>
              <StatusColumn><span className={HEADING_LABEL}>{formatMessage({ id: "members.page.column.status" })}</span></StatusColumn>
              <span className={`${COL_RUNTIME} ${HEADING_LABEL}`}>{formatMessage({ id: "members.page.column.runtime" })}</span>
              <span className={`${COL_MODEL} ${HEADING_LABEL}`}>{formatMessage({ id: "members.page.column.model" })}</span>
              {/* A long locale's word ("Глубина рассуждений") is cut short, whole in its title. */}
              <span className={`${COL_REASONING} ${HEADING_LABEL}`}>
                <span className="min-w-0 truncate" title={formatMessage({ id: "members.page.column.reasoningEffort" })}>{formatMessage({ id: "members.page.column.reasoningEffort" })}</span>
              </span>
              {showComputer ? <span className={`${COL_COMPUTER} ${HEADING_LABEL}`}>{formatMessage({ id: "members.page.column.computer" })}</span> : null}
            </>
          ) : null}
        </div>
      ) : null}
      {/* C21: with a mouse the members table has no card around it. */}
      {/* Layout changes C (11/21): with a mouse the rows' content sits on the reading column's edges, their hover 12
          past them. */}
      <ListRowGroup className="mx-5 mt-2 md:pointer-fine:rounded-none md:pointer-fine:border-0 md:pointer-fine:mx-2 md:pointer-fine:*:px-3!">
        {entries.map((entry) => entry.kind === "agent" ? (
          <AgentRow
            key={entry.id}
            entry={entry}
            machine={entry.agent.machineId ? machinesById.get(entry.agent.machineId) : undefined}
            showComputer={showComputer}
            selected={openKey === `agent:${entry.id}`}
            usage={usage?.row(entry.id)}
            held={resetsAtByAgent?.has(entry.id) ?? false}
            resetsAt={resetsAtByAgent?.get(entry.id) ?? null}
            onOpen={onOpen}
          />
        ) : usage ? null : (
          <HumanRow
            key={entry.id}
            entry={entry}
            isSelf={entry.id === selfId}
            showComputer={showComputer}
            selected={openKey === `human:${entry.id}`}
            onOpen={onOpen}
          />
        ))}
      </ListRowGroup>
    </section>
  );
}

/**
 * The usage view's column headings, one line above its groups (so the name
 * sorts in a grouped list too), on the rows' tracks. A header row of its own
 * table: the rows are buttons (ListRow) that can't be table rows, so each of
 * their cells also names its column for a screen reader (MembersAgentUsage).
 */
export function MembersAgentUsageHeadings({ label, name, headings }: {
  /** The table's accessible name. */
  label: string;
  /** The Agent heading, at the name's track. */
  name: ReactNode;
  /** The usage columns' headings, each a columnheader. */
  headings: ReactNode;
}) {
  const { formatMessage } = useIntl();
  return (
    <div role="table" aria-label={label} className="@container/members-list min-w-0" data-testid="members-usage-headings">
      {/* Centred, not on the baseline: a heading that sorts is a button, which centres its label. */}
      <div role="row" className="mx-5 flex min-w-0 items-center gap-3 border-x border-transparent pt-4 pr-4 md:pointer-fine:border-x-0 md:pointer-fine:pr-0">
        <div className="min-w-0 flex-1">{name}</div>
        <StatusColumn role="columnheader"><span className={HEADING_LABEL}>{formatMessage({ id: "members.page.column.status" })}</span></StatusColumn>
        <span role="columnheader" className={`${COL_USAGE_MODEL} ${HEADING_LABEL}`}>{formatMessage({ id: "members.page.column.model" })}</span>
        {headings}
      </div>
    </div>
  );
}
