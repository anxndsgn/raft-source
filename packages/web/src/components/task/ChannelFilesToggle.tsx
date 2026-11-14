import { useIntl } from "react-intl";
import { PanelToggleAction } from "@botiverse/raft-ui";
import { Paperclip } from "lucide-react";
import { useIsDesktopShell } from "../layout/ShellFrame";

import Tooltip from "../ui/Tooltip";

/** The channel header's switch for the Files card beside the message list. */
export default function ChannelFilesToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { formatMessage } = useIntl();
  const desktop = useIsDesktopShell();
  const label = formatMessage({ id: open ? "message.chatPanel.filesCard.close" : "message.chatPanel.filesCard.open" });
  return (
    <Tooltip content={label}>
      <PanelToggleAction pressed={open} onPressedChange={onToggle} aria-label={label} data-testid="channel-files-toggle">
        {desktop ? formatMessage({ id: "channelHead.files" }) : <Paperclip />}
      </PanelToggleAction>
    </Tooltip>
  );
}
