import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@botiverse/raft-ui";
import { ButtonSplit, ButtonSplitMain, ButtonSplitMenu, FitToolbarSplitButton } from "@botiverse/raft-ui/wip";
import { ArrowRightLeft, Bot, Plug } from "lucide-react";
import { useIntl } from "react-intl";
import { LIST_TOOLBAR_STEP } from "../../components/ui/listToolbar";
import type { AddAgentActions } from "./useAddAgentActions";

/**
 * Create agent, the primary action at the end of the Members toolbar
 * (raft-design members.md; cindyz, #triage:36bfa2f8): raft-ui's FitToolbarSplitButton
 * (button.md › Split buttons), primary in both parts. The main part opens
 * Create agent, + once the toolbar gives way (step 4); the ▾ opens a menu of
 * the other ways to add an agent the Members sidebar's + menu held: Connect
 * an external agent, always, and Take over a local session where it applies
 * (the desktop app's handoff bridge, `actions.openHandoff`).
 */
export function MembersCreateAgentButton({ actions, inHead = false }: {
  actions: AddAgentActions;
  /** In the page head (layout changes C, 11/21), not a toolbar: a plain split button that never shrinks to +. */
  inHead?: boolean;
}) {
  const { formatMessage } = useIntl();
  return (
    <DropdownMenu>
      {inHead ? (
        <ButtonSplit aria-label={formatMessage({ id: "members.page.createAgent.group" })}>
          <ButtonSplitMain variant="primary" onClick={actions.openCreate} data-testid="members-create-agent">
            <Bot />
            {formatMessage({ id: "layout.sidebar.createAgent" })}
          </ButtonSplitMain>
          <DropdownMenuTrigger
            render={<ButtonSplitMenu variant="primary" aria-label={formatMessage({ id: "members.page.createAgent.more" })} />}
            data-testid="members-create-agent-more"
          />
        </ButtonSplit>
      ) : (
      <FitToolbarSplitButton
        variant="primary"
        icon={<Bot />}
        plusOrder={LIST_TOOLBAR_STEP.primaryPlus}
        onClick={actions.openCreate}
        groupLabel={formatMessage({ id: "members.page.createAgent.group" })}
        menuLabel={formatMessage({ id: "members.page.createAgent.more" })}
        menuTrigger={<DropdownMenuTrigger data-testid="members-create-agent-more" />}
        data-testid="members-create-agent"
      >
        {formatMessage({ id: "layout.sidebar.createAgent" })}
      </FitToolbarSplitButton>
      )}
      <DropdownMenuContent side="bottom" align="end" sideOffset={4} className="min-w-[220px]">
        {actions.openHandoff ? (
          <DropdownMenuItem onClick={actions.openHandoff} data-testid="members-create-agent-handoff">
            <ArrowRightLeft />
            {formatMessage({ id: "layout.sidebar.handoffSession" })}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={actions.openExternal} data-testid="members-create-agent-external">
          <Plug />
          {formatMessage({ id: "members.page.createAgent.external" })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
