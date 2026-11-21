import type { RefObject } from "react";
import { Popover, PopoverContent, PopoverTitle } from "@botiverse/raft-ui";
import { useServerAppearance } from "../../components/settings/useServerAppearance";
import { useThemeTweak } from "../../hooks/useThemeTweak";
import { ThemeEditorPanel } from "./ThemeEditorPanel";

/**
 * Edit theme as a popover beside an anchor: the rail's server avatar opens it
 * on a right-click or a long press (LeftRail). 320px wide, 16px in. Closing
 * keeps every change.
 */
export function ThemeEditorPopover({
  open,
  onOpenChange,
  anchor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: RefObject<HTMLElement | null>;
}) {
  // Re-rendered with the tweak, so the portal carries `data-theme-tweak` from its first change on (theme-scope.ts).
  useThemeTweak();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent
        anchor={anchor}
        side="right"
        align="start"
        sideOffset={8}
        alignOffset={4}
        className="w-80 p-4"
        data-testid="theme-editor-popover"
      >
        <ThemeEditorPopoverBody />
      </PopoverContent>
    </Popover>
  );
}

// Mounted only while the popover is open: the look is read fresh each time it opens.
function ThemeEditorPopoverBody() {
  const appearance = useServerAppearance();
  return <ThemeEditorPanel appearance={appearance} Title={PopoverTitle} />;
}
