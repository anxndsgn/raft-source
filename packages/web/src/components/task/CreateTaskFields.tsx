import {
  Field,
  FieldError,
  FieldLabel,
  Select,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemLeading,
  SelectItemText,
  SelectList,
  SelectTrigger,
  SelectValue,
} from "@botiverse/raft-ui";
import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import type { CreateTaskChannelOption } from "./createTaskForm";

/** The channel a create goes in, picked (the Tasks page's New task). `error` goes under the select. */
export function CreateTaskChannelField({
  label,
  options,
  value,
  onValueChange,
  error,
}: {
  label: string;
  options: readonly CreateTaskChannelOption[];
  value: string | null;
  onValueChange: (next: string | null) => void;
  error?: string;
}) {
  const { formatMessage } = useIntl();
  return (
    <Field invalid={Boolean(error)}>
      <FieldLabel>{label}</FieldLabel>
      <Select<string> chrome="field" items={options} value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full" data-testid="create-task-channel">
          <SelectValue placeholder={formatMessage({ id: "task.create.channelPlaceholder" })} />
          <SelectIcon />
        </SelectTrigger>
        <SelectContent>
          <SelectList>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} data-testid={`create-task-channel-${option.value}`}>
                <SelectItemText>{option.label}</SelectItemText>
                <SelectItemIndicator />
              </SelectItem>
            ))}
          </SelectList>
        </SelectContent>
      </Select>
      {error ? <FieldError match role="alert" data-testid="create-task-channel-error">{error}</FieldError> : null}
    </Field>
  );
}

export interface CreateTaskAssigneeOption {
  /** `user:<id>` or `agent:<id>`. */
  value: string;
  label: string;
  leading: ReactNode;
}

/** Who the new task goes to (task #15): optional, the channel's people and agents. */
export function CreateTaskAssigneeField({
  options,
  value,
  onValueChange,
}: {
  options: readonly CreateTaskAssigneeOption[];
  value: string | null;
  onValueChange: (next: string | null) => void;
}) {
  const { formatMessage } = useIntl();
  const items = useMemo(() => [{ value: "", label: formatMessage({ id: "task.properties.unassigned" }) }, ...options], [formatMessage, options]);
  const change = useCallback((next: string | null) => onValueChange(next || null), [onValueChange]);
  return (
    <Field>
      <FieldLabel>
        {formatMessage({ id: "task.properties.assignee" })}
        <span className="ml-1 font-normal text-foreground-hint">{formatMessage({ id: "task.create.optional" })}</span>
      </FieldLabel>
      <Select<string> chrome="field" items={items} value={value ?? ""} onValueChange={change}>
        <SelectTrigger className="w-full" data-testid="create-task-assignee">
          <SelectValue />
          <SelectIcon />
        </SelectTrigger>
        <SelectContent>
          <SelectList>
            <SelectItem value="" data-testid="create-task-assignee-none">
              <SelectItemText>{items[0]!.label}</SelectItemText>
              <SelectItemIndicator />
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} data-testid={`create-task-assignee-${option.value}`}>
                <SelectItemLeading>{option.leading}</SelectItemLeading>
                <SelectItemText>{option.label}</SelectItemText>
                <SelectItemIndicator />
              </SelectItem>
            ))}
          </SelectList>
        </SelectContent>
      </Select>
    </Field>
  );
}
