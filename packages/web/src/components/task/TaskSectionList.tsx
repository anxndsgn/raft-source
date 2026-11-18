import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button, TaskStatusIcon } from "@botiverse/raft-ui";
import { AgentStateMark, TaskSectionRow } from "@botiverse/raft-ui-ext";
import type { AgentState } from "@botiverse/raft-ui-ext";
import { agentMarkState } from "../../features/team/teamWorking";

import { useAgentDisplayState } from "../../store/agentStore";
import { useLiveAgentActivityStore } from "../../store/liveAgentActivityStore";
import { useTaskStore } from "../../store/taskStore";
import type { Task, TaskStatus } from "../../store/taskStore";
import { currentTimeMs } from "@botiverse/raft-shared";
import { TaskAssigneeLabel, useTaskAssigneeIdentity } from "./TaskAssignee";
import { useUsageLimitAttention } from "../layout/useUsageLimitAttention";
import { useTimeFormatter } from "../../hooks/useTimeFormatter";
import { shortSpan, useResumeMoment } from "./agentTimeText";
import { TASK_STATUS_UI, toRuiTaskStatus } from "./taskStatusUi";

/** raft-design tasks.md (anxndsgn 11/15): what waits on the person first, then the work moving, then what waits,
 *  then what is over (Done holds Closed). A channel that uses replies has no review step. */
type SectionGroup = "in_review" | "in_progress" | "todo" | "backlog" | "done";
const GROUPS: SectionGroup[] = ["in_review", "in_progress", "todo", "backlog", "done"];
const INITIALLY_COLLAPSED: Record<SectionGroup, boolean> = { in_review: false, in_progress: false, todo: false, backlog: true, done: true };
const STALE_MS = 3 * 24 * 60 * 60 * 1000;

const groupOf = (status: TaskStatus): SectionGroup => (status === "closed" ? "done" : status);

/** The Tasks section's list: grouped by what the person has to do with them, two-line rows (TaskSectionRow). */
export function TaskSectionList({ tasks, replyMode, viewerId, openTaskId, onOpenTask }: {
  tasks: Task[];
  replyMode: boolean;
  viewerId: string | null;
  openTaskId: string | null;
  onOpenTask: (task: Task) => void;
}) {
  const [collapsed, setCollapsed] = useState(INITIALLY_COLLAPSED);
  // Held by a usage limit (the server's attention incidents): when each agent is back (Anna 11/15). One read here.
  const usage = useUsageLimitAttention();
  const resetsAtByAgent = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const n of usage.notifications) for (const id of n.affectedAgentIds) map.set(id, n.resetsAt);
    return map;
  }, [usage.notifications]);
  const toggle = useCallback((group: SectionGroup) => setCollapsed((prev) => ({ ...prev, [group]: !prev[group] })), []);
  const byGroup = useMemo(() => {
    const groups: Record<SectionGroup, Task[]> = { in_review: [], in_progress: [], todo: [], backlog: [], done: [] };
    for (const task of tasks) groups[groupOf(task.status)].push(task);
    for (const group of GROUPS) groups[group].sort((a, b) => b.taskNumber - a.taskNumber);
    return groups;
  }, [tasks]);
  return (
    <div className="flex flex-col">
      {GROUPS.filter((g) => byGroup[g].length > 0 && !(g === "in_review" && replyMode)).map((group, index) => (
        <section key={group} data-testid={`channel-tasks-group-${group}`}>
          <SectionHeading group={group} count={byGroup[group].length} collapsed={collapsed[group]} first={index === 0} onToggle={toggle} />
          {collapsed[group] ? null : byGroup[group].map((task) => (
            <SectionTaskRow key={task.id} task={task} viewerId={viewerId} selected={task.id === openTaskId} onOpen={onOpenTask} resetsAtByAgent={resetsAtByAgent} />
          ))}
        </section>
      ))}
    </div>
  );
}

function SectionHeading({ group, count, collapsed, first, onToggle }: { group: SectionGroup; count: number; collapsed: boolean; first: boolean; onToggle: (group: SectionGroup) => void }) {
  const { formatMessage } = useIntl();
  const toggle = useCallback(() => onToggle(group), [group, onToggle]);
  const label = formatMessage({ id: group === "in_review" ? "taskSection.group.forReview" : TASK_STATUS_UI[group].labelId });
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-label={formatMessage({ id: collapsed ? "task.status.showGroup" : "task.status.hideGroup" }, { status: label })}
      // The section header's spacing (tasks.md): 16px above the words, 6px below, a 40px box; by touch 44px.
      className={`group relative flex h-10 w-full items-end px-(--column-margin,16px) pb-1.5 text-left text-footnote text-foreground-muted outline-none after:absolute after:inset-x-0 after:-top-1 after:bottom-0 after:content-[''] md:pointer-fine:after:top-0 hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-ink ${first ? "md:pointer-fine:h-auto md:pointer-fine:pt-[7px]" : ""}`}
      data-testid={`channel-tasks-heading-${group}`}
    >
      <span className="flex items-center gap-1.5">
        {/* Raft redesign: every group, For review too, leads with its status pixel (its yellow is review's). */}
        <TaskStatusIcon status={toRuiTaskStatus(group)} className="size-2.5 shrink-0" />
        <span>{label}</span>
        <span className="text-foreground-hint tabular-nums">{count}</span>
        {collapsed ? <ChevronRight className="size-3.5 text-foreground-hint group-hover:text-foreground" /> : <ChevronDown className="size-3.5 text-foreground-hint group-hover:text-foreground" />}
      </span>
    </button>
  );
}

function SectionTaskRow({ task, viewerId, selected, onOpen, resetsAtByAgent }: { task: Task; viewerId: string | null; selected: boolean; onOpen: (task: Task) => void; resetsAtByAgent: Map<string, string | null> }) {
  const { formatMessage } = useIntl();
  const { formatMediumDateTime } = useTimeFormatter();
  const { identity } = useTaskAssigneeIdentity(task);
  const open = useCallback(() => onOpen(task), [onOpen, task]);
  const movedAt = task.lastActivityAt ?? task.activityAt ?? task.updatedAt;
  const stale = !!movedAt && currentTimeMs() - Date.parse(movedAt) > STALE_MS && task.status !== "done" && task.status !== "closed";
  const live = useLiveState(task, resetsAtByAgent);
  const state = useMemo(() => [
    <span key="n" className="text-foreground-hint tabular-nums">{formatMessage({ id: "taskDetail.number" }, { number: task.taskNumber })}</span>,
    task.claimedById ? <TaskAssigneeLabel key="a" task={task} identity={identity} viewerId={viewerId} /> : (
      <span key="u">{formatMessage({ id: "taskSection.unclaimed" }, { name: task.createdByName ?? "" })}</span>
    ),
    live.text ? <span key="s" title={live.title} className={live.warning ? "inline-flex items-center gap-1 text-warning-strong" : "inline-flex items-center gap-1"}><AgentStateMark state={live.mark} />{live.text}</span> : null,
  ], [formatMessage, identity, live.mark, live.text, live.title, live.warning, task, viewerId]);
  return (
    <TaskSectionRow
      status={<TaskStatusIcon status={toRuiTaskStatus(task.status)} className="size-2.5" />}
      title={task.title}
      openLabel={formatMessage({ id: "taskSection.open" }, { number: task.taskNumber, title: task.title })}
      onOpen={open}
      selected={selected}
      state={state}
      step={live.step}
      time={movedAt ? <span className={stale ? "text-warning-strong" : undefined} title={formatMediumDateTime(movedAt)}>{shortSpan(Date.parse(movedAt), formatMessage)}</span> : null}
      action={<RowAction task={task} viewerId={viewerId} />}
      data-testid={`channel-task-row-${task.taskNumber}`}
    />
  );
}

/** An agent's task: working (for how long, its step) or held (a usage limit, its computer offline). */
function useLiveState(task: Task, resetsAtByAgent: Map<string, string | null>): { text: string | null; warning: boolean; mark: AgentState; step: string | null; title?: string } {
  const { formatMessage } = useIntl();
  const resumeMoment = useResumeMoment();
  const agentId = task.claimedByType === "agent" ? task.claimedById ?? "" : "";
  const display = useAgentDisplayState(agentId);
  const startedAt = useLiveAgentActivityStore((s) => (agentId ? s.items.find((i) => i.agentId === agentId && i.idleSince === null)?.startedAt ?? null : null));
  if (!agentId || task.status !== "in_progress") return { text: null, warning: false, mark: "idle", step: null };
  if (resetsAtByAgent.has(agentId)) {
    const moment = resumeMoment(resetsAtByAgent.get(agentId));
    return { text: moment ? formatMessage({ id: "taskSection.heldUntil" }, { when: moment.when }) : formatMessage({ id: "taskSection.held" }), warning: true, mark: "held", step: null, title: moment?.title };
  }
  if (display.blocked || display.activityErrorCode === "usage_limit" || display.activity === "error") {
    // The mark by the one rule (agentMarkState): a usage limit is held, a stopped computer offline.
    return { text: display.activityText || formatMessage({ id: "taskSection.held" }), warning: true, mark: agentMarkState(display) === "held" ? "held" : "offline", step: null };
  }
  if (display.activity === "working" || display.activity === "thinking") {
    const minutes = startedAt ? Math.max(1, Math.round((currentTimeMs() - startedAt) / 60000)) : null;
    return {
      text: minutes ? formatMessage({ id: "taskSection.workingFor" }, { minutes }) : formatMessage({ id: "taskSection.working" }),
      warning: false,
      mark: "working",
      step: display.activityText || null,
    };
  }
  return { text: null, warning: false, mark: "idle", step: null };
}

/** The one thing the task asks of the person, done in place: Review (a task in review they created), Claim (nobody's). */
function RowAction({ task, viewerId }: { task: Task; viewerId: string | null }) {
  const { formatMessage } = useIntl();
  const claim = useCallback(() => { void useTaskStore.getState().claimTask(task.channelId, task.id); }, [task.channelId, task.id]);
  const review = useCallback(() => { void useTaskStore.getState().updateTaskStatus(task.channelId, task.id, "done"); }, [task.channelId, task.id]);
  if (task.status === "in_review" && viewerId && task.createdByType === "user" && task.createdById === viewerId) {
    return <Button type="button" size="sm" variant="primary" onClick={review} data-testid={`channel-task-review-${task.taskNumber}`}>{formatMessage({ id: "taskSection.review" })}</Button>;
  }
  if (!task.claimedById && task.status !== "done" && task.status !== "closed") {
    return <Button type="button" size="sm" variant="default" onClick={claim} data-testid={`channel-task-claim-${task.taskNumber}`}>{formatMessage({ id: "taskSection.claim" })}</Button>;
  }
  return null;
}

