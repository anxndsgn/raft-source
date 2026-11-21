import type { ReactNode } from "react";
import { useMediaQuery } from "../../hooks/effectPrimitives";

/**
 * Layout changes C (Figmama 11/21, work/redesign/layout-spec-1121.md): a full page (Team, Apps, Inbox, the Tasks
 * list, the Artifacts list, Settings, a full-page profile) with a mouse on a desktop keeps its head, its toolbar and
 * its content in one centered reading column: 880 for lists and tables, 720 for forms and long text (`form`). Below
 * that width plus its 20px sides it is the full width with 20px sides, as before. On a phone nothing changes.
 *
 * `PAGE_COLUMN_CLASS` goes on each band of the page (head, toolbar, body), which keeps its own 20px edge inside
 * (`px-5`, `--column-margin`); the page's root takes `PAGE_ROOT_CLASS`, the container the head's top air reads.
 */
export const PAGE_COLUMN_CLASS = "page-column";
export const PAGE_COLUMN_FORM_CLASS = "page-column page-column-form";
/** A band drawing a line under it (a toolbar): the column's width exactly, so the line is only as wide as the column. */
export const PAGE_COLUMN_INSET_CLASS = "page-column-inset";
export const PAGE_ROOT_CLASS = "@container/page";

/** With a mouse on a desktop: where the page head and reading column apply (the same query as `md:pointer-fine:`). */
export const DESKTOP_MOUSE_QUERY = "(width >= 48rem) and (pointer: fine)";

export function useDesktopMouse(): boolean {
  return useMediaQuery(DESKTOP_MOUSE_QUERY, true);
}

/**
 * The head of a full page in its reading column: the title (Semi Bold 24) and under it a subtitle line (13, muted,
 * 4 below); the page's primary action at the column's right edge, centered on the title block; the tabs 16 below the
 * title, their hairline only as wide as the column. 40 above it on a page at least 1024 wide, 20 otherwise.
 */
export function PageHead({
  title,
  subtitle,
  action,
  tabs,
  form = false,
  testId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  tabs?: ReactNode;
  form?: boolean;
  testId?: string;
}) {
  return (
    <div className={`${form ? PAGE_COLUMN_FORM_CLASS : PAGE_COLUMN_CLASS} shrink-0 px-(--column-margin) pt-5 @min-[1024px]/page:pt-10`} data-full-page-head="" data-page-head="" data-testid={testId}>
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-sans text-[24px] leading-8 font-semibold text-foreground" data-slot="page-head-title">{title}</h2>
          {subtitle ? (
            <p className="mt-1 truncate font-sans text-[13px] leading-[18px] font-normal text-foreground-muted" data-slot="page-head-subtitle">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2" data-slot="page-head-action">{action}</div> : null}
      </div>
      {tabs ? <div className="mt-4 border-b border-line-seam" data-slot="page-head-tabs">{tabs}</div> : null}
    </div>
  );
}
