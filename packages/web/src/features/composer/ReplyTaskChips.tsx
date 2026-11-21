import { TaskStatusIcon } from "@botiverse/raft-ui";
import { X } from "lucide-react";
import { useCallback } from "react";
import { useIntl } from "react-intl";

import { useReplyTargetStore } from "../../store/replyTargetStore";
import type { ReplyTarget } from "../../store/replyTargetStore";
import { useTaskStore } from "../../store/taskStore";
import { toRuiTaskStatus } from "../../components/task/taskStatusUi";

/**
 * Reply mode (task #10 item 4.1): a reply joins the tasks its original is linked to. "Joins" once, then one tag per
 * task; × keeps this reply off that task (sent as excludeTaskNumbers).
 *
 * Raft redesign (Figmama 11/21, 8bcdd507): the lead regular 12 muted; each tag 24 tall, no fill, a 1px hairline, the
 * control corner, 8px in, the task's 8px status square and "#N" in Inter 12 Semi Bold ink, a 12px muted × at the end;
 * the subtle fill under the pointer; tags 4px apart.
 */
export function ReplyTaskChips({ channelId, target }: { channelId: string; target: ReplyTarget }) {
  const { formatMessage } = useIntl();
  const excludeTask = useReplyTargetStore((s) => s.excludeTask);
  const joins = (target.taskNumbers ?? []).filter((n) => !target.excludedTaskNumbers?.includes(n));
  if (joins.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="composer-reply-tasks">
      <span className="mr-1 text-[12px] leading-4 text-foreground-muted">{formatMessage({ id: "message.reply.joinsTaskLead" })}</span>
      {joins.map((number) => <ReplyTaskChip key={number} number={number} onRemove={excludeTask} channelId={channelId} />)}
    </div>
  );
}

function ReplyTaskChip({ number, channelId, onRemove }: { number: number; channelId: string; onRemove: (channelId: string, taskNumber: number) => void }) {
  const { formatMessage } = useIntl();
  const remove = useCallback(() => onRemove(channelId, number), [channelId, number, onRemove]);
  const status = useTaskStore((s) => (s.tasksByChannelId[channelId] ?? s.tasks).find((task) => task.taskNumber === number)?.status);
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-control border border-line-hairline pr-1 pl-2 hover:bg-fill-subtle"
      data-testid={`composer-reply-task-${number}`}
    >
      {status ? <TaskStatusIcon status={toRuiTaskStatus(status)} className="size-2 shrink-0" /> : null}
      <span className="font-sans text-[12px] leading-4 font-semibold text-foreground tabular-nums">{formatMessage({ id: "message.reply.taskNumber" }, { number })}</span>
      <button
        type="button"
        onClick={remove}
        aria-label={formatMessage({ id: "message.reply.leaveTask" }, { number })}
        className="flex size-4 items-center justify-center rounded-control text-foreground-muted outline-none hover:text-foreground focus-visible:shadow-focus"
        data-testid={`composer-reply-task-${number}-remove`}
      >
        <X aria-hidden className="size-3" />
      </button>
    </span>
  );
}
