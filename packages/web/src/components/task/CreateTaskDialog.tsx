import { Button, Field, FieldError, FieldLabel, Input, Textarea } from "@botiverse/raft-ui";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useIntl } from "react-intl";
import { useChannelMembers } from "../../hooks/useChannelMembers";
import { TASK_V2_CONVERSATIONS_FLAG_KEY, useServerFeatureFlag } from "../../store/serverFeatureFlags";
import { useServerStore } from "../../store/serverStore";
import { useTaskStore } from "../../store/taskStore";
import type { Task } from "../../store/taskStore";
import AvatarSlot from "../ui/AvatarSlot";
import Banner from "../ui/Banner";
import DialogCard from "../ui/DialogCard";
import { DialogCardFooter, DialogCommit } from "../ui/NarrowDialog";
import { CreateTaskAssigneeField, CreateTaskChannelField } from "./CreateTaskFields";
import type { CreateTaskAssigneeOption } from "./CreateTaskFields";
import { createFailureMessage, useChannelLabel, useCreateTaskChannel } from "./createTaskForm";
import { dedupeTaskAssigneeMembers } from "./taskAssigneeCandidates";

/** "Create Task from Message": the task hangs under this message; its title starts as the message's first line. */
export interface CreateTaskSourceMessage {
  id: string;
  senderName: string;
  text: string;
}

const SOURCE_TITLE_MAX = 200;
const LAST_CHANNEL_KEY = "raft.createTask.lastChannel.";
const EMPTY_CHANNEL = "";

function titleFromMessage(text: string): string {
  const first = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const single = first.replace(/\s+/g, " ");
  return single.length <= SOURCE_TITLE_MAX ? single : `${single.slice(0, SOURCE_TITLE_MAX - 1).trimEnd()}…`;
}

function readLastChannel(serverId: string | null): string | null {
  if (!serverId) return null;
  try { return window.localStorage.getItem(LAST_CHANNEL_KEY + serverId); } catch { return null; }
}

function rememberLastChannel(serverId: string | null, channelId: string) {
  if (!serverId) return;
  try { window.localStorage.setItem(LAST_CHANNEL_KEY + serverId, channelId); } catch { /* private mode: nothing kept */ }
}

interface CreateTaskDialogProps {
  /** The channel the task goes in (a channel's Tasks panel, a message). Absent (the Tasks page), it is picked. */
  channelId?: string;
  /** Without `channelId`: the channel picked at first (the page's one channel filter), else the last one used. */
  defaultChannelId?: string | null;
  onClose: () => void;
  /** After the task was created, before the dialog closes. */
  onCreated?: (tasks: Task[]) => void;
  sourceMessage?: CreateTaskSourceMessage;
}

/**
 * Task #15 (anxndsgn 11/16; design Figmama task #14): every way a person creates a task — the Tasks panel's +, the
 * Tasks page's New task, a message's Create task — is this one dialog: a title, a description, the channel (fixed
 * where it is known, else picked) and who it goes to. The task is a message in that channel, as always.
 */
export default function CreateTaskDialog({ channelId: fixedChannelId, defaultChannelId = null, onClose, onCreated, sourceMessage }: CreateTaskDialogProps) {
  const { formatMessage } = useIntl();
  const taskV2 = useServerFeatureFlag(TASK_V2_CONVERSATIONS_FLAG_KEY).enabled;
  const serverId = useServerStore((s) => s.current?.id ?? null);
  const [initialChannel] = useState(() => defaultChannelId ?? readLastChannel(serverId));
  const { channelId, channelOptions, pickedChannelId, handleChannelChange } = useCreateTaskChannel(fixedChannelId, initialChannel);
  const channelLabel = useChannelLabel(channelId ?? undefined);
  const createTasks = useTaskStore((s) => s.createTasks);
  const updateTaskAssignee = useTaskStore((s) => s.updateTaskAssignee);
  const convertMessage = useTaskStore((s) => s.convertMessage);
  const amendTask = useTaskStore((s) => s.amendTask);
  const [title, setTitle] = useState(() => (sourceMessage ? titleFromMessage(sourceMessage.text) : ""));
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [channelError, setChannelError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Created, its assignment failed: a retry only assigns (never a second task).
  const createdRef = useRef<Task | null>(null);
  // One key per task message, so a retry after a failure reuses the message the server already posted.
  const sourceKeyRef = useRef(globalThis.crypto.randomUUID());
  const formRef = useRef<HTMLFormElement>(null);

  const { channelAgents, channelHumans } = useChannelMembers(channelId ?? EMPTY_CHANNEL, { enabled: !!channelId });
  const assigneeOptions = useMemo<CreateTaskAssigneeOption[]>(() => (channelId ? [
    ...dedupeTaskAssigneeMembers(channelHumans).map((h) => ({
      value: `user:${h.id}`,
      label: h.displayName || h.name,
      leading: <AvatarSlot context="compact-list" type="human" humanAvatarUrl={h.avatarUrl} />,
    })),
    ...dedupeTaskAssigneeMembers(channelAgents).map((a) => ({
      value: `agent:${a.id}`,
      label: a.displayName || a.name,
      leading: <AvatarSlot context="compact-list" type="agent" agentAvatarUrl={a.avatarUrl ?? null} />,
    })),
  ] : []), [channelAgents, channelHumans, channelId]);

  const handlePickChannel = useCallback((next: string | null) => {
    handleChannelChange(next);
    if (next) setChannelError("");
    // Another channel's members: the pick no longer applies.
    setAssignee(null);
  }, [handleChannelChange]);
  const handleTitle = useCallback((e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value), []);
  const handleDescription = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value), []);
  // ⌘/Ctrl+Enter anywhere in the form creates (Esc is the dialog's own Cancel).
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.nativeEvent.isComposing) return;
    e.preventDefault();
    formRef.current?.requestSubmit();
  }, []);

  const trimmedTitle = title.trim();
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !trimmedTitle) return;
    setError("");
    if (!channelId) {
      setChannelError(formatMessage({ id: "task.create.channelRequired" }));
      return;
    }
    setSubmitting(true);
    try {
      let task = createdRef.current;
      if (!task) {
        const draft = description.trim() ? { title: trimmedTitle, description: description.trim() } : { title: trimmedTitle };
        if (sourceMessage && !taskV2) {
          // Before task v2 a message becomes its task (no task hangs under another message): converted, then given
          // the title and description written here.
          task = await convertMessage(sourceMessage.id);
          createdRef.current = task;
          if (task.title !== draft.title || draft.description) await amendTask(task.id, draft);
        } else {
          // Task v2 without a source message: the server posts the task's message (one key per message).
          const key = taskV2 && !sourceMessage ? sourceKeyRef.current : undefined;
          const created = await createTasks(channelId, [draft], sourceMessage?.id, taskV2 ? "todo" : undefined, key);
          task = created[0] ?? null;
          createdRef.current = task;
        }
        // The Tasks page starts on the channel last used, wherever the task was made.
        rememberLastChannel(serverId, channelId);
      }
      if (task && assignee) {
        const [type, id] = assignee.split(":") as ["user" | "agent", string];
        await updateTaskAssignee(channelId, task.id, { type, id });
      }
      onCreated?.(task ? [task] : []);
      onClose();
    } catch (err: unknown) {
      setError(createdRef.current
        ? formatMessage({ id: "task.create.assignFailed" })
        : createFailureMessage(err, formatMessage, taskV2 && !sourceMessage));
    } finally {
      setSubmitting(false);
    }
  };

  const createLabel = formatMessage({ id: "task.create.create" });
  return (
    <DialogCard
      title={formatMessage({ id: "task.create.heading" }, { count: 1 })}
      onClose={onClose}
      narrow="sheet"
      maxWidthClass="max-w-[480px]"
      testId="create-task-dialog"
    >
      <form ref={formRef} onSubmit={handleSubmit} className="stack-y-4 md:pointer-fine:stack-y-3">
        {error ? <Banner intent="warning" data-testid="create-task-error">{error}</Banner> : null}
        <Field>
          <FieldLabel>{formatMessage({ id: "task.create.titleLabel" })}</FieldLabel>
          <Input
            value={title}
            onChange={handleTitle}
            onKeyDown={handleKeyDown}
            autoFocus
            maxLength={SOURCE_TITLE_MAX * 5}
            placeholder={formatMessage({ id: "task.create.titleField" })}
            data-testid="create-task-title"
          />
        </Field>
        <Field>
          <FieldLabel>
            {formatMessage({ id: "task.create.descriptionLabel" })}
            <span className="ml-1 font-normal text-foreground-hint">{formatMessage({ id: "task.create.optional" })}</span>
          </FieldLabel>
          <Textarea
            value={description}
            onChange={handleDescription}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder={formatMessage({ id: "task.create.descriptionPlaceholder" })}
            data-testid="create-task-description"
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          {fixedChannelId ? (
            <Field>
              <FieldLabel>{formatMessage({ id: "task.panel.channelColumn" })}</FieldLabel>
              <Input value={channelLabel ?? ""} disabled readOnly className="font-mono" data-testid="create-task-channel-fixed" />
            </Field>
          ) : (
            <CreateTaskChannelField
              label={formatMessage({ id: "task.panel.channelColumn" })}
              options={channelOptions}
              value={pickedChannelId}
              onValueChange={handlePickChannel}
              error={channelError}
            />
          )}
          <CreateTaskAssigneeField options={assigneeOptions} value={assignee} onValueChange={setAssignee} />
        </div>
        {channelError && fixedChannelId ? <FieldError>{channelError}</FieldError> : null}
        <DialogCardFooter className="items-center">
          {channelLabel ? (
            <span className="mr-auto min-w-0 truncate text-footnote text-foreground-hint" data-testid="create-task-posts-in">
              {formatMessage({ id: "task.create.postsInHint" }, { channel: channelLabel })}
            </span>
          ) : null}
          <Button size="lg" variant="ghost" type="button" onClick={onClose}>
            {formatMessage({ id: "common.confirm.cancel" })}
          </Button>
          <DialogCommit>
            {(inHead) => (
              <Button size={inHead ? "md" : "lg"} variant="primary" type="submit" disabled={submitting || !trimmedTitle} data-testid="create-task-submit">
                {submitting ? formatMessage({ id: "task.create.submitting" }) : createLabel}
                {inHead || submitting ? null : <kbd className="ml-1.5 font-mono text-mono-meta opacity-70">{formatMessage({ id: "task.create.createKeys" })}</kbd>}
              </Button>
            )}
          </DialogCommit>
        </DialogCardFooter>
      </form>
    </DialogCard>
  );
}
