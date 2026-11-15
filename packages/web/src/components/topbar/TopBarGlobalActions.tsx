import NotificationTrigger, { PendingNotificationTrigger } from "../layout/NotificationTrigger";
import { useShellPending } from "../layout/shellPending";
import { WebUpdateButton } from "./WebUpdateButton";

/**
 * The web top bar's right region: the Update button while a newer release
 * waits, then the Bell. Help stays on the rail, above Settings; the rail keeps
 * navigation, Help and Settings. Who is working is the rail's Team tab
 * (PRD 团队页 §4), not a summary here.
 */
export function TopBarGlobalActions() {
  // A server still being resolved: the Bell in its place, nothing to show in it yet.
  if (useShellPending()) {
    return (
      <>
        <WebUpdateButton slotOnly />
        <PendingNotificationTrigger flavor="top-bar" />
      </>
    );
  }
  return (
    <>
      <WebUpdateButton />
      <NotificationTrigger flavor="top-bar" />
    </>
  );
}
