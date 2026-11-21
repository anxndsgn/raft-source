import { useIntl } from "react-intl";
import { MessageAttachmentMetaStart } from "@botiverse/raft-ui";
import { formatFileSizeBytes } from "../../utils/fileSizePresentation";

export function AttachmentMetaText({
  label,
  sizeBytes,
}: {
  label: string;
  sizeBytes?: number;
}) {
  const { formatMessage } = useIntl();
  return (
    <MessageAttachmentMetaStart
      data-message-affordance="attachment-meta"
      // One space's width either side of the dot (Figmama mobile spec 11/21); the label gives way first.
      className="inline-flex max-w-full items-center gap-1 max-md:col-start-1"
    >
      <span data-message-affordance="attachment-meta-label" className="min-w-0 truncate">{label}</span>
      {sizeBytes && sizeBytes > 0 ? (
        <>
          <span className="shrink-0 text-foreground-hint">·</span>
          <span data-message-affordance="attachment-meta-size" className="shrink-0">{formatFileSizeBytes(sizeBytes, formatMessage)}</span>
        </>
      ) : null}
    </MessageAttachmentMetaStart>
  );
}
