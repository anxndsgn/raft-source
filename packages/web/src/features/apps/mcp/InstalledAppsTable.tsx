import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, ListRow, ListRowBody, ListRowGroup, ListRowIcon, ListRowMeta, ListRowSubtitle, ListRowTitle, Status } from "@botiverse/raft-ui";
import type { McpAppListItem } from "@botiverse/raft-shared";
import { EllipsisVertical, PanelRight, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useIntl } from "react-intl";
import { McpTag } from "../../../components/apps/AppsListParts";
import { ConnectedAppLogo } from "../../../components/settings/ConnectedAppLogo";
import { CONNECTED_APP_CATEGORY_LABEL_ID } from "../connected-apps/connectedAppCatalog";
import type { InstalledConnectedApp } from "../connected-apps/connectedAppTypes";

// The Installed tab as one table (task #18, Figmama C1): a row per App, the
// ones that need a person first. The columns' tracks are shared by the heading
// line and every row so they line up; below 760px of list the agent and tool
// columns fold into the row's meta line.
const CELL = "min-w-0 items-center gap-2 whitespace-nowrap";
const HEADING_LABEL = "text-footnote font-bold text-foreground-hint";
const COL_STATE = "hidden w-[132px] shrink-0 @[560px]/apps-list:flex";
const COL_AGENTS = "hidden w-[120px] shrink-0 @[760px]/apps-list:flex";
const COL_TOOLS = "hidden w-[96px] shrink-0 @[760px]/apps-list:flex";
const COL_ACTION = "flex shrink-0 justify-end @[560px]/apps-list:w-[104px]";
const ROW_MIN_H = "min-h-14";
// Between the folded agent and tool cells on a narrow list: punctuation, not copy.
const META_GLUE = " · ";

export type InstalledRow =
  | { kind: "mcp"; app: McpAppListItem; developer: string }
  | { kind: "oauth"; app: InstalledConnectedApp; agentCount: number };

/** Whether a row belongs in "Needs you" (task #18): an MCP App's sign-in or reach, an App's pending review. */
function installedRowNeedsYou(row: InstalledRow): boolean {
  if (row.kind === "mcp") return row.app.state !== "ok";
  return Boolean(row.app.permissionApprovalRequired || row.app.promptTextConfirmationRequired || row.app.needsAdminReview);
}

function rowKey(row: InstalledRow) {
  return `${row.kind}:${row.app.id}`;
}

/** Raft redesign (Figmama 11/21): a state is its 8px status square and its words, 6px apart, regular 12 in the ink; no tinted chip. */
function StateLabel({ tone, children }: { tone: "error" | "stuck" | "idle"; children: ReactNode }) {
  const square = tone === "error" ? "bg-danger" : tone === "stuck" ? "bg-presence-error" : "bg-presence-online";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] leading-4 text-foreground" data-testid="apps-row-state" data-tone={tone}>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-sticker ${square}`} />
      {children}
    </span>
  );
}

function StateCell({ row }: { row: InstalledRow }) {
  const { formatMessage } = useIntl();
  if (row.kind === "mcp" && row.app.state !== "ok") {
    const id = row.app.state === "unreachable"
      ? "apps.cap.state.unreachable"
      : row.app.authKind === "headers" ? "apps.cap.state.needsKey" : "apps.cap.state.needsSignIn";
    return <StateLabel tone="error">{formatMessage({ id })}</StateLabel>;
  }
  if (row.kind === "oauth" && installedRowNeedsYou(row)) {
    return <StateLabel tone="stuck">{formatMessage({ id: "apps.cap.state.needsReview" })}</StateLabel>;
  }
  return <StateLabel tone="idle">{formatMessage({ id: "apps.cap.state.ok" })}</StateLabel>;
}

function agentsText(formatMessage: ReturnType<typeof useIntl>["formatMessage"], count: number, total: number | null) {
  if (count === 0) return formatMessage({ id: "apps.cap.agents.off" });
  if (total !== null && total > 1 && count === total) return formatMessage({ id: "apps.cap.agents.all" }, { count });
  return formatMessage({ id: "apps.cap.agents.count" }, { count });
}

const InstalledAppRow = memo(function InstalledAppRow({ row, selected, canManage, onOpen, onAction, onRemove }: {
  row: InstalledRow;
  selected: boolean;
  canManage: boolean;
  onOpen: (row: InstalledRow) => void;
  /** The row's one button in Needs you: sign in, add the key, or look. */
  onAction: (row: InstalledRow) => void;
  onRemove: (row: InstalledRow) => void;
}) {
  const { formatMessage } = useIntl();
  const app = row.app;
  const category = formatMessage({ id: CONNECTED_APP_CATEGORY_LABEL_ID[app.category ?? "Other"] ?? "settings.connectedApps.categoryOther" });
  const source = row.kind === "mcp" ? row.developer : row.app.developer;
  const subtitle = [category, source].filter(Boolean).join(" · ");
  const agents = row.kind === "mcp"
    ? agentsText(formatMessage, row.app.enabledAgentCount, row.app.agentTotal)
    : agentsText(formatMessage, row.agentCount, null);
  const tools = row.kind === "mcp" && row.app.status.toolCount > 0
    ? formatMessage({ id: "apps.cap.tools.count" }, { count: row.app.status.toolCount })
    : "–";
  const needsYou = installedRowNeedsYou(row);
  const handleOpen = useCallback(() => onOpen(row), [onOpen, row]);
  const stop = useCallback((event: MouseEvent) => event.stopPropagation(), []);
  const handleAction = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    onAction(row);
  }, [onAction, row]);
  const handleRemove = useCallback(() => onRemove(row), [onRemove, row]);
  const actionLabel = row.kind === "mcp" && row.app.state === "needs_auth"
    ? formatMessage({ id: row.app.authKind === "headers" ? "apps.cap.action.addKey" : "apps.cap.action.signIn" })
    : formatMessage({ id: "apps.cap.action.view" });
  const menuLabel = formatMessage({ id: "apps.cap.action.more" }, { name: app.name });
  let action: ReactNode = null;
  if (canManage && needsYou) {
    action = (
      <Button type="button" size="md" variant="outline" onClick={handleAction} data-testid={`apps-row-action-${app.id}`}>
        {actionLabel}
      </Button>
    );
  } else if (canManage) {
    action = (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" size="icon-md" variant="ghost" aria-label={menuLabel} onClick={stop} data-testid={`apps-row-menu-${app.id}`} />}
        >
          <EllipsisVertical aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" aria-label={menuLabel}>
          <DropdownMenuItem onClick={handleOpen}>
            <PanelRight />{formatMessage({ id: "apps.cap.action.details" })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleRemove} className="text-danger-strong" data-testid={`apps-row-remove-${app.id}`}>
            <Trash2 />{formatMessage({ id: "apps.cap.action.remove" })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <ListRow
      selected={selected}
      onClick={handleOpen}
      aria-current={selected ? "true" : undefined}
      aria-label={formatMessage({ id: "apps.cap.openApp" }, { name: app.name })}
      className={ROW_MIN_H}
      data-testid={`apps-row-${app.id}`}
      data-kind={row.kind}
      render={<div role="button" tabIndex={0} />}
    >
      <ListRowIcon className="relative">
        <ConnectedAppLogo name={app.name} logoUrl={app.logoUrl} seed={row.kind === "mcp" ? app.id : row.app.defaultLogoSeed} size="sm" />
        {/* Raft redesign (Figmama 11/21): the rail's red dot, its 1px ring the canvas (it sits in the island). */}
        {needsYou ? <Status variant="danger" size="sm" className="absolute -top-0.5 -right-0.5 md:pointer-fine:ring-1 md:pointer-fine:ring-layer-canvas" aria-hidden /> : null}
      </ListRowIcon>
      <ListRowBody>
        <span className="flex min-w-0 items-baseline gap-2">
          <ListRowTitle className="min-w-[3ch] flex-none">{app.name}</ListRowTitle>
          {row.kind === "mcp" ? <span className="self-center"><McpTag /></span> : (
            <Badge appearance="outline" variant="muted" className="shrink-0 self-center">{formatMessage({ id: "apps.cap.tag.raftApp" })}</Badge>
          )}
        </span>
        <ListRowSubtitle title={subtitle}>{subtitle}</ListRowSubtitle>
        {/* A phone-wide list has no State column: the state sits under the name. */}
        <span className="flex @[560px]/apps-list:hidden">{needsYou ? <StateCell row={row} /> : null}</span>
        <ListRowMeta className="@[760px]/apps-list:hidden" aria-hidden>{[agents, tools].join(META_GLUE)}</ListRowMeta>
      </ListRowBody>
      <span className={`${COL_STATE} ${CELL}`}><StateCell row={row} /></span>
      <span className={`${COL_AGENTS} ${CELL} text-caption text-foreground`} data-testid={`apps-row-agents-${app.id}`}>{agents}</span>
      <span className={`${COL_TOOLS} ${CELL}`}><ListRowMeta>{tools}</ListRowMeta></span>
      <span className={`${COL_ACTION} ${CELL}`}>{action}</span>
    </ListRow>
  );
});

function Group({ heading, rows, showColumns, ...rowProps }: {
  heading: string;
  rows: InstalledRow[];
  showColumns: boolean;
  selectedKey: string | null;
  canManage: boolean;
  onOpen: (row: InstalledRow) => void;
  onAction: (row: InstalledRow) => void;
  onRemove: (row: InstalledRow) => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <section className="flex min-w-0 flex-col" data-testid="apps-installed-group">
      <div className="flex min-w-0 items-baseline gap-3 border-x border-transparent pt-4 pr-4 pl-3">
        <h3 className="min-w-0 flex-1 text-footnote font-bold text-foreground">{heading}</h3>
        {showColumns ? (
          <>
            <span className={`${COL_STATE} ${HEADING_LABEL}`}>{formatMessage({ id: "apps.cap.column.state" })}</span>
            <span className={`${COL_AGENTS} ${HEADING_LABEL}`}>{formatMessage({ id: "apps.cap.column.agents" })}</span>
            <span className={`${COL_TOOLS} ${HEADING_LABEL}`}>{formatMessage({ id: "apps.cap.column.tools" })}</span>
            <span className={COL_ACTION} />
          </>
        ) : null}
      </div>
      <ListRowGroup className="mt-2">
        {rows.map((row) => (
          <InstalledAppRow
            key={rowKey(row)}
            row={row}
            selected={rowProps.selectedKey === rowKey(row)}
            canManage={rowProps.canManage}
            onOpen={rowProps.onOpen}
            onAction={rowProps.onAction}
            onRemove={rowProps.onRemove}
          />
        ))}
      </ListRowGroup>
    </section>
  );
}

export function InstalledAppsTable({ rows, selected, canManage, onOpen, onAction, onRemove }: {
  rows: InstalledRow[];
  /** The App open in the detail column. */
  selected: { kind: InstalledRow["kind"]; id: string } | null;
  canManage: boolean;
  onOpen: (row: InstalledRow) => void;
  onAction: (row: InstalledRow) => void;
  onRemove: (row: InstalledRow) => void;
}) {
  const { formatMessage } = useIntl();
  const needsYou = useMemo(() => rows.filter(installedRowNeedsYou), [rows]);
  const fine = useMemo(() => rows.filter((row) => !installedRowNeedsYou(row)), [rows]);
  const selectedKey = selected ? `${selected.kind}:${selected.id}` : null;
  const common = { selectedKey, canManage, onOpen, onAction, onRemove };
  return (
    <div className="@container/apps-list flex min-w-0 flex-col" data-testid="apps-installed-table">
      {needsYou.length > 0 ? (
        <Group heading={formatMessage({ id: "apps.cap.group.needsYou" }, { count: needsYou.length })} rows={needsYou} showColumns {...common} />
      ) : null}
      {fine.length > 0 ? (
        <Group heading={formatMessage({ id: "apps.cap.group.fine" }, { count: fine.length })} rows={fine} showColumns={needsYou.length === 0} {...common} />
      ) : null}
    </div>
  );
}
