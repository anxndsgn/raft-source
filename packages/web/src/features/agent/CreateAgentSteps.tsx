import { Button, DialogFooter } from "@botiverse/raft-ui";
import { ChevronRight } from "lucide-react";
import { useIntl } from "react-intl";
import type { IntlShape } from "react-intl";
import type { ReactNode } from "react";
import { isRuntimeFormV2FieldVisible, runtimeFormV2Choices } from "@botiverse/raft-runtime-form";
import type { ParsedRuntimeFormV2, RuntimeFormV2Sources, RuntimeFormV2Values } from "@botiverse/raft-runtime-form";
import DialogCard from "../../components/ui/DialogCard";
import { DialogCancel } from "../../components/ui/NarrowDialog";
import { isRuntimeFormV2AdvancedSetting } from "../../components/agent/RuntimeConfigFields";

/**
 * Create Agent in two steps (task #26, owner 5bc71ccb "太长了", progressive
 * disclosure; Figmama's spec, artifact Kd8jhvwB): 1 "Who it is" (name,
 * description), 2 "Where it runs" (computer, runtime, model, reasoning), and
 * the settings that have working defaults (provider, fast mode, command,
 * environment variables) in a nested Advanced settings dialog.
 */
export type CreateAgentStep = 1 | 2;

/** Two thin bars, each with its step's name over it; the current step's bar and name are ink. */
export function CreateAgentStepBar({ step }: { step: CreateAgentStep }) {
  const { formatMessage } = useIntl();
  const steps = [
    { n: 1 as const, label: formatMessage({ id: "agent.create.step.who" }) },
    { n: 2 as const, label: formatMessage({ id: "agent.create.step.where" }) },
  ];
  return (
    <ol className="mb-2 flex gap-2" aria-label={formatMessage({ id: "agent.create.step.aria" }, { step, total: steps.length })} data-testid="create-agent-steps">
      {steps.map(({ n, label }) => (
        <li key={n} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={n === step ? "step" : undefined}>
          <span className={`truncate text-caption ${n === step ? "font-semibold text-foreground" : "text-foreground-hint"}`}>
            {formatMessage({ id: "agent.create.step.label" }, { n, label })}
          </span>
          <span className={`h-[3px] rounded-full ${n <= step ? "bg-foreground" : "bg-fill-medium"}`} aria-hidden="true" />
        </li>
      ))}
    </ol>
  );
}

/**
 * The button row of a step. Unlike DialogCardFooter it stays on a phone: its
 * other buttons (Create now, Back) have nowhere else to go; Cancel hides there
 * (× is the way out) and the commit moves to the sheet's head (DialogCommit).
 */
export function CreateAgentStepFooter({ children }: { children: ReactNode }) {
  return (
    <DialogFooter className="items-center px-0 pb-0 first:pt-0 md:pointer-fine:mt-[18px]" data-testid="create-agent-step-footer">
      {children}
    </DialogFooter>
  );
}

export { DialogCancel as CreateAgentStepCancel };

type AdvancedSummaryInput = {
  form: ParsedRuntimeFormV2 | null;
  sources: RuntimeFormV2Sources | null;
  values: RuntimeFormV2Values | null;
  initialValues: RuntimeFormV2Values | null;
};

/**
 * The Advanced settings row's subtitle: what is in the dialog and "All
 * defaults", or what has been changed ("Provider: Custom · Environment
 * variables (2)"), so a setting in effect is never out of sight while the
 * dialog is closed. A field shown only for another one's value (Custom's URL
 * and key) is said by that one; a secret is named, never shown.
 */
export function advancedSettingsSummary(input: AdvancedSummaryInput, intl: Pick<IntlShape, "formatMessage" | "formatList">): string {
  const { form, sources, values, initialValues } = input;
  const { formatMessage } = intl;
  const names: string[] = [];
  const changed: string[] = [];
  const fields = form && sources && values
    ? form.fields.filter((field) => isRuntimeFormV2AdvancedSetting(form, field) && isRuntimeFormV2FieldVisible(field, values, sources))
    : [];
  const lead = fields.filter((field) => field.visibleWhen.length === 0 && !field.rule);
  for (const field of lead) names.push(field.label);
  for (const field of lead) {
    if (!values || !sources) break;
    const value = values[field.key];
    const initial = initialValues?.[field.key];
    if (field.kind === "string_map") {
      const count = value && typeof value === "object" ? Object.keys(value).length : 0;
      if (count > 0) changed.push(formatMessage({ id: "agent.create.advanced.count" }, { label: field.label, count }));
    } else if (field.kind === "secret") {
      if (typeof value === "string" && value !== "") changed.push(field.label);
    } else if (JSON.stringify(value ?? null) !== JSON.stringify(initial ?? null) && !(value === "" && initial === undefined)) {
      const choices = runtimeFormV2Choices(field, sources, values);
      const choice = choices?.kind === "select" ? choices.options.find((option) => option.value === value) : undefined;
      changed.push(choice
        ? formatMessage({ id: "agent.create.advanced.value" }, { label: field.label, value: choice.label })
        : field.label);
    }
  }
  if (changed.length > 0) return changed.join(" · ");
  return formatMessage({ id: "agent.create.advanced.allDefault" }, { names: intl.formatList(names, { type: "conjunction" }) });
}

/** Step 2's last row: opens the Advanced settings dialog. */
export function AdvancedSettingsRow({ summary, onOpen }: { summary: string; onOpen: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-control border border-line-hairline px-3 py-2.5 text-left outline-none hover:bg-fill-subtle focus-visible:shadow-focus"
      data-testid="create-agent-advanced-row"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-callout font-semibold text-foreground">{formatMessage({ id: "agent.create.advanced.title" })}</span>
        <span className="text-caption text-foreground-muted">{summary}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-foreground-hint" aria-hidden="true" />
    </button>
  );
}

/**
 * The nested Advanced settings dialog. Drawn inside Create Agent's dialog, so
 * raft-ui stacks it (its own scrim, Escape closes only it). Its fields edit
 * the form directly; Cancel and × put back what was there when it opened
 * (`onCancel`), Done keeps it.
 */
export function AdvancedSettingsDialog({ open, onCancel, onDone, children }: {
  /** Kept mounted while closed so it can fade out (task #27). */
  open: boolean;
  onCancel: () => void;
  onDone: () => void;
  children: ReactNode;
}) {
  const { formatMessage } = useIntl();
  return (
    <DialogCard
      title={formatMessage({ id: "agent.create.advanced.title" })}
      onClose={onCancel}
      testId="create-agent-advanced-dialog"
      open={open}
      narrow="sheet"
    >
      <div className="stack-y-1 md:pointer-fine:stack-y-4">
        {children}
        <DialogFooter className="items-center px-0 pb-0 first:pt-0 md:pointer-fine:mt-[18px]">
          <DialogCancel>
            <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
              {formatMessage({ id: "common.confirm.cancel" })}
            </Button>
          </DialogCancel>
          <Button type="button" variant="primary" size="lg" onClick={onDone} data-testid="create-agent-advanced-done">
            {formatMessage({ id: "agent.create.advanced.done" })}
          </Button>
        </DialogFooter>
      </div>
    </DialogCard>
  );
}
