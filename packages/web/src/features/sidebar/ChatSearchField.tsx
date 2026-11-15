import { useCallback } from "react";
import { useIntl } from "react-intl";
import { Search } from "lucide-react";
import { SearchTrigger, SearchTriggerLabel } from "@botiverse/raft-ui";
import { useRailMode } from "../../hooks/useSidebarTab";

/**
 * Team page PRD §8: on a phone, Team took the Search tab's place; search is this field at the top of Chat
 * (raft-ui SearchTrigger, a button drawn as the field, as the web top bar's), which pushes the search page.
 */
export function ChatSearchField() {
  const { formatMessage } = useIntl();
  const { selectRailMode } = useRailMode();
  const open = useCallback(() => selectRailMode("search"), [selectRailMode]);
  return (
    <div className="shrink-0 px-4 pt-2 pb-1" data-testid="chat-search-field">
      <SearchTrigger onClick={open} className="w-full" data-testid="chat-search-trigger">
        <Search aria-hidden />
        <SearchTriggerLabel>{formatMessage({ id: "layout.leftRail.tabSearch" })}</SearchTriggerLabel>
      </SearchTrigger>
    </div>
  );
}
