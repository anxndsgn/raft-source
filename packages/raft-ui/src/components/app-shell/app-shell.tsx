import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import { tv } from "../../lib/tv";
import { cn } from "../../lib/cn";
import type { SlotElementProps } from "../../lib/data-attributes";
import { PanelAction } from "../panel/panel-action";

const appShell = tv({
  slots: {
    root: [
      // Clip, not hidden: a hidden box is still a scroll container, and
      // focusing anything that pokes past it would scroll the whole app
      // sideways. A clipped box cannot scroll.
      "flex min-h-0 w-full overflow-visible md:overflow-clip",
      "max-md:flex-col max-md:pt-[env(safe-area-inset-top,0px)]",
      "font-sans",
      "[--shell-header-height:var(--header-height)] [@media(max-height:600px)]:[--shell-header-height:var(--header-height-short)]",
      "bg-layer-canvas text-foreground",
    ],
    railSlot: ["hidden h-full shrink-0 flex-col md:flex"],
    sidebarSlot: ["hidden min-h-0 shrink-0 flex-col md:flex"],
    mainSlot: ["flex min-h-0 min-w-0 flex-1 flex-col"],
    panelSlot: ["hidden min-h-0 min-w-0 flex-col md:flex"],
    overlaySlot: ["absolute inset-0 z-cover flex min-h-0 min-w-0"],
    // From 768px the regions stand on the frame as islands (Raft redesign,
    // Figma 精修 · 组件化): the frame shows island-gap above, below and right
    // of them and between two of them; the rail before the row is its left
    // margin.
    islandRow: [
      "flex min-h-0 min-w-0 flex-1",
      "md:gap-(--island-gap) md:py-(--island-gap) md:pr-(--island-gap)",
    ],
    // An island: canvas, a 1px ring outside its edge (a ring, so it takes no
    // room and the island keeps its width), the island corner. Clipped, so a
    // region inside it never paints over the corner. Below 768px it is just a
    // box: the phone's page fills the screen.
    island: [
      "relative flex min-h-0 min-w-0 flex-1",
      "md:overflow-clip md:rounded-island md:bg-layer-canvas md:ring-1 md:ring-line-subtle",
    ],
  },
  variants: {
    // Islands on the frame from 768px (AppShellIslandRow): the root shows the
    // frame colour around them.
    framed: {
      false: {},
      true: {
        root: "md:bg-layer-frame",
      },
    },
    overlay: {
      false: {},
      true: {
        mainSlot: "relative",
      },
    },
  },
  defaultVariants: {
    framed: false,
    overlay: false,
  },
});

type AppShellSidebarContextValue = {
  collapsible: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  sidebarId: string | undefined;
  setSidebarId: (id: string | undefined) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  toggle: () => void;
};

const AppShellSidebarContext = createContext<AppShellSidebarContextValue | null>(null);

function useOptionalAppShellSidebar() {
  return useContext(AppShellSidebarContext);
}

export type AppShellRootProps = useRender.ComponentProps<"div"> & {
  defaultSidebarOpen?: boolean;
  /** From 768px, show the frame colour around the screen's islands (AppShellIslandRow). */
  framed?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  sidebarCollapsible?: boolean;
  sidebarOpen?: boolean;
};

export function AppShellRoot({
  className,
  defaultSidebarOpen = true,
  framed = false,
  onSidebarOpenChange,
  render,
  sidebarCollapsible = false,
  sidebarOpen: sidebarOpenProp,
  style,
  ...props
}: AppShellRootProps) {
  const { root } = appShell({ framed });
  const [uncontrolledSidebarOpen, setUncontrolledSidebarOpen] = useState(defaultSidebarOpen);
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const [sidebarId, setSidebarId] = useState<string | undefined>(undefined);
  const sidebarOpen = sidebarOpenProp ?? uncontrolledSidebarOpen;

  const setSidebarOpen = useCallback(
    (open: boolean) => {
      if (sidebarOpenProp === undefined) setUncontrolledSidebarOpen(open);
      onSidebarOpenChange?.(open);
    },
    [onSidebarOpenChange, sidebarOpenProp],
  );
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [setSidebarOpen, sidebarOpen]);
  const setMeasuredSidebarWidth = useCallback((width: number) => {
    if (width <= 0) return;
    setSidebarWidth((currentWidth) => (Math.abs(currentWidth - width) < 1 ? currentWidth : width));
  }, []);
  const sidebarContext = useMemo(
    () => ({
      collapsible: sidebarCollapsible,
      open: sidebarOpen,
      setOpen: setSidebarOpen,
      sidebarId,
      setSidebarId,
      sidebarWidth,
      setSidebarWidth: setMeasuredSidebarWidth,
      toggle: toggleSidebar,
    }),
    [
      setMeasuredSidebarWidth,
      setSidebarOpen,
      sidebarCollapsible,
      sidebarId,
      sidebarOpen,
      sidebarWidth,
      toggleSidebar,
    ],
  );
  const rootStyle = sidebarCollapsible
    ? ({ ...style, "--app-shell-sidebar-width": `${sidebarWidth}px` } as CSSProperties)
    : style;

  const defaultProps: SlotElementProps<"div"> = {
    "data-state": sidebarCollapsible ? (sidebarOpen ? "expanded" : "collapsed") : undefined,
    "data-slot": "app-shell-root",
    className: root({ className: cn("group/app-shell", className) }),
    style: rootStyle,
  };

  const rootElement = useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
  });

  return <AppShellSidebarContext value={sidebarContext}>{rootElement}</AppShellSidebarContext>;
}

export type AppShellRailSlotProps = useRender.ComponentProps<"aside">;

export function AppShellRailSlot({ className, render, ...props }: AppShellRailSlotProps) {
  const { railSlot } = appShell();

  const defaultProps: SlotElementProps<"aside"> = {
    "data-slot": "app-shell-rail-slot",
    className: railSlot({ className }),
  };

  return useRender({
    defaultTagName: "aside",
    render,
    props: mergeProps<"aside">(defaultProps, props),
  });
}

export type AppShellSidebarSlotProps = useRender.ComponentProps<"aside">;

export function AppShellSidebarSlot({
  className,
  id: idProp,
  render,
  ...props
}: AppShellSidebarSlotProps) {
  const { sidebarSlot } = appShell();
  const sidebar = useOptionalAppShellSidebar();
  const elementRef = useRef<HTMLElement | null>(null);
  const isCollapsible = sidebar?.collapsible ?? false;
  const collapsed = isCollapsible && !sidebar?.open;
  const setSidebarWidth = sidebar?.setSidebarWidth;
  const setSidebarId = sidebar?.setSidebarId;
  const generatedId = useId();
  const id = idProp ?? (isCollapsible ? generatedId : undefined);
  const setElementRef = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);

  useLayoutEffect(() => {
    if (!isCollapsible || !setSidebarWidth || !elementRef.current) return;

    const sidebarElement = elementRef.current;
    const observe = () => setSidebarWidth(sidebarElement.getBoundingClientRect().width);
    const observer = new ResizeObserver(observe);

    observe();
    observer.observe(sidebarElement);

    return () => observer.disconnect();
  }, [isCollapsible, setSidebarWidth]);

  // The trigger's aria-controls names this element, whichever id it ends up with.
  useLayoutEffect(() => {
    if (!isCollapsible || !setSidebarId) return;
    setSidebarId(id);
    return () => setSidebarId(undefined);
  }, [id, isCollapsible, setSidebarId]);

  const defaultProps: SlotElementProps<"aside"> = {
    "aria-hidden": collapsed ? true : undefined,
    "data-slot": "app-shell-sidebar-slot",
    id,
    inert: collapsed ? true : undefined,
    className: sidebarSlot({
      className: cn(
        className,
        sidebar?.collapsible && [
          "group-data-[state=expanded]/app-shell:relative group-data-[state=expanded]/app-shell:z-raised",
          "group-data-[state=collapsed]/app-shell:pointer-events-none",
          "group-data-[state=collapsed]/app-shell:opacity-0",
        ],
      ),
    }),
  };

  return useRender({
    defaultTagName: "aside",
    render,
    ref: setElementRef,
    props: mergeProps<"aside">(defaultProps, props),
  });
}

export type AppShellPanelSlotProps = useRender.ComponentProps<"aside">;

export function AppShellPanelSlot({ className, render, ...props }: AppShellPanelSlotProps) {
  const { panelSlot } = appShell();

  const defaultProps: SlotElementProps<"aside"> = {
    "data-slot": "app-shell-panel-slot",
    className: panelSlot({ className }),
  };

  return useRender({
    defaultTagName: "aside",
    render,
    props: mergeProps<"aside">(defaultProps, props),
  });
}

export type AppShellIslandRowProps = useRender.ComponentProps<"div">;

/** The islands of a screen, side by side on the frame (from 768px). */
export function AppShellIslandRow({ className, render, ...props }: AppShellIslandRowProps) {
  const { islandRow } = appShell();

  const defaultProps: SlotElementProps<"div"> = {
    "data-slot": "app-shell-island-row",
    className: islandRow({ className }),
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
  });
}

export type AppShellIslandProps = useRender.ComponentProps<"div">;

/** One island of an AppShellIslandRow: the conversation with its sidebar, or the workspace. */
export function AppShellIsland({ className, ref, render, ...props }: AppShellIslandProps) {
  const { island } = appShell();

  const defaultProps: SlotElementProps<"div"> = {
    "data-slot": "app-shell-island",
    className: island({ className }),
  };

  return useRender({
    defaultTagName: "div",
    ref,
    render,
    props: mergeProps<"div">(defaultProps, props),
  });
}

export type AppShellOverlaySlotProps = useRender.ComponentProps<"div">;

export function AppShellOverlaySlot({ className, render, ...props }: AppShellOverlaySlotProps) {
  const { overlaySlot } = appShell();

  const defaultProps: SlotElementProps<"div"> = {
    "data-slot": "app-shell-overlay-slot",
    className: overlaySlot({ className }),
  };

  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
  });
}

export type AppShellMainSlotProps = useRender.ComponentProps<"main"> & {
  overlay?: boolean;
};

export function AppShellMainSlot({
  className,
  overlay = false,
  render,
  ...props
}: AppShellMainSlotProps) {
  const { mainSlot } = appShell({ overlay });
  const sidebar = useOptionalAppShellSidebar();
  const collapsible = sidebar?.collapsible ?? false;

  const defaultProps: SlotElementProps<"main"> = {
    "data-slot": "app-shell-main-slot",
    className: mainSlot({
      className: cn(
        className,
        collapsible && [
          "absolute inset-y-0 right-0 left-0",
          "group-data-[state=collapsed]/app-shell:-left-(--app-shell-sidebar-width)",
        ],
      ),
    }),
  };

  return useRender({
    defaultTagName: "main",
    render,
    props: mergeProps<"main">(defaultProps, props),
  });
}

export type AppShellSidebarTriggerProps = useRender.ComponentProps<"button"> & {
  children: ReactNode;
};

export function AppShellSidebarTrigger(props: AppShellSidebarTriggerProps) {
  const sidebar = useOptionalAppShellSidebar();
  if (!sidebar?.collapsible) return null;

  return <AppShellSidebarTriggerButton sidebar={sidebar} {...props} />;
}

function AppShellSidebarTriggerButton({
  sidebar,
  className,
  children,
  onClick,
  render,
  ...props
}: AppShellSidebarTriggerProps & { sidebar: AppShellSidebarContextValue }) {
  const label = sidebar.open ? "Collapse sidebar" : "Expand sidebar";

  // Default to PanelAction for in-panel chrome; consumers can pass AppRailItem (or
  // another render) so rail placements keep the flatter item styles.
  const defaultProps: SlotElementProps<"button"> = {
    className: cn("group/app-shell-sidebar-trigger max-md:hidden", className),
    "aria-label": label,
    "aria-controls": sidebar.sidebarId,
    "aria-expanded": sidebar.open,
    "data-state": sidebar.open ? "expanded" : "collapsed",
    title: label,
    children,
    onClick: (event) => {
      onClick?.(event);
      if (!event.defaultPrevented) sidebar.toggle();
    },
  };

  return useRender({
    defaultTagName: "button",
    render: render ?? <PanelAction />,
    props: mergeProps<"button">(defaultProps, props),
  });
}
