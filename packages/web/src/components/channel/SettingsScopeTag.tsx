import { useIntl } from "react-intl";
import { Badge } from "@botiverse/raft-ui";

import type { MessageId } from "../../i18n/messages/en";

/** Layout redesign (F6): who a group of channel settings affects — everyone, or only you. */
export function SettingsScopeTag({ labelId }: { labelId: "channel.details.affectsEveryone" | "channel.details.affectsOnlyYou" }) {
  const { formatMessage } = useIntl();
  return <Badge appearance="soft" variant="muted" data-testid={`settings-scope-${labelId.split(".").pop()}`}>{formatMessage({ id: labelId satisfies MessageId })}</Badge>;
}
