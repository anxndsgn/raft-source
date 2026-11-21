import { Check, Palette, Smile, SunMoon } from "lucide-react";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import {
  Badge,
  Button,
  Card,
  ListRow,
  ListRowBody,
  ListRowDescription,
  ListRowGroup,
  ListRowTitle,
  RadioGroup,
  RadioGroupItem,
  Switch,
} from "@botiverse/raft-ui";
import { PRO_RAFT_THEME_IDS } from "@botiverse/raft-shared";
import type { RaftThemeId } from "@botiverse/raft-shared";
import type { MessageId } from "../../i18n/messages";
import { useOptionalAppTheme } from "../../hooks/useAppTheme";
import { usePaywallShown } from "../../analytics/paywall";
import { raftThemeHasDecor } from "../../theme/serverTheme";
import type { AppResolvedMode } from "../../theme/appTheme";
import { ThemeEditorDialog } from "../../features/theme-editor/ThemeEditorDialog";
import Banner from "../ui/Banner";
import SectionHeader from "../ui/SectionHeader";
import { AppearanceThemeSettingsControl } from "./AppearanceThemePicker";
import { RAFT_THEME_NAME_ID } from "./raftThemeNames";
import AssistantSettingChanges from "./AssistantSettingChanges";
import { useServerAppearance } from "./useServerAppearance";

export { RAFT_THEME_NAME_ID } from "./raftThemeNames";

/** What a personal assistant may change here, listed under the picker. */
// The sidebar order and pins the assistant changed show here too (#proj-assistant:#19 owner actions).
const THEME_SETTINGS = ["theme", "themeDecor", "sidebarMove", "sidebarPin", "sidebarArrange"] as const;

const BASIC_THEMES: RaftThemeId[] = ["raft", "boring"];
const AVATAR_THEMES: RaftThemeId[] = ["bots", "critters", "space", "desk", "food", "quest", "weather", "plants", "spooky"];

/**
 * Settings › Theme: how the current server looks to this member, and only to
 * them (design/foundations/themes.md). Choosing applies at once and saves;
 * a failed save puts the previous look back. A Pro theme on a Free server
 * opens the upgrade dialog instead of saving (useServerAppearance). Edit
 * theme above the grid opens the panel that tweaks the frame colour and the
 * corners on this device (features/theme-editor).
 */
export default function ServerThemeSection() {
  const { formatMessage } = useIntl();
  const appearance = useServerAppearance();
  const { server, look, freePlan, error, pickTheme: handlePick, setDecor: handleDecorChange } = appearance;
  const mode = useOptionalAppTheme()?.resolvedMode ?? "light";
  const [editorOpen, setEditorOpen] = useState(false);
  const openEditor = useCallback(() => setEditorOpen(true), []);

  // On Free the Pro themes show locked: the paywall is on screen.
  usePaywallShown(freePlan && "pro_theme");

  if (!server || !look) return null;
  const hasDecor = raftThemeHasDecor(look.theme);

  const renderGroup = (titleId: MessageId, icon: ReactNode, themes: RaftThemeId[], description?: string) => (
    <section className="mb-6">
      <SectionHeader className={description ? "mb-1" : "mb-3"} icon={icon} label={formatMessage({ id: titleId })} />
      {description ? <p className="mb-3 text-footnote text-foreground-muted">{description}</p> : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(14rem,calc(50%-0.375rem)),1fr))] gap-3">
        {themes.map((theme) => (
          <ThemeOptionCard
            key={theme}
            theme={theme}
            mode={mode}
            label={formatMessage({ id: RAFT_THEME_NAME_ID[theme] })}
            selected={look.theme === theme}
            hint={theme === "raft" ? formatMessage({ id: "settings.theme.default" }) : null}
            proBadge={PRO_RAFT_THEME_IDS.includes(theme) ? formatMessage({ id: "billing.pro" }) : null}
            onSelect={handlePick}
          />
        ))}
      </div>
    </section>
  );

  return (
    // Full width like every settings page, its sections under SectionHeaders, no
    // lead-in line of its own (cindyz, #proj-raft-ui:#220).
    <div className="mb-6" data-testid="server-theme-section">
      {error ? <Banner intent="warning" density="sm" className="mb-4">{error}</Banner> : null}
      {/* Light or dark is saved on this device for every server (xxchan,
          #triage:56baf365); it lives here, by the themes, rather than in
          Appearance, so the setting has one place. */}
      <section id="theme" className="mb-6" data-testid="server-theme-mode">
        <SectionHeader className="mb-3" icon={<SunMoon size={16} />} label={formatMessage({ id: "settings.theme.groupMode" })} />
        <AppearanceThemeSettingsControl />
      </section>
      <div className="mb-3 flex">
        <Button variant="default" size="md" onClick={openEditor} data-testid="server-theme-edit">
          {formatMessage({ id: "themeEditor.title" })}
        </Button>
      </div>
      <ThemeEditorDialog open={editorOpen} onOpenChange={setEditorOpen} appearance={appearance} />
      <RadioGroup
        id="server-theme"
        value={look.theme}
        onValueChange={handlePick}
        aria-label={formatMessage({ id: "settings.tabs.theme" })}
        data-testid="server-theme-picker"
      >
        {renderGroup("settings.theme.groupBasics", <Palette size={16} />, BASIC_THEMES, formatMessage({ id: "settings.theme.description" }, { serverName: server.name }))}
        {renderGroup("settings.theme.groupAvatars", <Smile size={16} />, AVATAR_THEMES)}
      </RadioGroup>
      <ListRowGroup>
        <ListRow variant="plain" interactive={false}>
          <ListRowBody>
            <ListRowTitle id="server-theme-decor-label">{formatMessage({ id: "settings.theme.decorTitle" })}</ListRowTitle>
            {/* Only the state when there's none to show; no sentence describing the decor (HelperText step 1). */}
            {hasDecor ? null : (
              <ListRowDescription id="server-theme-decor-description" wrap>
                {formatMessage({ id: "settings.theme.decorUnavailable" })}
              </ListRowDescription>
            )}
          </ListRowBody>
          <Switch
            checked={hasDecor && look.decor}
            disabled={!hasDecor}
            onCheckedChange={handleDecorChange}
            aria-labelledby="server-theme-decor-label"
            aria-describedby={hasDecor ? undefined : "server-theme-decor-description"}
            data-testid="server-theme-decor-switch"
          />
        </ListRow>
      </ListRowGroup>
      <div className="mt-6">
        <AssistantSettingChanges settings={THEME_SETTINGS} />
      </div>
    </div>
  );
}

/**
 * One theme to choose: the RadioGroup option card AppearanceThemePicker uses
 * (the radio is the peer; checked draws a 1.5px strong border and a check),
 * over a live miniature of the app in that theme.
 */
function ThemeOptionCard({
  theme,
  mode,
  label,
  selected,
  hint,
  proBadge,
  onSelect,
}: {
  theme: RaftThemeId;
  mode: AppResolvedMode;
  label: string;
  selected: boolean;
  hint: string | null;
  proBadge: string | null;
  onSelect: (theme: string) => void;
}) {
  const handleClick = useCallback(() => onSelect(theme), [onSelect, theme]);
  return (
    <div className="group min-w-0" data-testid={`server-theme-${theme}`}>
      <RadioGroupItem appearance="none" value={theme} aria-label={label} className="peer" />
      <Card
        onClick={handleClick}
        className={[
          "h-full gap-2 p-2",
          "hover:overlay-subtle active:overlay-medium",
          "peer-focus-visible:shadow-focus",
          "peer-data-checked:border-[1.5px] peer-data-checked:border-line-strong peer-data-checked:p-[7.5px]",
        ].join(" ")}
      >
        <ThemeMiniature theme={theme} mode={mode} />
        <div className="flex min-w-0 items-center gap-1.5 px-1 pb-0.5">
          <span className="min-w-0 truncate text-callout font-semibold text-foreground">{label}</span>
          {hint ? <span className="shrink-0 text-footnote text-foreground-hint">{hint}</span> : null}
          {proBadge ? <Badge className="shrink-0">{proBadge}</Badge> : null}
          {selected ? <Check size={16} className="ml-auto shrink-0 text-foreground" aria-hidden="true" /> : null}
        </div>
      </Card>
    </div>
  );
}

/**
 * The app in miniature, wearing the theme: the box carries the mode class and
 * `data-theme`, so the frame, sidebar and paper tokens resolve to that theme's
 * own colors in the current mode.
 */
function ThemeMiniature({ theme, mode }: { theme: RaftThemeId; mode: AppResolvedMode }) {
  return (
    <div
      className={`${mode} flex aspect-[16/10] flex-col overflow-hidden rounded-control border border-line-seam bg-layer-frame`}
      data-theme={theme === "raft" ? undefined : theme}
      aria-hidden="true"
      data-testid={`server-theme-preview-${theme}`}
    >
      <div className="h-3 shrink-0 border-b border-line-seam bg-layer-frame" />
      <div className="flex min-h-0 flex-1">
        <div className="w-3 shrink-0 border-r border-line-seam bg-layer-frame" />
        <div className="flex w-1/3 shrink-0 flex-col gap-1 border-r border-line-seam bg-layer-sidebar p-1.5">
          <div className="h-1.5 w-3/4 rounded-[2px] bg-foreground/30" />
          <div className="h-2.5 rounded-[3px] border border-sticker-ink bg-brand" />
          <div className="h-1.5 w-2/3 rounded-[2px] bg-foreground/15" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 bg-layer-canvas p-2">
          <div className="h-1.5 w-1/2 rounded-[2px] bg-foreground/40" />
          <div className="h-1.5 w-3/4 rounded-[2px] bg-foreground/15" />
          <div className="h-1.5 w-2/3 rounded-[2px] bg-foreground/15" />
        </div>
      </div>
    </div>
  );
}
