import { useCallback } from "react";
import { useIntl } from "react-intl";
import { Bell, Monitor, TriangleAlert } from "lucide-react";
import { Button, IconTile, InboxItem, InboxItemActions, InboxItemBody, InboxItemContent, InboxItemHeading, InboxItemLeading, InboxItemTitle, InboxItemTrigger } from "@botiverse/raft-ui";
import { InboxItemLine, InboxItemListGroup, InboxItemListHeading } from "@botiverse/raft-ui/wip";

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
    <InboxItemListGroup className="pb-1" data-testid={`inbox-system-notices-${actionable ? "for-me" : "all"}`}>
      {!actionable ? <InboxItemListHeading>{formatMessage({ id: "inbox.systemNotices" })}</InboxItemListHeading> : null}
      {notices.map((entry) => <InboxSystemNoticeRow key={entry.id} entry={entry} actionable={actionable} />)}
    </InboxItemListGroup>
  );
}

function InboxSystemNoticeRow({ entry, actionable }: { entry: NotificationEntry; actionable: boolean }) {
  const { formatMessage } = useIntl();
  const dismiss = useDismissedNotificationStore((s) => s.dismiss);
  const run = useCallback(() => entry.action?.onClick(), [entry.action]);
  const dismissKey = entry.dismissalKey;
  const handleDismiss = useCallback(() => { if (dismissKey) dismiss(dismissKey); }, [dismiss, dismissKey]);
  const computer = /computer|machine|电脑/i.test(entry.id);
  // raft-ui InboxItem, as the inbox's other rows: the row runs the notice's action, Dismiss at its end.
  return (
    // With its Dismiss under the text the row is three lines: the icon stays level with the title (owner af958e09),
    // not centred on all three.
    <InboxItem density="compact" data-layout="list" className={dismissKey ? "items-start" : undefined} data-testid={`inbox-system-notice-${entry.id}`}>
      <InboxItemTrigger aria-label={entry.title} onClick={run} disabled={!entry.action || entry.action.disabled} />
      <InboxItemLeading>
        <IconTile className="relative">
          {computer ? <Monitor aria-hidden /> : <Bell aria-hidden />}
          {actionable ? <TriangleAlert size={10} aria-hidden className="absolute -right-1 -bottom-1 text-warning-strong" /> : null}
        </IconTile>
      </InboxItemLeading>
      <InboxItemContent>
        <InboxItemHeading><InboxItemTitle>{entry.title}</InboxItemTitle></InboxItemHeading>
        <InboxItemLine><InboxItemBody>{entry.body}</InboxItemBody></InboxItemLine>
        {dismissKey ? (
          <InboxItemActions>
            <Button type="button" size="sm" variant="outline" onClick={handleDismiss} data-testid={`inbox-system-notice-dismiss-${entry.id}`}>
              {formatMessage({ id: "common.announcement.dismiss" })}
            </Button>
          </InboxItemActions>
        ) : null}
      </InboxItemContent>
    </InboxItem>
  );
}
