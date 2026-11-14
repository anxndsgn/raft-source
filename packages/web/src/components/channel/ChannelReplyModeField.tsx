import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { ListRow, ListRowBody, ListRowDescription, ListRowTitle } from "@botiverse/raft-ui";
import { ImmediateRowSwitch, ImmediateSaveStatus, apiErrorText, useImmediateSave } from "../settings/ImmediateSetting";
import { useChannelStore } from "../../store/channelStore";

/**
 * Reply mode (shared/replyMode.ts): one switch that applies at once. On: no
 * new threads; people and agents reply to a message on the timeline, and old
 * threads stay readable but closed. Turning it on also retires in_review and
 * links existing task discussions (server). Only someone who can edit the
 * channel's info sees it (EditChannelDialog decides). A settings row of the
 * channel details' Channel settings group (the caller draws the ListRowGroup).
 */
export function ChannelReplyModeField({
  channelId,
  replyMode,
  disabled = false,
}: {
  channelId: string;
  replyMode: boolean | undefined;
  disabled?: boolean;
}) {
  const { formatMessage } = useIntl();
  const updateChannel = useChannelStore((s) => s.updateChannel);
  const save = useImmediateSave();
  // What the switch shows while a save is in flight; null = the stored value.
  const [pending, setPending] = useState<boolean | null>(null);
  const stored = replyMode === true;
  const checked = pending ?? stored;

  const handleChange = useCallback((next: boolean) => {
    setPending(next);
    void save.run(
      () => updateChannel(channelId, { replyMode: next }),
      (error) => apiErrorText(error, formatMessage({ id: "channel.edit.replyModeSaveFailed" })),
    ).finally(() => setPending(null));
  }, [channelId, formatMessage, save, updateChannel]);

  return (
    <ListRow variant="plain" interactive={false} data-testid="channel-settings-reply-mode">
      <ListRowBody>
        <ListRowTitle id="channel-settings-reply-mode-label">
          {formatMessage({ id: "channel.edit.replyModeTitle" })}
        </ListRowTitle>
        <ListRowDescription id="channel-settings-reply-mode-description" wrap>
          {formatMessage({ id: "channel.edit.replyModeDescription" })}
        </ListRowDescription>
        <ImmediateSaveStatus
          id="channel-settings-reply-mode-status"
          feedback={save.feedback}
          testId="channel-settings-reply-mode-status"
        />
      </ListRowBody>
      <ImmediateRowSwitch
        checked={checked}
        disabled={disabled || save.saving}
        onCheckedChange={handleChange}
        aria-labelledby="channel-settings-reply-mode-label"
        aria-describedby="channel-settings-reply-mode-description channel-settings-reply-mode-status"
        data-testid="channel-settings-reply-mode-switch"
      />
    </ListRow>
  );
}
