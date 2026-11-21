import { Dialog, DialogBody, DialogClose, DialogHeader, DialogSheetContent, DialogTitle } from "@botiverse/raft-ui";
import { useIntl } from "react-intl";
import type { ServerAppearanceControls } from "../../components/settings/useServerAppearance";
import { useThemeTweak } from "../../hooks/useThemeTweak";
import { ThemeEditorPanel } from "./ThemeEditorPanel";

/**
 * Edit theme from Settings › Theme: the same panel in a small centred dialog,
 * a sheet on a phone. It shares the page's appearance controls, so the grid
 * and the panel save through one sequence.
 */
export function ThemeEditorDialog({
  open,
  onOpenChange,
  appearance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appearance: ServerAppearanceControls;
}) {
  const { formatMessage } = useIntl();
  // Re-rendered with the tweak, so the portal carries `data-theme-tweak` from its first change on (theme-scope.ts).
  useThemeTweak();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogSheetContent size="sm" data-testid="theme-editor-dialog">
        <DialogHeader>
          <DialogTitle>{formatMessage({ id: "themeEditor.title" })}</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          <ThemeEditorPanel appearance={appearance} Title={null} />
        </DialogBody>
      </DialogSheetContent>
    </Dialog>
  );
}
