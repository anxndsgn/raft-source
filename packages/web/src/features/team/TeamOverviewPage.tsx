import { useMemo } from "react";
import { useIntl } from "react-intl";
import { ScrollArea } from "@botiverse/raft-ui";
import { useMobileBack } from "../../hooks/useAppNavigate";
import { useServerStore } from "../../store/serverStore";
import { TeamHeader } from "./TeamHeader";

/**
 * The Team page's Overview (PRD 团队页 §5.1, design T1): what needs you, who
 * is working, who is idle or offline, and the computers, under the Team head.
 */
export function TeamOverviewPage() {
  const { formatMessage } = useIntl();
  const serverSlug = useServerStore((s) => s.current?.slug);
  const onMobileBack = useMobileBack(serverSlug ? `/s/${serverSlug}` : "/");
  const mobileBackProps = useMemo(
    () => ({ "data-testid": "team-mobile-back", title: formatMessage({ id: "common.announcement.back" }) }),
    [formatMessage],
  );
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col font-sans" data-testid="team-overview-page">
      <TeamHeader view="overview" onMobileBack={onMobileBack} mobileBackProps={mobileBackProps} />
      <ScrollArea className="min-h-0 flex-1 bg-layer-canvas pb-5 safe-bottom" data-testid="team-overview-scroller" />
    </div>
  );
}
