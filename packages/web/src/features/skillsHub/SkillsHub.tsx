import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
  Textarea,
} from "@botiverse/raft-ui";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useIntl } from "react-intl";
import { ChevronDown, ChevronRight, Download, Package, Plus, Puzzle, Sparkles, Trash2 } from "lucide-react";
import { isExternalAgentRuntime } from "@botiverse/raft-shared";
import type {
  SkillsHubAgentCatalogResponse,
  SkillsHubGithubImportResponse,
  SkillsHubGithubScanResponse,
  SkillsHubAgentItemView,
  SkillsHubCatalogResponse,
  SkillsHubItemKind,
  SkillsHubItemView,
  SkillsHubMarketplaceScanResponse,
  SkillsHubMarketplaceSource,
} from "@botiverse/raft-shared";
import api from "../../api/client";
import { DialogActions, DialogCommit, NarrowDialogContent } from "../../components/ui/NarrowDialog";
import SectionHeader from "../../components/ui/SectionHeader";
import { useServerPermissions } from "../../hooks/useServerPermissions";
import { useAgentStore } from "../../store/agentStore";

const GITHUB_URL_PLACEHOLDER = "https://github.com/owner/repo";
const MARKETPLACE_URL_PLACEHOLDER = "https://github.com/anthropics/claude-plugins-official";

/** The file name itself, not prose: not translated. */
const SKILL_MD_FILE_NAME = "SKILL.md";
/** Where a plugin marketplace keeps its manifest; shown as code, never broken across lines. */
const MARKETPLACE_MANIFEST_PATH = ".claude-plugin/marketplace.json";
const manifestPath = <code className="whitespace-nowrap font-mono text-mono-meta">{MARKETPLACE_MANIFEST_PATH}</code>;

const SKILL_TEMPLATE = `---
name: my-skill
description: What this skill does and when the agent should use it.
---

# My skill

Instructions for the agent.
`;

function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === "string" ? data.error : fallback;
}

function toggled(set: Set<string>, value: string, on: boolean): Set<string> {
  const next = new Set(set);
  if (on) next.add(value);
  else next.delete(value);
  return next;
}

type Draft = {
  id: string | null;
  kind: SkillsHubItemKind;
  name: string;
  description: string;
  content: string;
  marketplaceRepo: string;
};

function emptyDraft(kind: SkillsHubItemKind): Draft {
  return { id: null, kind, name: "", description: "", content: kind === "skill" ? SKILL_TEMPLATE : "", marketplaceRepo: "" };
}

function draftFromItem(item: SkillsHubItemView): Draft {
  const source = item.marketplaceSource;
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    description: item.description ?? "",
    content: item.content ?? "",
    marketplaceRepo: source ? (source.source === "github" ? source.repo : source.url) : "",
  };
}

/** A GitHub page link (`https://github.com/o/r/...`) is the `o/r` repository; another https/ssh URL is a git URL. */
function marketplaceFromInput(value: string): SkillsHubMarketplaceSource | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const github = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i.exec(trimmed);
  if (github) return { source: "github", repo: `${github[1]}/${github[2]}` };
  return /^(https:\/\/|git@)/.test(trimmed) ? { source: "git", url: trimmed } : { source: "github", repo: trimmed };
}

/**
 * The Skills Hub's dialogs: a title, a body, Cancel and one commit button
 * (the form's submit). A bottom sheet on a phone.
 */
function HubDialog({
  title,
  testId,
  busy,
  onClose,
  onSubmit,
  commit,
  children,
}: {
  title: string;
  testId: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** The submit button; none while there is nothing to commit yet. */
  commit: { label: string; disabled: boolean; loading: boolean; testId: string } | null;
  children: ReactNode;
}) {
  const { formatMessage } = useIntl();
  const titleId = useId();
  const handleOpenChange = useCallback((next: boolean) => {
    if (!next && !busy) onClose();
  }, [busy, onClose]);
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <NarrowDialogContent
        narrow="sheet"
        className="max-w-xl"
        aria-labelledby={titleId}
        data-testid={testId}
        title={title}
        titleId={titleId}
        closeLabel={formatMessage({ id: "common.close" })}
        closeDisabled={busy}
        header={null}
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogActions as={DialogHeader}>
            <DialogTitle id={titleId}>{title}</DialogTitle>
          </DialogActions>
          <DialogBody className="grid gap-4">{children}</DialogBody>
          <DialogActions as={DialogFooter}>
            <Button type="button" variant="ghost" size="lg" disabled={busy} onClick={onClose}>
              {formatMessage({ id: "common.confirm.cancel" })}
            </Button>
            {commit && (
              <DialogCommit>
                {(inHead) => (
                  <Button
                    type="submit"
                    variant="primary"
                    size={inHead ? "md" : "lg"}
                    loading={commit.loading}
                    disabled={commit.disabled}
                    data-testid={commit.testId}
                  >
                    {commit.label}
                  </Button>
                )}
              </DialogCommit>
            )}
          </DialogActions>
        </form>
      </NarrowDialogContent>
    </Dialog>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return <Banner status="warning" size="sm" role="alert">{error}</Banner>;
}

/** Create/edit dialog for one hub item. Saves to the hub and returns the item. */
function SkillsHubItemDialog({
  draft,
  onCancel,
  onSaved,
}: {
  draft: Draft;
  onCancel: () => void;
  onSaved: (item: SkillsHubItemView) => void;
}) {
  const { formatMessage } = useIntl();
  // oxlint-disable-next-line react-doctor/no-derived-useState -- the dialog mounts per opening and snapshots the draft; edits must not be overwritten.
  const [value, setValue] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSkill = value.kind === "skill";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !value.name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: value.name.trim(),
      description: value.description.trim() || null,
      ...(isSkill ? { content: value.content } : { marketplaceSource: marketplaceFromInput(value.marketplaceRepo) }),
    };
    try {
      const { data } = value.id
        ? await api.patch<SkillsHubItemView>(`/skills-hub/items/${value.id}`, payload)
        : await api.post<SkillsHubItemView>("/skills-hub/items", { kind: value.kind, ...payload });
      onSaved(data);
    } catch (err) {
      setError(errorMessage(err, formatMessage({ id: "skillsHub.error.save" })));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HubDialog
      title={formatMessage({ id: value.id ? "skillsHub.editor.editTitle" : isSkill ? "skillsHub.editor.newSkill" : "skillsHub.editor.newPlugin" })}
      testId="skills-hub-editor"
      busy={saving}
      onClose={onCancel}
      onSubmit={(event) => void submit(event)}
      commit={{
        label: formatMessage({ id: "skillsHub.action.save" }),
        disabled: !value.name.trim() || (isSkill && !value.content.trim()),
        loading: saving,
        testId: "skills-hub-save",
      }}
    >
      <label className="block space-y-1">
        <span className="text-caption text-foreground-muted">
          {formatMessage({ id: isSkill ? "skillsHub.field.skillName" : "skillsHub.field.pluginName" })}
        </span>
        <Input
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
          placeholder={isSkill ? "code-review" : "figma@claude-plugins-official"}
          autoFocus
          data-testid="skills-hub-name"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.field.description" })}</span>
        <Input value={value.description} onChange={(e) => setValue({ ...value, description: e.target.value })} />
      </label>
      {isSkill ? (
        <label className="block space-y-1">
          <span className="text-caption text-foreground-muted">{SKILL_MD_FILE_NAME}</span>
          <Textarea
            value={value.content}
            onChange={(e) => setValue({ ...value, content: e.target.value })}
            rows={14}
            className="font-mono text-mono-meta"
            data-testid="skills-hub-content"
          />
        </label>
      ) : (
        <label className="block space-y-1">
          <span className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.field.marketplace" })}</span>
          <Input
            value={value.marketplaceRepo}
            onChange={(e) => setValue({ ...value, marketplaceRepo: e.target.value })}
            placeholder="anthropics/claude-plugins-official"
          />
          <span className="block text-caption text-foreground-hint">{formatMessage({ id: "skillsHub.field.marketplaceHint" })}</span>
        </label>
      )}
      <ErrorBanner error={error} />
    </HubDialog>
  );
}

function KindIcon({ kind }: { kind: SkillsHubItemKind }) {
  return kind === "skill"
    ? <Sparkles size={14} className="shrink-0 text-foreground-hint" />
    : <Puzzle size={14} className="shrink-0 text-foreground-hint" />;
}

function ItemSummary({ item }: { item: SkillsHubItemView }) {
  const { formatMessage } = useIntl();
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex min-w-0 items-center gap-2">
        <KindIcon kind={item.kind} />
        <span className="truncate text-callout font-semibold text-foreground">{item.name}</span>
        <Badge appearance="outline" className="shrink-0">
          {formatMessage({ id: item.kind === "skill" ? "skillsHub.kind.skill" : "skillsHub.kind.plugin" })}
        </Badge>
      </span>
      {item.description && <span className="truncate pl-[22px] text-caption text-foreground-muted">{item.description}</span>}
      {item.source && (
        <span className="truncate pl-[22px] text-caption text-foreground-hint">
          {formatMessage(
            { id: "skillsHub.item.githubSource" },
            { repo: item.source.repo, ref: item.source.ref, files: item.fileCount },
          )}
        </span>
      )}
    </span>
  );
}

type HubDialogState =
  | { type: "editor"; draft: Draft }
  | { type: "import" }
  | { type: "plugins" };

function AddButtons({ onOpen }: { onOpen: (dialog: HubDialogState) => void }) {
  const { formatMessage } = useIntl();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => onOpen({ type: "import" })} data-testid="skills-hub-import-github">
        <Download size={14} /> {formatMessage({ id: "skillsHub.action.importGithub" })}
      </Button>
      <Button variant="outline" size="sm" onClick={() => onOpen({ type: "editor", draft: emptyDraft("skill") })} data-testid="skills-hub-add-skill">
        <Plus size={14} /> {formatMessage({ id: "skillsHub.action.addSkill" })}
      </Button>
      <Button variant="outline" size="sm" onClick={() => onOpen({ type: "plugins" })} data-testid="skills-hub-add-plugin">
        <Plus size={14} /> {formatMessage({ id: "skillsHub.action.addPlugin" })}
      </Button>
    </div>
  );
}

/** A repository address, and the button that reads it. Enter in the field reads it too. */
function RepoField({
  url,
  onUrlChange,
  placeholder,
  hint,
  error,
  scanLabel,
  scanning,
  disabled,
  onScan,
  testId,
}: {
  url: string;
  onUrlChange: (url: string) => void;
  placeholder: string;
  hint: ReactNode;
  /** A failed read, shown under the field in place of the hint. */
  error?: ReactNode;
  scanLabel: string;
  scanning: boolean;
  disabled: boolean;
  onScan: () => void;
  testId: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!disabled && url.trim()) onScan();
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1"
          autoFocus
          data-testid={`${testId}-url`}
        />
        <Button type="button" variant="outline" loading={scanning} disabled={disabled || !url.trim()} onClick={onScan} data-testid={`${testId}-scan`}>
          {scanLabel}
        </Button>
      </div>
      {error
        ? <p className="text-caption text-danger" role="alert" data-testid={`${testId}-error`}>{error}</p>
        : <p className="text-caption text-foreground-hint">{hint}</p>}
    </div>
  );
}

/** Agents a hub item can be enabled for (Raft-run agents only). */
function useHubAgents() {
  const allAgents = useAgentStore((s) => s.agents);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  useEffect(() => {
    if (allAgents.length === 0) void loadAgents();
  }, [allAgents.length, loadAgents]);
  return useMemo(
    () => allAgents.filter((agent) => !agent.deletedAt && agent.external !== true && !isExternalAgentRuntime(agent.runtime)),
    [allAgents],
  );
}

type ScanState = SkillsHubGithubScanResponse & { url: string };

/**
 * Import from GitHub: paste a repository (or a folder link), pick the skills
 * found in it, pick the agents to enable them for, import.
 */
function GithubImportDialog({
  defaultAgentIds,
  onCancel,
  onImported,
}: {
  defaultAgentIds: string[];
  onCancel: () => void;
  onImported: (items: SkillsHubItemView[]) => void;
}) {
  const { formatMessage } = useIntl();
  const agents = useHubAgents();
  const [url, setUrl] = useState("");
  const [scan, setScan] = useState<ScanState | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(() => new Set(defaultAgentIds));
  const [busy, setBusy] = useState<"scan" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const runScan = async () => {
    setBusy("scan");
    setError(null);
    setScanError(null);
    setScan(null);
    try {
      const { data } = await api.post<SkillsHubGithubScanResponse>("/skills-hub/github/scan", { url: url.trim() });
      setScan({ ...data, url: url.trim() });
      setSelectedPaths(new Set(data.skills.filter((skill) => !skill.existingItemId).map((skill) => skill.path)));
    } catch (err) {
      setScanError(errorMessage(err, formatMessage({ id: "skillsHub.import.error.scan" })));
    } finally {
      setBusy(null);
    }
  };

  const runImport = async (event: FormEvent) => {
    event.preventDefault();
    if (!scan || busy || selectedPaths.size === 0) return;
    setBusy("import");
    setError(null);
    try {
      const { data } = await api.post<SkillsHubGithubImportResponse>("/skills-hub/github/import", {
        url: scan.url,
        commitSha: scan.commitSha,
        paths: [...selectedPaths],
        agentIds: [...selectedAgents],
      });
      onImported(data.items);
    } catch (err) {
      setError(errorMessage(err, formatMessage({ id: "skillsHub.import.error.import" })));
    } finally {
      setBusy(null);
    }
  };

  return (
    <HubDialog
      title={formatMessage({ id: "skillsHub.import.title" })}
      testId="skills-hub-github-import"
      busy={busy !== null}
      onClose={onCancel}
      onSubmit={(event) => void runImport(event)}
      commit={scan && scan.skills.length > 0 ? {
        label: formatMessage({ id: "skillsHub.import.confirm" }, { count: selectedPaths.size }),
        disabled: busy !== null || selectedPaths.size === 0,
        loading: busy === "import",
        testId: "skills-hub-github-confirm",
      } : null}
    >
      <RepoField
        url={url}
        onUrlChange={setUrl}
        placeholder={GITHUB_URL_PLACEHOLDER}
        hint={formatMessage({ id: "skillsHub.import.urlHint" })}
        error={scanError}
        scanLabel={formatMessage({ id: "skillsHub.import.scan" })}
        scanning={busy === "scan"}
        disabled={busy !== null}
        onScan={() => void runScan()}
        testId="skills-hub-github"
      />

      {scan && scan.skills.length === 0 && (
        <div className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.import.none" })}</div>
      )}

      {scan && scan.skills.length > 0 && (
        <>
          <div className="space-y-2">
            <div className="text-caption font-semibold text-foreground-muted">
              {formatMessage({ id: "skillsHub.import.skillsFound" }, { count: scan.skills.length, repo: scan.repo, ref: scan.ref })}
            </div>
            <Card render={<ul />} className="max-h-72 divide-y divide-line-hairline overflow-y-auto">
              {scan.skills.map((skill) => (
                <li key={skill.path}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2">
                    <Checkbox
                      checked={selectedPaths.has(skill.path)}
                      onCheckedChange={(checked: boolean) => setSelectedPaths((prev) => toggled(prev, skill.path, checked))}
                      data-testid={`skills-hub-import-skill-${skill.name}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-callout font-semibold text-foreground">{skill.name}</span>
                        {skill.existingItemId && (
                          <Badge appearance="outline" className="shrink-0">{formatMessage({ id: "skillsHub.import.exists" })}</Badge>
                        )}
                      </span>
                      {skill.description && <span className="line-clamp-2 text-caption text-foreground-muted">{skill.description}</span>}
                      <span className="truncate text-caption text-foreground-hint">
                        {formatMessage({ id: "skillsHub.import.skillMeta" }, { path: skill.path || "/", files: skill.fileCount })}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </Card>
          </div>

          <div className="space-y-2">
            <div className="text-caption font-semibold text-foreground-muted">{formatMessage({ id: "skillsHub.import.agents" })}</div>
            {agents.length === 0 ? (
              <div className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.import.noAgents" })}</div>
            ) : (
              <Card render={<ul />} className="max-h-56 divide-y divide-line-hairline overflow-y-auto">
                {agents.map((agent) => (
                  <li key={agent.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={selectedAgents.has(agent.id)}
                        onCheckedChange={(checked: boolean) => setSelectedAgents((prev) => toggled(prev, agent.id, checked))}
                        data-testid={`skills-hub-import-agent-${agent.name}`}
                      />
                      <span className="truncate text-callout text-foreground">{agent.displayName || agent.name}</span>
                    </label>
                  </li>
                ))}
              </Card>
            )}
          </div>
        </>
      )}

      <ErrorBanner error={error} />
    </HubDialog>
  );
}

type MarketplaceScanState = SkillsHubMarketplaceScanResponse & { url: string };

/**
 * Add plugins: paste a GitHub plugin marketplace, pick the plugins listed in
 * its `.claude-plugin/marketplace.json`, add them (each saved as
 * `plugin@marketplace` with the repository as its marketplace). A plugin id
 * can still be typed by hand, for a marketplace that is not on GitHub.
 */
function PluginMarketplaceDialog({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (items: SkillsHubItemView[]) => void;
}) {
  const { formatMessage } = useIntl();
  const [url, setUrl] = useState("");
  const [scan, setScan] = useState<MarketplaceScanState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState(false);
  const [manualId, setManualId] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualMarketplace, setManualMarketplace] = useState("");
  const [busy, setBusy] = useState<"scan" | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<ReactNode>(null);
  // Plugins already saved when a later one failed: the hub has them, so
  // closing reports them like a finished add.
  const added = useRef<SkillsHubItemView[]>([]);

  const close = () => (added.current.length > 0 ? onAdded(added.current) : onCancel());

  const runScan = async () => {
    setBusy("scan");
    setError(null);
    setScanError(null);
    setScan(null);
    try {
      const { data } = await api.post<SkillsHubMarketplaceScanResponse>("/skills-hub/plugins/scan", { url: url.trim() });
      setScan({ ...data, url: url.trim() });
      const fresh = data.plugins.filter((plugin) => !plugin.existingItemId);
      // One plugin: nothing to choose.
      setSelected(new Set(fresh.length === 1 ? [fresh[0]!.id] : []));
    } catch (err) {
      const code = (err as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
      setScanError(code === "skills_hub_github_not_found"
        ? formatMessage({ id: "skillsHub.plugin.error.notFound" }, { file: manifestPath })
        : errorMessage(err, formatMessage({ id: "skillsHub.plugin.error.scan" })));
    } finally {
      setBusy(null);
    }
  };

  const canAddManual = manual && manualId.trim().length > 0;
  const addCount = manual ? (canAddManual ? 1 : 0) : selected.size;

  const runAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || addCount === 0) return;
    setBusy("add");
    setError(null);
    try {
      if (manual) {
        const { data } = await api.post<SkillsHubItemView>("/skills-hub/items", {
          kind: "plugin",
          name: manualId.trim(),
          description: manualDescription.trim() || null,
          marketplaceSource: marketplaceFromInput(manualMarketplace),
        });
        onAdded([...added.current, data]);
        return;
      }
      if (!scan) return;
      for (const plugin of scan.plugins.filter((p) => selected.has(p.id))) {
        const { data } = await api.post<SkillsHubItemView>("/skills-hub/items", {
          kind: "plugin",
          name: plugin.id,
          description: plugin.description,
          marketplaceSource: { source: "github", repo: scan.repo },
        });
        added.current = [...added.current, data];
        setScan((prev) => prev && {
          ...prev,
          plugins: prev.plugins.map((p) => (p.id === plugin.id ? { ...p, existingItemId: data.id } : p)),
        });
        setSelected((prev) => toggled(prev, plugin.id, false));
      }
      onAdded(added.current);
    } catch (err) {
      setError(errorMessage(err, formatMessage({ id: "skillsHub.error.save" })));
    } finally {
      setBusy(null);
    }
  };

  const showCommit = manual || (scan !== null && scan.plugins.length > 0);

  return (
    <HubDialog
      title={formatMessage({ id: "skillsHub.plugin.title" })}
      testId="skills-hub-plugin-dialog"
      busy={busy !== null}
      onClose={close}
      onSubmit={(event) => void runAdd(event)}
      commit={showCommit ? {
        label: manual || addCount === 0
          ? formatMessage({ id: "skillsHub.action.addPlugin" })
          : formatMessage({ id: "skillsHub.plugin.confirm" }, { count: addCount }),
        disabled: busy !== null || addCount === 0,
        loading: busy === "add",
        testId: "skills-hub-plugin-confirm",
      } : null}
    >
      <RepoField
        url={url}
        onUrlChange={setUrl}
        placeholder={MARKETPLACE_URL_PLACEHOLDER}
        hint={formatMessage({ id: "skillsHub.plugin.urlHint" }, { file: manifestPath })}
        // A read that failed belongs to the marketplace list; typing an ID by hand does not need it.
        error={manual ? null : scanError}
        scanLabel={formatMessage({ id: "skillsHub.plugin.scan" })}
        scanning={busy === "scan"}
        disabled={busy !== null}
        onScan={() => void runScan()}
        testId="skills-hub-plugin"
      />

      {!manual && scan && scan.plugins.length === 0 && (
        <div className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.plugin.none" })}</div>
      )}

      {!manual && scan && scan.plugins.length > 0 && (
        <div className="space-y-2">
          <div className="text-caption font-semibold text-foreground-muted">
            {formatMessage(
              { id: "skillsHub.plugin.found" },
              { count: scan.plugins.length, marketplace: scan.marketplace, repo: scan.repo, ref: scan.ref },
            )}
          </div>
          <Card render={<ul />} className="max-h-80 divide-y divide-line-hairline overflow-y-auto">
            {scan.plugins.map((plugin) => {
              const exists = plugin.existingItemId !== null;
              return (
                <li key={plugin.id}>
                  <label className={exists ? "flex items-start gap-3 px-3 py-2 opacity-60" : "flex cursor-pointer items-start gap-3 px-3 py-2"}>
                    <Checkbox
                      checked={exists || selected.has(plugin.id)}
                      disabled={exists || busy !== null}
                      onCheckedChange={(checked: boolean) => setSelected((prev) => toggled(prev, plugin.id, checked))}
                      data-testid={`skills-hub-plugin-${plugin.name}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-callout font-semibold text-foreground">{plugin.name}</span>
                        {plugin.version && <span className="shrink-0 text-caption text-foreground-hint">{plugin.version}</span>}
                        {exists && (
                          <Badge appearance="outline" className="shrink-0">{formatMessage({ id: "skillsHub.import.exists" })}</Badge>
                        )}
                      </span>
                      {plugin.description && <span className="line-clamp-2 text-caption text-foreground-muted">{plugin.description}</span>}
                      <span className="truncate font-mono text-mono-meta text-foreground-hint">{plugin.id}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </Card>
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          className="flex items-center gap-1 text-caption text-foreground-muted hover:text-foreground"
          aria-expanded={manual}
          onClick={() => {
            // A marketplace that was read is the likely one; a failed address is never carried over.
            if (!manual && !manualMarketplace && scan) setManualMarketplace(scan.repo);
            setManual(!manual);
          }}
          data-testid="skills-hub-plugin-manual-toggle"
        >
          {manual ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {formatMessage({ id: "skillsHub.plugin.manualToggle" })}
        </button>
        {manual && (
          <>
            <label className="block space-y-1">
              <span className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.field.pluginName" })}</span>
              <Input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="figma@claude-plugins-official"
                data-testid="skills-hub-plugin-manual-id"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.field.marketplace" })}</span>
              <Input
                value={manualMarketplace}
                onChange={(e) => setManualMarketplace(e.target.value)}
                placeholder="anthropics/claude-plugins-official"
                data-testid="skills-hub-plugin-manual-marketplace"
              />
              <span className="block text-caption text-foreground-hint">{formatMessage({ id: "skillsHub.field.marketplaceHint" })}</span>
            </label>
            <label className="block space-y-1">
              <span className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.field.description" })}</span>
              <Input value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} />
            </label>
          </>
        )}
      </div>

      <ErrorBanner error={error} />
    </HubDialog>
  );
}

/** The open add/edit dialog, if any. */
function HubDialogs({
  dialog,
  defaultAgentIds,
  onClose,
  onSaved,
}: {
  dialog: HubDialogState | null;
  defaultAgentIds: string[];
  onClose: () => void;
  /** Items added or changed; `enabledByImport` is true when the import already enabled them for the chosen agents. */
  onSaved: (items: SkillsHubItemView[], enabledByImport: boolean) => void;
}) {
  if (!dialog) return null;
  if (dialog.type === "import") {
    return <GithubImportDialog defaultAgentIds={defaultAgentIds} onCancel={onClose} onImported={(items) => onSaved(items, true)} />;
  }
  if (dialog.type === "plugins") {
    return <PluginMarketplaceDialog onCancel={onClose} onAdded={(items) => onSaved(items, false)} />;
  }
  return (
    <SkillsHubItemDialog
      key={dialog.draft.id ?? `new-${dialog.draft.kind}`}
      draft={dialog.draft}
      onCancel={onClose}
      onSaved={(item) => onSaved(dialog.draft.id ? [] : [item], false)}
    />
  );
}

/** Settings → Skills Hub: the server's shared skill & plugin library. */
export function SkillsHubSettingsSection() {
  const { formatMessage } = useIntl();
  const { capabilities } = useServerPermissions();
  const canManage = capabilities.manageIntegrations;
  const [items, setItems] = useState<SkillsHubItemView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<HubDialogState | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<SkillsHubCatalogResponse>("/skills-hub/items");
      setItems(data.items);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, formatMessage({ id: "skillsHub.error.load" })));
    }
  }, [formatMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (item: SkillsHubItemView) => {
    if (!window.confirm(formatMessage({ id: "skillsHub.confirm.delete" }, { name: item.name }))) return;
    try {
      await api.delete(`/skills-hub/items/${item.id}`);
      await load();
    } catch (err) {
      setError(errorMessage(err, formatMessage({ id: "skillsHub.error.save" })));
    }
  };

  return (
    <section className="space-y-3" data-testid="skills-hub-settings">
      <SectionHeader
        label={formatMessage({ id: "skillsHub.title" })}
        icon={<Package size={16} />}
        count={items?.length}
        action={canManage ? <AddButtons onOpen={setDialog} /> : undefined}
      />
      <p className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.description" })}</p>
      {error && <div className="text-caption text-danger" role="alert">{error}</div>}
      <HubDialogs
        dialog={dialog}
        defaultAgentIds={[]}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null);
          void load();
        }}
      />
      {items && items.length === 0 && (
        <Card className="p-4 text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.empty" })}</Card>
      )}
      {items && items.length > 0 && (
        <Card render={<ul />} className="divide-y divide-line-hairline">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              <ItemSummary item={item} />
              {canManage && (
                <span className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ type: "editor", draft: draftFromItem(item) })}>
                    {formatMessage({ id: "skillsHub.action.edit" })}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void remove(item)}
                    aria-label={formatMessage({ id: "skillsHub.action.delete" })}
                  >
                    <Trash2 size={14} />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </Card>
      )}
    </section>
  );
}

/**
 * Agent → Skills tab: enable hub items for this agent and decide whether it
 * may also use the skills installed on its computer.
 */
export function AgentSkillsHubTab({ agentId, runtime }: { agentId: string; runtime?: string | null }) {
  const { formatMessage } = useIntl();
  const { capabilities } = useServerPermissions();
  const canManageHub = capabilities.manageIntegrations;
  const [catalog, setCatalog] = useState<SkillsHubAgentCatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<HubDialogState | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<SkillsHubAgentCatalogResponse>(`/skills-hub/agents/${agentId}`);
      setCatalog(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, formatMessage({ id: "skillsHub.error.load" })));
    }
  }, [agentId, formatMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (enabledItemIds: string[], useHostSkills: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.put<SkillsHubAgentCatalogResponse>(`/skills-hub/agents/${agentId}`, { enabledItemIds, useHostSkills });
      setCatalog(data);
    } catch (err) {
      setError(errorMessage(err, formatMessage({ id: "skillsHub.error.save" })));
    } finally {
      setSaving(false);
    }
  }, [agentId, formatMessage]);

  const enabledIds = useMemo(
    () => (catalog?.items ?? []).filter((item) => item.enabled).map((item) => item.id),
    [catalog],
  );

  const toggleItem = (item: SkillsHubAgentItemView, enabled: boolean) => {
    if (!catalog) return;
    const next = enabled ? [...enabledIds, item.id] : enabledIds.filter((id) => id !== item.id);
    void save(next, catalog.useHostSkills);
  };

  const groups: Array<{ kind: SkillsHubItemKind; items: SkillsHubAgentItemView[] }> = useMemo(() => {
    const items = catalog?.items ?? [];
    return [
      { kind: "skill", items: items.filter((item) => item.kind === "skill") },
      { kind: "plugin", items: items.filter((item) => item.kind === "plugin") },
    ];
  }, [catalog]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 [&>*]:shrink-0" data-testid="agent-skills-hub-tab">
      <Card className="flex items-start gap-3 p-4">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-callout font-semibold text-foreground">{formatMessage({ id: "skillsHub.hostSkills.title" })}</span>
          <span className="text-caption text-foreground-muted">
            {formatMessage({ id: catalog?.useHostSkills === false ? "skillsHub.hostSkills.off" : "skillsHub.hostSkills.on" })}
          </span>
          {runtime === "codex" && (
            <span className="text-caption text-foreground-hint">{formatMessage({ id: "skillsHub.hostSkills.codexNote" })}</span>
          )}
        </span>
        <Switch
          checked={catalog?.useHostSkills ?? true}
          disabled={!catalog || saving}
          onCheckedChange={(checked: boolean) => void save(enabledIds, checked)}
          data-testid="skills-hub-use-host-skills"
        />
      </Card>

      {error && <div className="text-caption text-danger" role="alert">{error}</div>}

      <SectionHeader
        label={formatMessage({ id: "skillsHub.agent.enabledTitle" })}
        icon={<Package size={16} />}
        count={enabledIds.length}
      />
      <p className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.agent.restartNote" })}</p>
      {/* The agent panel is narrow: the add buttons get their own row so the title never wraps. */}
      {canManageHub && <AddButtons onOpen={setDialog} />}

      <HubDialogs
        dialog={dialog}
        defaultAgentIds={[agentId]}
        onClose={() => setDialog(null)}
        onSaved={(items, enabledByImport) => {
          setDialog(null);
          // A new item added from an agent is enabled for that agent (an
          // import already enabled it for the agents chosen in it).
          if (enabledByImport || items.length === 0) void load();
          else void save([...enabledIds, ...items.map((item) => item.id)], catalog?.useHostSkills ?? true);
        }}
      />

      {catalog && catalog.items.length === 0 && (
        <Card className="p-4 text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.agent.empty" })}</Card>
      )}

      {groups.map(({ kind, items }) => items.length > 0 && (
        <div key={kind} className="space-y-2">
          <div className="text-caption font-semibold text-foreground-muted">
            {formatMessage({ id: kind === "skill" ? "skillsHub.group.skills" : "skillsHub.group.plugins" })}
          </div>
          <Card render={<ul />} className="divide-y divide-line-hairline">
            {items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                  <ItemSummary item={item} />
                  <Switch
                    checked={item.enabled}
                    disabled={saving}
                    onCheckedChange={(checked: boolean) => toggleItem(item, checked)}
                    data-testid={`skills-hub-toggle-${item.name}`}
                  />
                </label>
              </li>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
