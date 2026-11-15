import { useCallback } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useIntl } from "react-intl";
import { getRuntimeDisplayName } from "@botiverse/raft-shared";
import { ListRow, ListRowBody, ListRowChevron, ListRowDescription, ListRowIcon, ListRowMeta, ListRowTitle, ListRowTop, TextLink } from "@botiverse/raft-ui";
import { AgentStateMark } from "@botiverse/raft-ui-ext";
import { ChevronRight } from "lucide-react";
import { useResumeMoment, useShortSpan } from "../../components/task/agentTimeText";
import { useAgentDisplayState } from "../../store/agentStore";
import { useChannelStore } from "../../store/channelStore";
import { findStoredChannel } from "../../store/storedChannel";
import { formatAgentDisplayStateText } from "../../utils/activity";
import { formatRelativeTime } from "../../utils/relativeTime";
import type { TeamAgentRow } from "./useTeamAgents";

/** "#channel · Task #6 · Reading Tabs.tsx": the parts there are, one line. */
function joinParts(parts: ReactNode[]): ReactNode {
  return parts.filter(Boolean).map((part, index) => (
    // eslint-disable-next-line react/no-array-index-key -- the parts are positional and never reorder
    <span key={index} className={index > 0 ? "before:px-1 before:content-['·']" : undefined}>{part}</span>
  ));
}

const MARK_LABEL = {
  working: "team.state.working",
  idle: "team.state.idle",
  offline: "team.state.offline",
  held: "team.state.held",
} as const;

/** A link inside a row (its channel, its task): opens that, not the row. */
function RowLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const click = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    onClick();
  }, [onClick]);
  return (
    // Body color and underlined on hover (T1), so it reads as a link beside the grey step.
    <TextLink variant="strong" render={<button type="button" />} onClick={click} className="font-normal">
      {children}
    </TextLink>
  );
}

/**
 * One agent's line (PRD 团队页 §4–5.1, designs T1/T2): the state mark, the
 * name, and what it is doing — held: when it resumes and what waits on it;
 * working: the channel, the task, the current step and for how long; idle or
 * offline: the last task it finished.
 *
 * `preview` (the Team tab's hover preview): the row opens the work. `page`
 * (the Overview): the row opens the agent, its channel and task are links to
 * the work, and it ends in a chevron, or View for a held one.
 */
export function TeamAgentLine({ row, variant, onOpen, onOpenWork, onOpenChannel, testId }: {
  row: TeamAgentRow;
  variant: "preview" | "page";
  onOpen: (row: TeamAgentRow) => void;
  /** page: the task link. */
  onOpenWork?: (row: TeamAgentRow) => void;
  /** page: the channel link. */
  onOpenChannel?: (channelId: string) => void;
  testId?: string;
}) {
  const intl = useIntl();
  const { formatMessage, locale } = intl;
  const display = useAgentDisplayState(row.agent.id);
  const resumeMoment = useResumeMoment();
  const shortSpan = useShortSpan();
  const task = row.task;
  const channelName = useChannelStore((s) => (task ? findStoredChannel(s, task.channelId)?.name ?? null : null));
  const open = useCallback(() => onOpen(row), [onOpen, row]);
  const openWork = useCallback(() => onOpenWork?.(row), [onOpenWork, row]);
  const openChannel = useCallback(() => { if (task) onOpenChannel?.(task.channelId); }, [onOpenChannel, task]);
  const page = variant === "page";
  const name = row.agent.displayName || row.agent.name;
  const channelText = channelName ? `#${channelName}` : null;
  const taskText = task ? formatMessage({ id: "task.modal.taskWithNumber" }, { taskNumber: task.taskNumber }) : null;
  let title: ReactNode = name;
  let meta: ReactNode = null;
  let description: ReactNode[] = [];
  let descriptionTitle: string | undefined;
  if (row.state === "held" && row.heldByComputer) {
    // Stopped by its computer: why, in its state's own words ("Computer offline").
    const why = formatAgentDisplayStateText(intl, display, { withDetail: false });
    title = page ? formatMessage({ id: "team.blocked.title" }, { name }) : joinParts([name, why]);
    description = [page ? why : null, row.task ? formatMessage({ id: "team.held.waitingTask" }, { number: row.task.taskNumber }) : null];
  } else if (row.state === "held") {
    const moment = resumeMoment(row.resetsAt);
    title = page ? formatMessage({ id: "team.held.title" }, { name }) : joinParts([name, formatMessage({ id: "taskSection.held" })]);
    descriptionTitle = moment?.title;
    description = [
      page && row.provider ? formatMessage({ id: "team.held.usedUp" }, { runtime: getRuntimeDisplayName(row.provider) }) : null,
      moment ? formatMessage({ id: "taskSection.heldUntil" }, { when: moment.when }) : null,
      row.waitingTasks === 1 && task ? formatMessage({ id: "team.held.waitingTask" }, { number: task.taskNumber })
        : row.waitingTasks > 0 ? formatMessage({ id: "team.held.waitingTasks" }, { count: row.waitingTasks }) : null,
    ];
  } else if (row.state === "working") {
    meta = row.startedAt ? shortSpan(row.startedAt) : null;
    description = [
      channelText && page ? <RowLink key="channel" onClick={openChannel}>{channelText}</RowLink> : channelText,
      taskText && page ? <RowLink key="task" onClick={openWork}>{taskText}</RowLink> : taskText,
      display.activityText || null,
    ];
  } else {
    const finished = row.finished;
    const when = finished ? formatRelativeTime(finished.lastActivityAt ?? finished.updatedAt, locale) : null;
    description = [
      formatMessage({ id: MARK_LABEL[row.state] }),
      finished && when ? formatMessage({ id: "team.rest.finished" }, { number: finished.taskNumber, when }) : null,
    ];
  }
  return (
    <ListRow
      variant="default"
      // The page's rows hold links, so the row is not itself a button there.
      render={page ? <div role="button" tabIndex={0} /> : undefined}
      onClick={open}
      // The rule between rows inset to the content on both sides (compact list: the heading's left edge, the time's right).
      className="min-h-0 cursor-pointer px-4 py-2 [--list-row-rule-start:16px] before:right-4 pointer-coarse:min-h-0"
      data-testid={testId}
      data-agent-id={row.agent.id}
      data-state={row.state}
    >
      <ListRowIcon className="w-3 justify-center self-start pt-1">
        <AgentStateMark state={row.state} label={formatMessage({ id: MARK_LABEL[row.state] })} />
      </ListRowIcon>
      <ListRowBody>
        <ListRowTop>
          <ListRowTitle>{title}</ListRowTitle>
          {meta ? <ListRowMeta className="font-mono text-mono-meta">{meta}</ListRowMeta> : null}
        </ListRowTop>
        {description.some(Boolean) ? (
          <ListRowDescription title={descriptionTitle}>{joinParts(description)}</ListRowDescription>
        ) : null}
      </ListRowBody>
      {page ? (
        row.state === "held" ? (
          <span className="shrink-0 text-footnote font-bold text-foreground-muted">{formatMessage({ id: "team.overview.view" })}</span>
        ) : (
          <ListRowChevron><ChevronRight size={16} aria-hidden /></ListRowChevron>
        )
      ) : null}
    </ListRow>
  );
}
