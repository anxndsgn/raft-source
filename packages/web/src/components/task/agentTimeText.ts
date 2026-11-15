import { useCallback } from "react";
import { useIntl } from "react-intl";
import type { IntlShape } from "react-intl";
import { currentTimeMs } from "@botiverse/raft-shared";
import { useTimeFormatter } from "../../hooks/useTimeFormatter";

/**
 * When a held agent resumes, as a moment, not a span (Figmama 11/15): "09:00"
 * today, "11/21" on another day, and the full date for a hover title. One
 * writing for the Tasks section, the Team page and the Team tab's preview.
 */
export function useResumeMoment() {
  const { formatClock, formatCompactDate, formatMediumDateTime } = useTimeFormatter();
  return useCallback((at: string | null | undefined): { when: string; title: string } | null => {
    const date = at ? new Date(at) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    const today = date.toDateString() === new Date(currentTimeMs()).toDateString();
    return { when: today ? formatClock(date) : formatCompactDate(date), title: formatMediumDateTime(date) };
  }, [formatClock, formatCompactDate, formatMediumDateTime]);
}

/** A span to now in the rows' short Space Mono form (tasks.md): 刚刚, 12 分, 15 时, 3 天. */
export function shortSpan(fromMs: number, formatMessage: IntlShape["formatMessage"]): string {
  const minutes = Math.floor(Math.max(0, currentTimeMs() - fromMs) / 60000);
  if (minutes < 1) return formatMessage({ id: "taskSection.ago.now" });
  if (minutes < 60) return formatMessage({ id: "taskSection.ago.minutes" }, { count: minutes });
  if (minutes < 60 * 24) return formatMessage({ id: "taskSection.ago.hours" }, { count: Math.floor(minutes / 60) });
  return formatMessage({ id: "taskSection.ago.days" }, { count: Math.floor(minutes / 1440) });
}

/** shortSpan with the component's intl. */
export function useShortSpan() {
  const { formatMessage } = useIntl();
  return useCallback((fromMs: number) => shortSpan(fromMs, formatMessage), [formatMessage]);
}
