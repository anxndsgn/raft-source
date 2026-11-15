/**
 * Reply mode (task #10 item 4.2): "Adjust task links" from a message's ⋯ menu. The message's sender or a server
 * owner/admin ticks which of the channel's tasks it belongs to; Save sends the difference
 * (POST /messages/:id/tasks), recorded on each task as the agents' `raft message retag` is.
 *
 * Raft DS: a small task Dialog (md) with a Checkbox per task and Cancel + Save in the footer; a sheet on a phone.
 */
import { Button, Checkbox, Dialog, DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@botiverse/raft-ui";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";

import api from "../../api/client";
import { useMessageStore } from "../../store/messageStore";
import { useTaskStore } from "../../store/taskStore";
import Banner from "../ui/Banner";
import { DialogActions, DialogCommit, NarrowDialogContent } from "../ui/NarrowDialog";

const NO_TASKS: never[] = [];

export function MessageTaskLinksDialog({ messageId, channelId, linkedTaskNumbers, onClose }: {
  messageId: string;
  channelId: string;
  linkedTaskNumbers: readonly number[];
  onClose: () => void;
}) {
  const { formatMessage } = useIntl();
  const tasks = useTaskStore((s) => s.tasksByChannelId[channelId] ?? NO_TASKS);
  const loaded = useTaskStore((s) => !!s.loadedByChannelId[channelId]);
  // The dialog opens on one message and closes before another: load its channel's tasks once, on open.
  const [requested] = useState(() => {
    if (!useTaskStore.getState().loadedByChannelId[channelId]) void useTaskStore.getState().loadTasks(channelId);
    return true;
  });
  // The channel's tasks still going, and any done one it is already linked to; newest first.
  const shown = useMemo(
    () => tasks
      .filter((task) => task.status !== "done" || linkedTaskNumbers.includes(task.taskNumber))
      .sort((a, b) => b.taskNumber - a.taskNumber),
    [linkedTaskNumbers, tasks],
  );
  const [picked, setPicked] = useState<ReadonlySet<number>>(() => new Set(linkedTaskNumbers));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const add = [...picked].filter((n) => !linkedTaskNumbers.includes(n));
  const remove = linkedTaskNumbers.filter((n) => !picked.has(n));
  const changed = add.length + remove.length > 0;

  const toggle = useCallback((taskNumber: number, on: boolean) => {
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(taskNumber);
      else next.delete(taskNumber);
      return next;
    });
  }, []);
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && !saving) onClose();
  }, [onClose, saving]);
  const handleSave = useCallback(async () => {
    if (!changed || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const { data } = await api.post<{ taskNumbers: number[] }>(`/messages/${messageId}/tasks`, { add, remove });
      useMessageStore.getState().updateMessage({ id: messageId, channelId, linkedTaskNumbers: data.taskNumbers });
      onClose();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }, [add, changed, channelId, messageId, onClose, remove, saving]);
  const handleConfirm = useCallback(() => void handleSave(), [handleSave]);

  const title = formatMessage({ id: "message.taskLinks.title" });
  return (
    <Dialog open disablePointerDismissal={saving} onOpenChange={handleOpenChange}>
      <NarrowDialogContent
        narrow="sheet"
        size="md"
        data-testid="message-task-links-dialog"
        title={title}
        closeLabel={formatMessage({ id: "common.close" })}
        closeDisabled={saving}
        header={(
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogClose aria-label={formatMessage({ id: "common.close" })} disabled={saving} />
          </DialogHeader>
        )}
      >
        <DialogBody className="grid gap-3 font-normal">
          <DialogDescription>{formatMessage({ id: "message.taskLinks.description" })}</DialogDescription>
          {shown.length === 0 ? (
            <p className="text-footnote text-foreground-muted">
              {formatMessage({ id: loaded || !requested ? "message.taskLinks.none" : "message.taskLinks.loading" })}
            </p>
          ) : (
            <div className="grid">
              {shown.map((task) => (
                <TaskLinkRow key={task.id} taskNumber={task.taskNumber} title={task.title} checked={picked.has(task.taskNumber)} disabled={saving} onToggle={toggle} />
              ))}
            </div>
          )}
          {failed ? (
            <Banner intent="warning" density="sm" data-testid="message-task-links-failed">
              {formatMessage({ id: "message.taskLinks.failed" })}
            </Banner>
          ) : null}
        </DialogBody>
        <DialogActions as={DialogFooter}>
          <DialogClose render={<Button size="lg" variant="ghost" />} disabled={saving}>
            {formatMessage({ id: "common.confirm.cancel" })}
          </DialogClose>
          <DialogCommit>
            {(inHead) => (
              <Button
                size={inHead ? "md" : "lg"}
                variant="primary"
                disabled={!changed}
                loading={saving}
                loadingLabel={formatMessage({ id: "message.taskLinks.saving" })}
                onClick={handleConfirm}
                data-testid="message-task-links-save"
              >
                {formatMessage({ id: "message.taskLinks.save" })}
              </Button>
            )}
          </DialogCommit>
        </DialogActions>
      </NarrowDialogContent>
    </Dialog>
  );
}

function TaskLinkRow({ taskNumber, title, checked, disabled, onToggle }: {
  taskNumber: number;
  title: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (taskNumber: number, on: boolean) => void;
}) {
  const { formatMessage } = useIntl();
  const change = useCallback((on: boolean) => onToggle(taskNumber, on), [onToggle, taskNumber]);
  return (
    <label className="flex min-h-10 items-center gap-2 py-1" data-testid={`message-task-link-${taskNumber}`}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={change} className="shrink-0" />
      <span className="shrink-0 font-mono text-mono-meta text-foreground-muted">{formatMessage({ id: "taskDetail.number" }, { number: taskNumber })}</span>
      <span className="min-w-0 truncate text-subhead text-foreground">{title}</span>
    </label>
  );
}
