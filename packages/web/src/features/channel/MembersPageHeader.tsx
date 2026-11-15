import { Badge, PanelAction, PanelHeader, Spinner } from "@botiverse/raft-ui";
import { ArrowLeft, X } from "lucide-react";
import { useCallback } from "react";
import { useIntl } from "react-intl";

import Tooltip from "../../components/ui/Tooltip";

/**
 * The channel's member list's head (ChannelMembers, page presentation). `ownHead` (layout redesign 4.3, a desktop):
 * the side panel's one head with its ×; Back only where the channel's info opened it (`onBack`), as a crumb,
 * ‹ Channel info /. Otherwise (a phone's page) Back to the details' root.
 */
export function MembersPageHeader({ ownHead, adding, loading, count, onBackOrReset, onBack, onClose }: {
  ownHead: boolean;
  /** The add flow shows: its own Back, to the list. */
  adding: boolean;
  loading: boolean;
  count: number;
  onBackOrReset: () => void;
  onBack?: () => void;
  onClose?: () => void;
}) {
  const { formatMessage } = useIntl();
  // Not the click: its event is no post-close action (ChannelOverflowMenu guardedClose).
  const close = useCallback(() => onClose?.(), [onClose]);
  const pageTitle = (
    <>
      <h2 className="truncate text-headline">
        {adding
          ? formatMessage({ id: "agent.channelMembers.addMember" })
          : formatMessage({ id: "message.chatPanel.overflow.members" })}
      </h2>
      {!adding && !loading && (
        <Badge
          appearance="outline"
          className="shrink-0"
          data-testid="member-page-count"
        >
          {count}
        </Badge>
      )}
      {!adding && loading && (
        <Spinner
          size="sm"
          aria-label={formatMessage({ id: "message.chatPanel.overflow.membersLoading" })}
          data-testid="member-page-count-loading"
        />
      )}
      <div className="flex-1" />
    </>
  );
  // raft-ui PanelHeader owns the edges: Back's icon box starts on the content
  // margin, as on every other head (headEdges.ts).
  const pageHeader = ownHead ? (
    <PanelHeader>
      {adding ? (
        <Tooltip content={formatMessage({ id: "panel.backTo.members" })}>
          <PanelAction onClick={onBackOrReset} aria-label={formatMessage({ id: "panel.backTo.members" })} data-testid="add-member-back">
            <ArrowLeft />
          </PanelAction>
        </Tooltip>
      ) : onBack ? (
        <Tooltip content={formatMessage({ id: "panel.backTo.channelInfo" })}>
          <PanelAction onClick={onBack} aria-label={formatMessage({ id: "panel.backTo.channelInfo" })} data-testid="member-page-back">
            <ArrowLeft />
          </PanelAction>
        </Tooltip>
      ) : null}
      {pageTitle}
      {onClose ? (
        <Tooltip content={formatMessage({ id: "message.chatPanel.overflow.close" })}>
          <PanelAction onClick={close} aria-label={formatMessage({ id: "message.chatPanel.overflow.close" })} data-testid="member-page-close">
            <X />
          </PanelAction>
        </Tooltip>
      ) : null}
    </PanelHeader>
  ) : (
    <PanelHeader>
      {/* In the add view the back button is the add flow's own ‹ back
          (resetAddFlow), keeping the add-member-back contract the
          panel header uses; otherwise it returns to the drawer root. */}
      <PanelAction
        onClick={onBackOrReset}
        aria-label={formatMessage({
          id: adding ? "agent.channelMembers.backToMembers" : "channel.membersPage.back",
        })}
        data-testid={adding ? "add-member-back" : "member-page-back"}
      >
        <ArrowLeft />
      </PanelAction>
      {pageTitle}
    </PanelHeader>
  );
  return pageHeader;
}
