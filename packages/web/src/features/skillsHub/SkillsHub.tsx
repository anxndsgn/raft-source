import { Badge, Button, Card, Checkbox, Input, Switch, Textarea } from "@botiverse/raft-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useIntl } from "react-intl";
import { Download, Package, Plus, Puzzle, Sparkles, Trash2 } from "lucide-react";
import { isExternalAgentRuntime } from "@botiverse/raft-shared";
import type {
  SkillsHubAgentCatalogResponse,
  SkillsHubGithubImportResponse,
  SkillsHubGithubScanResponse,
  SkillsHubAgentItemView,
  SkillsHubCatalogResponse,
  SkillsHubItemKind,
  SkillsHubItemView,
  SkillsHubMarketplaceSource,
} from "@botiverse/raft-shared";
import api from "../../api/client";
import SectionHeader from "../../components/ui/SectionHeader";
import { useServerPermissions } from "../../hooks/useServerPermissions";
import { useAgentStore } from "../../store/agentStore";

const GITHUB_URL_PLACEHOLDER = "https://github.com/owner/repo";

/** The file name itself, not prose: not translated. */
const SKILL_MD_FILE_NAME = "SKILL.md";

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

function marketplaceFromInput(value: string): SkillsHubMarketplaceSource | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^(https:\/\/|git@)/.test(trimmed) ? { source: "git", url: trimmed } : { source: "github", repo: trimmed };
}

/** Create/edit form for one hub item. Saves to the hub and returns the item. */
function SkillsHubItemEditor({
  draft,
  onCancel,
  onSaved,
}: {
  draft: Draft;
  onCancel: () => void;
  onSaved: (item: SkillsHubItemView) => void;
}) {
  const { formatMessage } = useIntl();
  const [value, setValue] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSkill = value.kind === "skill";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
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
    <Card className="space-y-3 p-4" data-testid="skills-hub-editor">
      <form className="space-y-3" onSubmit={submit}>
        <div className="text-subhead font-semibold text-foreground">
          {formatMessage({ id: value.id ? "skillsHub.editor.editTitle" : isSkill ? "skillsHub.editor.newSkill" : "skillsHub.editor.newPlugin" })}
        </div>
        <label className="block space-y-1">
          <span className="text-caption text-foreground-muted">
            {formatMessage({ id: isSkill ? "skillsHub.field.skillName" : "skillsHub.field.pluginName" })}
          </span>
          <Input
            value={value.name}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
            placeholder={isSkill ? "code-review" : "figma@claude-plugins-official"}
            required
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
              required
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
        {error && <div className="text-caption text-danger" role="alert">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {formatMessage({ id: "common.confirm.cancel" })}
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !value.name.trim()}>
            {formatMessage({ id: "skillsHub.action.save" })}
          </Button>
        </div>
      </form>
    </Card>
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

function AddButtons({ onAdd, onImport }: { onAdd: (kind: SkillsHubItemKind) => void; onImport: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={onImport} data-testid="skills-hub-import-github">
        <Download size={14} /> {formatMessage({ id: "skillsHub.action.importGithub" })}
      </Button>
      <Button variant="outline" size="sm" onClick={() => onAdd("skill")} data-testid="skills-hub-add-skill">
        <Plus size={14} /> {formatMessage({ id: "skillsHub.action.addSkill" })}
      </Button>
      <Button variant="outline" size="sm" onClick={() => onAdd("plugin")} data-testid="skills-hub-add-plugin">
        <Plus size={14} /> {formatMessage({ id: "skillsHub.action.addPlugin" })}
      </Button>
    </div>
  );
}


type ScanState = SkillsHubGithubScanResponse & { url: string };

/**
 * Import from GitHub: paste a repository (or a folder link), pick the skills
 * found in it, pick the agents to enable them for, import.
 */
function GithubImportPanel({
  defaultAgentIds,
  onCancel,
  onImported,
}: {
  defaultAgentIds: string[];
  onCancel: () => void;
  onImported: (items: SkillsHubItemView[]) => void;
}) {
  const { formatMessage } = useIntl();
  const allAgents = useAgentStore((s) => s.agents);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  const agents = useMemo(
    () => allAgents.filter((agent) => !agent.deletedAt && agent.external !== true && !isExternalAgentRuntime(agent.runtime)),
    [allAgents],
  );
  const [url, setUrl] = useState("");
  const [scan, setScan] = useState<ScanState | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(() => new Set(defaultAgentIds));
  const [busy, setBusy] = useState<"scan" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (allAgents.length === 0) void loadAgents();
  }, [allAgents.length, loadAgents]);

  const runScan = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("scan");
    setError(null);
    setScan(null);
    try {
      const { data } = await api.post<SkillsHubGithubScanResponse>("/skills-hub/github/scan", { url: url.trim() });
      setScan({ ...data, url: url.trim() });
      setSelectedPaths(new Set(data.skills.filter((skill) => !skill.existingItemId).map((skill) => skill.path)));
    } catch (err) {
      setError(errorMessage(err, formatMessage({ id: "skillsHub.import.error.scan" })));
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (!scan) return;
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

  const toggle = (set: Set<string>, value: string, on: boolean): Set<string> => {
    const next = new Set(set);
    if (on) next.add(value);
    else next.delete(value);
    return next;
  };

  return (
    <Card className="space-y-4 p-4" data-testid="skills-hub-github-import">
      <div className="text-subhead font-semibold text-foreground">{formatMessage({ id: "skillsHub.import.title" })}</div>
      <form className="flex gap-2" onSubmit={runScan}>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={GITHUB_URL_PLACEHOLDER}
          className="min-w-0 flex-1"
          required
          data-testid="skills-hub-github-url"
        />
        <Button type="submit" variant="outline" disabled={busy !== null || !url.trim()} data-testid="skills-hub-github-scan">
          {formatMessage({ id: busy === "scan" ? "skillsHub.import.scanning" : "skillsHub.import.scan" })}
        </Button>
      </form>
      <p className="text-caption text-foreground-hint">{formatMessage({ id: "skillsHub.import.urlHint" })}</p>

      {scan && scan.skills.length === 0 && (
        <div className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.import.none" })}</div>
      )}

      {scan && scan.skills.length > 0 && (
        <>
          <div className="space-y-2">
            <div className="text-caption font-semibold text-foreground-muted">
              {formatMessage({ id: "skillsHub.import.skillsFound" }, { count: scan.skills.length, repo: scan.repo, ref: scan.ref })}
            </div>
            <Card render={<ul />} className="max-h-80 divide-y divide-line-hairline overflow-y-auto">
              {scan.skills.map((skill) => (
                <li key={skill.path}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2">
                    <Checkbox
                      checked={selectedPaths.has(skill.path)}
                      onCheckedChange={(checked: boolean) => setSelectedPaths((prev) => toggle(prev, skill.path, checked))}
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
              <Card render={<ul />} className="max-h-64 divide-y divide-line-hairline overflow-y-auto">
                {agents.map((agent) => (
                  <li key={agent.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={selectedAgents.has(agent.id)}
                        onCheckedChange={(checked: boolean) => setSelectedAgents((prev) => toggle(prev, agent.id, checked))}
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

      {error && <div className="text-caption text-danger" role="alert">{error}</div>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy !== null}>
          {formatMessage({ id: "common.confirm.cancel" })}
        </Button>
        {scan && scan.skills.length > 0 && (
          <Button
            type="button"
            variant="primary"
            onClick={() => void runImport()}
            disabled={busy !== null || selectedPaths.size === 0}
            data-testid="skills-hub-github-confirm"
          >
            {formatMessage({ id: busy === "import" ? "skillsHub.import.importing" : "skillsHub.import.confirm" }, { count: selectedPaths.size })}
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Settings → Skills Hub: the server's shared skill & plugin library. */
export function SkillsHubSettingsSection() {
  const { formatMessage } = useIntl();
  const { capabilities } = useServerPermissions();
  const canManage = capabilities.manageIntegrations;
  const [items, setItems] = useState<SkillsHubItemView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);

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
        action={canManage && !draft && !importing
          ? <AddButtons onAdd={(kind) => setDraft(emptyDraft(kind))} onImport={() => setImporting(true)} />
          : undefined}
      />
      <p className="text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.description" })}</p>
      {error && <div className="text-caption text-danger" role="alert">{error}</div>}
      {importing && (
        <GithubImportPanel
          defaultAgentIds={[]}
          onCancel={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            void load();
          }}
        />
      )}
      {draft && (
        <SkillsHubItemEditor
          key={draft.id ?? `new-${draft.kind}`}
          draft={draft}
          onCancel={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            void load();
          }}
        />
      )}
      {items && items.length === 0 && !draft && !importing && (
        <Card className="p-4 text-caption text-foreground-muted">{formatMessage({ id: "skillsHub.empty" })}</Card>
      )}
      {items && items.length > 0 && (
        <Card render={<ul />} className="divide-y divide-line-hairline">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              <ItemSummary item={item} />
              {canManage && (
                <span className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDraft(draftFromItem(item))}>
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
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);

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
      {canManageHub && !draft && !importing && (
        <AddButtons onAdd={(kind) => setDraft(emptyDraft(kind))} onImport={() => setImporting(true)} />
      )}

      {importing && (
        <GithubImportPanel
          defaultAgentIds={[agentId]}
          onCancel={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            void load();
          }}
        />
      )}

      {draft && (
        <SkillsHubItemEditor
          draft={draft}
          onCancel={() => setDraft(null)}
          onSaved={(item) => {
            setDraft(null);
            // A new item added from an agent is enabled for that agent.
            void save([...enabledIds, item.id], catalog?.useHostSkills ?? true);
          }}
        />
      )}

      {catalog && catalog.items.length === 0 && !draft && !importing && (
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
