import { useCallback } from "react";
import { useIntl } from "react-intl";
import { Bell, Monitor, TriangleAlert } from "lucide-react";

import { useDismissedNotificationStore } from "../../components/layout/dismissedNotificationStore";
import { useVisibleNotifications } from "../../components/layout/useSystemNotifications";
import type { NotificationEntry } from "../../components/layout/useSystemNotifications";
import { isActionableNotice } from "./inboxForMe";

/**
 * Layout redesign (F4): the bell's system notices, in the inbox, read like
 * its other rows: an icon (a warning mark on one to act on), what happened,
 * then what it means; the whole row runs its main action, Dismiss on the
 * right. Those to act on (a computer offline) head For me; the rest head All.
 */
export function InboxSystemNotices({ actionable }: { actionable: boolean }) {
  const { formatMessage } = useIntl();
  const notices = useVisibleNotifications("desktop").filter((n) => isActionableNotice(n) === actionable);
  if (notices.length === 0) return null;
  return (
    <div className="flex flex-col pb-1" data-testid={`inbox-system-notices-${actionable ? "for-me" : "all"}`}>
      {!actionable ? (
        <div className="px-(--column-margin) pt-2 pb-1 text-footnote font-semibold text-foreground-hint">{formatMessage({ id: "inbox.systemNotices" })}</div>
      ) : null}
      {notices.map((entry) => <InboxSystemNoticeRow key={entry.id} entry={entry} actionable={actionable} />)}
    </div>
  );
}

function InboxSystemNoticeRow({ entry, actionable }: { entry: NotificationEntry; actionable: boolean }) {
  const { formatMessage } = useIntl();
  const dismiss = useDismissedNotificationStore((s) => s.dismiss);
  const run = useCallback(() => entry.action?.onClick(), [entry.action]);
  const dismissKey = entry.dismissalKey;
  const handleDismiss = useCallback(() => { if (dismissKey) dismiss(dismissKey); }, [dismiss, dismissKey]);
  const computer = /computer|machine|电脑/i.test(entry.id);
  return (
    <div className="group mx-2 flex items-start gap-3 rounded-container px-3 py-2.5 hover:overlay-subtle" data-testid={`inbox-system-notice-${entry.id}`}>
      <span className="relative mt-0.5 shrink-0 text-foreground-hint">
        {computer ? <Monitor size={16} aria-hidden /> : <Bell size={16} aria-hidden />}
        {actionable ? <TriangleAlert size={10} aria-hidden className="absolute -right-1 -bottom-1 text-warning-strong" /> : null}
      </span>
      <button type="button" className="flex min-w-0 flex-1 flex-col gap-0.5 text-left" onClick={run} disabled={!entry.action || entry.action.disabled}>
        <span className="truncate font-semibold text-foreground">{entry.title}</span>
        <span className="line-clamp-2 text-callout text-foreground-muted">{entry.body}</span>
      </button>
      {dismissKey ? (
        <button
          type="button"
          className="shrink-0 rounded-control px-1.5 py-0.5 text-footnote text-foreground-hint hover:overlay-subtle hover:text-foreground"
          onClick={handleDismiss}
          data-testid={`inbox-system-notice-dismiss-${entry.id}`}
        >
          {formatMessage({ id: "common.announcement.dismiss" })}
        </button>
      ) : null}
    </div>
  );
}
