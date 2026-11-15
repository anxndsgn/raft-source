import { useCallback } from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { ListRow, ListRowBody, ListRowDescription, ListRowIcon, ListRowMeta, ListRowTitle, ListRowTop } from "@botiverse/raft-ui";
import { AgentStateMark } from "@botiverse/raft-ui-ext";
import { useResumeMoment, useShortSpan } from "../../components/task/agentTimeText";
import { useAgentDisplayState } from "../../store/agentStore";
import { useChannelStore } from "../../store/channelStore";
import { findStoredChannel } from "../../store/storedChannel";
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

/**
 * One agent's line (PRD 团队页 §4–5.1, designs T1/T2): the state mark, the
 * name, and what it is doing — held: when it resumes and what waits on it;
 * working: the channel, the task, the current step and for how long.
 */
export function TeamAgentLine({ row, onOpen, testId }: {
  row: TeamAgentRow;
  onOpen: (row: TeamAgentRow) => void;
  testId?: string;
}) {
  const { formatMessage } = useIntl();
  const display = useAgentDisplayState(row.agent.id);
  const resumeMoment = useResumeMoment();
  const shortSpan = useShortSpan();
  const task = row.task;
  const channelName = useChannelStore((s) => (task ? findStoredChannel(s, task.channelId)?.name ?? null : null));
  const open = useCallback(() => onOpen(row), [onOpen, row]);
  const name = row.agent.displayName || row.agent.name;
  let title: ReactNode = name;
  let meta: ReactNode = null;
  let description: ReactNode[] = [];
  let descriptionTitle: string | undefined;
  if (row.state === "held") {
    const moment = resumeMoment(row.resetsAt);
    title = joinParts([name, formatMessage({ id: "taskSection.held" })]);
    descriptionTitle = moment?.title;
    description = [
      moment ? formatMessage({ id: "taskSection.heldUntil" }, { when: moment.when }) : null,
      row.waitingTasks === 1 && task ? formatMessage({ id: "team.held.waitingTask" }, { number: task.taskNumber })
        : row.waitingTasks > 0 ? formatMessage({ id: "team.held.waitingTasks" }, { count: row.waitingTasks }) : null,
    ];
  } else if (row.state === "working") {
    meta = row.startedAt ? shortSpan(row.startedAt) : null;
    description = [
      channelName ? `#${channelName}` : null,
      task ? formatMessage({ id: "task.modal.taskWithNumber" }, { taskNumber: task.taskNumber }) : null,
      display.activityText || null,
    ];
  }
  return (
    <ListRow
      variant="default"
      onClick={open}
      // The rule between rows inset to the content on both sides (compact list: the heading's left edge, the time's right).
      className="min-h-0 px-4 py-2 [--list-row-rule-start:16px] before:right-4 pointer-coarse:min-h-0"
      data-testid={testId}
      data-agent-id={row.agent.id}
      data-state={row.state}
    >
      <ListRowIcon className="self-start pt-1">
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
    </ListRow>
  );
}
