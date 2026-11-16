import { useIntl } from "react-intl";
import { PanelToggleAction } from "@botiverse/raft-ui";
import { RIcon } from "../redesign/icons";

import Tooltip from "../ui/Tooltip";

/** The channel header's switch for the Files card beside the message list. */
export default function ChannelFilesToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { formatMessage } = useIntl();
  const label = formatMessage({ id: open ? "message.chatPanel.filesCard.close" : "message.chatPanel.filesCard.open" });
  return (
    <Tooltip content={label}>
      <PanelToggleAction pressed={open} onPressedChange={onToggle} aria-label={label} data-testid="channel-files-toggle">
        <RIcon name="artifact" filled={open} />
      </PanelToggleAction>
    </Tooltip>
  );
}
