import { Fragment, useCallback } from "react";
import { useIntl } from "react-intl";
import { ListFilter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PanelAction,
} from "@botiverse/raft-ui";

import type { ActivityFilterChoice } from "../../store/activityFilterPreference";
import { parseActivityFilterChoice } from "../../store/activityFilterPreference";
import Tooltip from "../../components/ui/Tooltip";
import { ACTIVITY_FILTER_ICON, ACTIVITY_FILTER_LABEL_ID, ACTIVITY_FILTER_MENU } from "./activityFilterMenu";

/** All's own lists (For me is the other tab): the old Filter menu without Mentions. */
const ALL_FILTER_MENU = ACTIVITY_FILTER_MENU.filter(({ choice }) => choice !== "mentions");

/**
 * Layout redesign (F4, anxndsgn 11/15): in the inbox's All, the earlier Filter
 * menu (Unread, Pinned, Saved, Artifacts) behind a filter icon where the bell
 * was. Marked while a list other than All is shown.
 */
export function InboxAllFilterMenu({ active, onChoose }: { active: ActivityFilterChoice; onChoose: (choice: ActivityFilterChoice) => void }) {
  const { formatMessage } = useIntl();
  const label = formatMessage({ id: "thread.filter.button" });
  const handleChange = useCallback((value: unknown) => onChoose(parseActivityFilterChoice(value)), [onChoose]);
  return (
    <DropdownMenu>
      <Tooltip content={active === "all" ? label : formatMessage({ id: ACTIVITY_FILTER_LABEL_ID[active] })}>
        <DropdownMenuTrigger
          render={<PanelAction aria-label={label} data-testid="inbox-filter-button" className={active === "all" ? undefined : "bg-selected text-sticker-ink"} />}
        >
          <ListFilter aria-hidden />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent aria-label={formatMessage({ id: "thread.filter.ariaLabel" })} data-testid="inbox-filter-menu">
        <DropdownMenuRadioGroup value={active} onValueChange={handleChange}>
          {ALL_FILTER_MENU.map(({ choice, separated }) => {
            const Icon = ACTIVITY_FILTER_ICON[choice];
            return (
              <Fragment key={choice}>
                {separated && <DropdownMenuSeparator />}
                <DropdownMenuRadioItem value={choice} data-testid={`inbox-filter-${choice}`}>
                  <Icon aria-hidden />
                  <DropdownMenuItemLabel>{formatMessage({ id: ACTIVITY_FILTER_LABEL_ID[choice] })}</DropdownMenuItemLabel>
                </DropdownMenuRadioItem>
              </Fragment>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
