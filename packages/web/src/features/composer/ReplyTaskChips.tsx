import { FilterChip, FilterChipLabel, FilterChipRemove } from "@botiverse/raft-ui/wip";
import { useCallback } from "react";
import { useIntl } from "react-intl";

import { useReplyTargetStore } from "../../store/replyTargetStore";
import type { ReplyTarget } from "../../store/replyTargetStore";

/**
 * Reply mode (task #10 item 4.1): a reply joins the tasks its original is linked to. One chip per task,
 * "Joins task #N ×"; × keeps this reply off that task (sent as excludeTaskNumbers).
 */
export function ReplyTaskChips({ channelId, target }: { channelId: string; target: ReplyTarget }) {
  const excludeTask = useReplyTargetStore((s) => s.excludeTask);
  const joins = (target.taskNumbers ?? []).filter((n) => !target.excludedTaskNumbers?.includes(n));
  if (joins.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="composer-reply-tasks">
      {joins.map((number) => <ReplyTaskChip key={number} number={number} onRemove={excludeTask} channelId={channelId} />)}
    </div>
  );
}

function ReplyTaskChip({ number, channelId, onRemove }: { number: number; channelId: string; onRemove: (channelId: string, taskNumber: number) => void }) {
  const { formatMessage } = useIntl();
  const remove = useCallback(() => onRemove(channelId, number), [channelId, number, onRemove]);
  return (
    <FilterChip data-testid={`composer-reply-task-${number}`}>
      <FilterChipLabel>{formatMessage({ id: "message.reply.joinsTask" }, { number })}</FilterChipLabel>
      <FilterChipRemove aria-label={formatMessage({ id: "message.reply.leaveTask" }, { number })} onClick={remove} data-testid={`composer-reply-task-${number}-remove`} />
    </FilterChip>
  );
}
