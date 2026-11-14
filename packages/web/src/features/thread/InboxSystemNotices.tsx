import { useIntl } from "react-intl";
import { NotificationCenterItemBody, NotificationCenterItemTitle } from "@botiverse/raft-ui";

import { NotificationActions } from "../../components/layout/NotificationCenter";
import { useDismissedNotificationStore } from "../../components/layout/dismissedNotificationStore";
import { useVisibleNotifications } from "../../components/layout/useSystemNotifications";
import { isActionableNotice } from "./inboxForMe";

/**
 * Layout redesign (F4): the bell's system notices, in the inbox. Those to act
 * on (a computer offline) head For me; those that only tell head All.
 */
export function InboxSystemNotices({ actionable }: { actionable: boolean }) {
  const { formatMessage } = useIntl();
  const dismiss = useDismissedNotificationStore((s) => s.dismiss);
  const notices = useVisibleNotifications("desktop").filter((n) => isActionableNotice(n) === actionable);
  if (notices.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 pb-1" data-testid={`inbox-system-notices-${actionable ? "for-me" : "all"}`}>
      {!actionable ? (
        <div className="px-(--column-margin) pt-2 pb-1 text-footnote font-semibold text-foreground-hint">{formatMessage({ id: "inbox.systemNotices" })}</div>
      ) : null}
      {notices.map((entry) => (
        <div key={entry.id} className="mx-2 flex items-start gap-3 rounded-container px-3 py-2.5" data-testid={`inbox-system-notice-${entry.id}`}>
          {entry.icon ? <span className="mt-0.5 shrink-0 text-foreground-hint [&_svg]:size-4">{entry.icon}</span> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <NotificationCenterItemTitle>{entry.title}</NotificationCenterItemTitle>
            <NotificationCenterItemBody>{entry.body}</NotificationCenterItemBody>
            <NotificationActions entry={entry} dismiss={dismiss} />
          </div>
        </div>
      ))}
    </div>
  );
}
