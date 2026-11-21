import { useCallback, useLayoutEffect, useState } from "react";
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
/** Content inside a band that keeps its own 20px edges (a padded scroller's content): the column's 880 alone. */
export const PAGE_COLUMN_CONTENT_CLASS = "page-column-content";
/** A band drawing a line under it (a toolbar): the column's width exactly, so the line is only as wide as the column. */
export const PAGE_COLUMN_INSET_CLASS = "page-column-inset";
export const PAGE_ROOT_CLASS = "@container/page";
/** The air above a page head: 40 on a page at least 1024 wide, else 20 (the vertical nav starts under it too). */
const PAGE_TOP_AIR_CLASS = "pt-5 @min-[1024px]/page:pt-10";

/** A toolbar over content on a page with the page head (Figmama 670629d1): no line under it, 16 down to the content. */
export const PAGE_TOOLBAR_PLAIN_CLASS = "md:pointer-fine:*:border-b-0! md:pointer-fine:*:px-0! md:pointer-fine:*:pt-4! md:pointer-fine:*:pb-4!";

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
  withNav = false,
  wide = false,
  testId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  tabs?: ReactNode;
  form?: boolean;
  /** Beside a vertical nav (PageWithNav): the title at the top of the content, a line under it as wide as the content
   *  (owner c4157597). */
  withNav?: boolean;
  /** A page that fills the width (the task board, the Artifacts grid): the head runs with it, 20px in. */
  wide?: boolean;
  testId?: string;
}) {
  return (
    <div className={`${wide || withNav ? "" : form ? PAGE_COLUMN_FORM_CLASS : PAGE_COLUMN_CLASS} shrink-0 px-(--column-margin) ${PAGE_TOP_AIR_CLASS} `} data-full-page-head="" data-page-head="" data-testid={testId}>
      <div className={`flex min-w-0 items-center gap-4 ${tabs ? "" : "border-b border-line-seam pb-4"}`}>
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

/** The page width from which a page with two levels of tabs shows its first level as a vertical nav: the nav sits in
 *  the margin left of the centered 920 column (880 + its 20px edges), so it needs 160 + 40 + a 20 page edge there: 1320 (owner 77d5efa6, Figmama 153b9500). */
export const PAGE_NAV_MIN_WIDTH = 1320;

/**
 * Whether the page whose root is `element` is wide enough for the vertical nav (with a mouse on a desktop, at least
 * PAGE_NAV_MIN_WIDTH): below it the nav is the head's underlined tabs again, as on a phone.
 */
export function usePageNavWide(element: HTMLElement | null): boolean {
  const desktopMouse = useDesktopMouse();
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    if (!element || !desktopMouse) {
      setWide(false);
      return;
    }
    const read = () => setWide(element.getBoundingClientRect().width >= PAGE_NAV_MIN_WIDTH);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, desktopMouse]);
  return wide && desktopMouse;
}

export interface PageNavItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number | null;
  testId?: string;
  countTestId?: string;
}

/**
 * A page's first level of tabs as a vertical nav (Figmama 11/21, pages with two levels: Team, Apps): 160 wide, 32px
 * items, 0 10 inside, regular 14 muted with the count Inter 12 muted at the right; the current one as a sidebar's
 * (5% ink, Semi Bold ink), no underline. It stays at the top while the page scrolls (it is beside the scroller).
 */
export function PageNav<T extends string>({ items, value, onValueChange, label, testId }: {
  items: readonly PageNavItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  testId?: string;
}) {
  return (
    <nav aria-label={label} className="flex w-40 shrink-0 flex-col gap-0.5 pt-4" data-testid={testId} data-slot="page-nav">
      {items.map((item) => {
        const current = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-current={current ? "page" : undefined}
            data-current={current ? "" : undefined}
            onClick={() => onValueChange(item.value)}
            data-testid={item.testId}
            className="flex h-8 min-w-0 items-center gap-2 rounded-control px-2.5 text-left font-sans text-[14px] leading-5 font-normal text-foreground-muted outline-none hover:bg-fill-subtle hover:text-foreground focus-visible:shadow-focus data-current:bg-fill-medium data-current:font-semibold data-current:text-foreground"
          >
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count === null || item.count === undefined ? null : (
              <span className="shrink-0 font-sans text-[12px] font-normal tabular-nums text-foreground-muted" data-testid={item.countTestId}>{item.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * A page with a vertical nav (owner c4157597, 77d5efa6): the content is the centered 880 column, where it is on a page
 * without one, the title at its top with a line under it; the nav in the margin left of it, 40 from the content, under
 * that line, its first item level with the content's first line (its toolbar, the primary action at the toolbar's end).
 */
export function PageWithNav({ nav, head, form = false, children }: { nav: ReactNode; head?: ReactNode; form?: boolean; children: ReactNode }) {
  return (
    <div className={`grid min-h-0 w-full flex-1 grid-rows-[auto_minmax(0,1fr)] ${form ? "grid-cols-[minmax(0,1fr)_minmax(0,760px)_minmax(0,1fr)] [--page-column-width:720px]" : "grid-cols-[minmax(0,1fr)_minmax(0,920px)_minmax(0,1fr)] [--page-column-width:880px]"}`} data-page-nav="">
      <div className="col-start-2 row-start-1 min-w-0">{head}</div>
      <div className="col-start-1 row-start-2 min-h-0 justify-self-end pr-5">{nav}</div>
      <div className="col-start-2 row-start-2 flex min-h-0 min-w-0 flex-col" data-page-nav-content="">
        {children}
      </div>
    </div>
  );
}

/** PageWithNav when there is a nav (`nav` non-null), the head beside it; else the head over the body as before. */
export function PageNavFrame({ nav, head, children }: { nav: ReactNode | null; head?: ReactNode; children: ReactNode }) {
  return nav ? <PageWithNav nav={nav} head={head}>{children}</PageWithNav> : <>{head}{children}</>;
}

/** A page root's element for usePageNavWide, with its ref object kept current too. */
export function usePageElement<T extends HTMLElement>(ref?: { current: T | null }): [T | null, (element: T | null) => void] {
  const [element, setElement] = useState<T | null>(null);
  const set = useCallback((next: T | null) => {
    if (ref) ref.current = next;
    setElement(next);
  }, [ref]);
  return [element, set];
}

/**
 * Settings with its directory in the page (owner, Figmama 4f0745ec): from a window whose page (without the sidebar)
 * is at least 1240 wide, with a mouse: the 200 nav, 40, and the 720 form, centered (1240 = 2 x (200 + 40 + 20) + 720).
 * Narrower, Settings keeps the sidebar.
 */
export const SETTINGS_PAGE_NAV_QUERY = "(width >= 1296px) and (pointer: fine)";

export function useSettingsPageNav(): boolean {
  return useMediaQuery(SETTINGS_PAGE_NAV_QUERY, false);
}
