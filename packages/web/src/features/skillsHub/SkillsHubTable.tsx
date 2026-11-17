import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, ListRow, ListRowBody, ListRowGroup, ListRowIcon, ListRowMeta, ListRowSubtitle, ListRowTitle } from "@botiverse/raft-ui";
import type { SkillsHubItemView } from "@botiverse/raft-shared";
import { EllipsisVertical, Pencil, Puzzle, Sparkles, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useIntl } from "react-intl";

function KindIcon({ kind }: { kind: SkillsHubItemView["kind"] }) {
  return kind === "skill"
    ? <Sparkles size={14} className="shrink-0 text-foreground-hint" />
    : <Puzzle size={14} className="shrink-0 text-foreground-hint" />;
}

function SkillRowMenu({ item, label, onEdit, onRemove }: {
  item: SkillsHubItemView;
  label: string;
  onEdit: (item: SkillsHubItemView) => void;
  onRemove: (item: SkillsHubItemView) => void;
}) {
  const { formatMessage } = useIntl();
  const handleEdit = useCallback(() => onEdit(item), [item, onEdit]);
  const handleRemove = useCallback(() => onRemove(item), [item, onRemove]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" size="icon-md" variant="ghost" aria-label={label} />}>
        <EllipsisVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label={label}>
        <DropdownMenuItem onClick={handleEdit}><Pencil />{formatMessage({ id: "skillsHub.action.edit" })}</DropdownMenuItem>
        <DropdownMenuItem onClick={handleRemove} className="text-danger-strong"><Trash2 />{formatMessage({ id: "skillsHub.action.delete" })}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Apps page's Skills and plugins (task #18, Figmama C3): one row per item, its source and how many Agents have it. */
export function SkillsHubTable({ items, counts, total, canManage, onEdit, onRemove }: {
  items: SkillsHubItemView[];
  counts: Record<string, number>;
  total: number;
  canManage: boolean;
  onEdit: (item: SkillsHubItemView) => void;
  onRemove: (item: SkillsHubItemView) => void;
}) {
  const { formatMessage } = useIntl();
  const heading = "text-footnote font-bold text-foreground-hint";
  const colSource = "hidden w-[280px] shrink-0 @[760px]/skills:flex";
  const colAgents = "flex w-[88px] shrink-0 @[480px]/skills:w-[120px]";
  const colAction = "flex w-[48px] shrink-0 justify-end";
  const sourceOf = (item: SkillsHubItemView) => {
    if (item.source) return formatMessage({ id: "skillsHub.item.githubSource" }, { repo: item.source.repo, ref: item.source.ref, files: item.fileCount });
    if (item.marketplaceSource) return item.marketplaceSource.source === "github" ? item.marketplaceSource.repo : item.marketplaceSource.url;
    return formatMessage({ id: "skillsHub.item.manual" });
  };
  const agentsOf = (item: SkillsHubItemView) => {
    const count = counts[item.id] ?? 0;
    if (count === 0) return formatMessage({ id: "apps.cap.agents.off" });
    if (total > 1 && count === total) return formatMessage({ id: "apps.cap.agents.all" }, { count });
    return formatMessage({ id: "apps.cap.agents.count" }, { count });
  };
  return (
    <div className="@container/skills flex min-w-0 flex-col" data-testid="skills-hub-table">
      <div className="flex min-w-0 items-baseline gap-3 border-x border-transparent pr-4 pl-3">
        <span className={`min-w-0 flex-1 ${heading}`}>{formatMessage({ id: "apps.cap.column.name" })}</span>
        <span className={`${colSource} ${heading}`}>{formatMessage({ id: "apps.cap.column.source" })}</span>
        <span className={`${colAgents} ${heading}`}>{formatMessage({ id: "apps.cap.column.agents" })}</span>
        <span className={colAction} />
      </div>
      <ListRowGroup className="mt-2">
        {items.map((item) => {
          const source = sourceOf(item);
          const menuLabel = formatMessage({ id: "apps.cap.action.more" }, { name: item.name });
          return (
            <ListRow key={item.id} interactive={false} render={<div />} className="min-h-14" data-testid={`skills-hub-row-${item.id}`}>
              <ListRowIcon><KindIcon kind={item.kind} /></ListRowIcon>
              <ListRowBody>
                <span className="flex min-w-0 items-center gap-2">
                  <ListRowTitle className="min-w-[3ch]" title={item.name}>{item.name}</ListRowTitle>
                  <Badge appearance="outline" variant="muted" className="hidden shrink-0 @[480px]/skills:inline-flex">
                    {formatMessage({ id: item.kind === "skill" ? "skillsHub.kind.skill" : "skillsHub.kind.plugin" })}
                  </Badge>
                </span>
                {item.description ? <ListRowSubtitle title={item.description}>{item.description}</ListRowSubtitle> : null}
                <ListRowMeta className="@[760px]/skills:hidden">{source}</ListRowMeta>
              </ListRowBody>
              <span className={`${colSource} items-center`}><ListRowMeta title={source}>{source}</ListRowMeta></span>
              <span className={`${colAgents} items-center text-caption text-foreground`} data-testid={`skills-hub-row-agents-${item.id}`}>{agentsOf(item)}</span>
              <span className={`${colAction} items-center`}>
                {canManage ? <SkillRowMenu item={item} label={menuLabel} onEdit={onEdit} onRemove={onRemove} /> : null}
              </span>
            </ListRow>
          );
        })}
      </ListRowGroup>
    </div>
  );
}
