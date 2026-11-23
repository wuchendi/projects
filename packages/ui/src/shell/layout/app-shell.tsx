"use client";

import { Menu } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import { Button } from "@cdlab/ui/components/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@cdlab/ui/components/resizable";
import { ScrollArea } from "@cdlab/ui/components/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@cdlab/ui/components/sheet";
import { isBareKeyBlocked } from "@cdlab/ui/shell/core/is-typing";
import type { ShellLabels } from "@cdlab/ui/shell/core/labels";
import { shellLabelsEn } from "@cdlab/ui/shell/core/labels";
import { ShellLabelsContext } from "@cdlab/ui/shell/core/labels-context";
import { ShellPanelContext } from "@cdlab/ui/shell/core/panel-state";
import type { ShellPrefs } from "@cdlab/ui/shell/core/prefs";
import { readShellPrefs, shellPrefsCookie } from "@cdlab/ui/shell/core/prefs";
import type { ShellSpace } from "@cdlab/ui/shell/core/spaces";
import { spaceFor } from "@cdlab/ui/shell/core/spaces";
import { useIsMobile } from "@cdlab/ui/shell/core/use-is-mobile";
import { NavigationProgress } from "@cdlab/ui/shell/layout/navigation-progress";
import { PAGE_GUTTER, PAGE_TOP, ShellPageContext } from "@cdlab/ui/shell/layout/page-context";
import type { ShellNewAction } from "@cdlab/ui/shell/layout/rail";
import { Rail } from "@cdlab/ui/shell/layout/rail";
import { useShellPathname } from "@cdlab/ui/shell/router";

// A page holding `<PageBody fill>` becomes a full-height column (as does the page root around
// it), so the body gets a definite height. Pure CSS: nothing remounts when a page opts in.
const FILL_PAGE = [
  "[&:has([data-shell-fill])]:flex",
  "[&:has([data-shell-fill])]:h-full",
  "[&:has([data-shell-fill])]:flex-col",
  "[&:has([data-shell-fill])]:pb-0",
  "[&>:has([data-shell-fill])]:flex",
  "[&>:has([data-shell-fill])]:min-h-0",
  "[&>:has([data-shell-fill])]:flex-1",
  "[&>:has([data-shell-fill])]:flex-col",
].join(" ");

/** The saved width of the open panel, else its default. */
function panelWidth(prefs: ShellPrefs): string {
  return prefs.panelSize ? `${prefs.panelSize}%` : "240px";
}

export interface AppShellProps {
  /** Rail entries, in order; `footer` ones sit above the account control. */
  spaces: ShellSpace[];
  /** The panel shown beside each space's pages, by space key. A space without one has no panel. */
  panels?: Partial<Record<string, ComponentType>>;
  homeHref: string;
  logo: ReactNode;
  /** Accessible name of the logo link (the app name). */
  logoLabel: string;
  /** The control at the rail's foot, e.g. an account menu. */
  account?: ReactNode;
  /** Rail "new" button; the bare `C` key runs it too. */
  newAction?: ShellNewAction | undefined;
  /** Rail search button; Cmd/Ctrl+K runs it too. The host renders the dialog it opens. */
  onSearch?: (() => void) | undefined;
  /** Above the page inside the content card, e.g. a notice. */
  banner?: ReactNode;
  labels?: ShellLabels;
  /**
   * The prefs cookie as the server read it (`readShellPrefs`), so a server render matches the
   * client. Without it the shell reads `document.cookie`.
   */
  prefs?: ShellPrefs | undefined;
  children: ReactNode;
}

/**
 * From `md` up: the rail on the canvas and one rounded content card beside it, holding the
 * space's resizable panel (while open) and the page. Below `md` the card is the whole window;
 * the rail and the panel move into a sheet behind a top bar.
 */
export function AppShell({
  spaces,
  panels = {},
  homeHref,
  logo,
  logoLabel,
  account,
  newAction,
  onSearch,
  banner,
  labels = shellLabelsEn,
  prefs,
  children,
}: AppShellProps) {
  const pathname = useShellPathname();
  const [initialPrefs] = useState(
    () =>
      prefs ??
      (typeof document === "undefined" ? { panelOpen: true } : readShellPrefs(document.cookie)),
  );
  const prefsRef = useRef(initialPrefs);
  const savePrefs = useCallback((next: Partial<ShellPrefs>) => {
    prefsRef.current = { ...prefsRef.current, ...next };
    // biome-ignore lint/suspicious/noDocumentCookie: a synchronous write the server reads back
    document.cookie = shellPrefsCookie(prefsRef.current);
  }, []);
  const [panelOpen, setOpen] = useState(initialPrefs.panelOpen);
  const panelState = useMemo(
    () => ({ open: panelOpen, toggle: () => setOpen(o => !o), setOpen }),
    [panelOpen],
  );
  const togglePanel = panelState.toggle;
  const [navOpen, setNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const pressAtRef = useRef<number | null>(null);
  const panelRef = usePanelRef();
  const [animating, setAnimating] = useState(false);
  const openRef = useRef(panelOpen);

  const space = spaceFor(spaces, pathname);
  const Panel = space ? panels[space.key] : undefined;
  // The panel stays mounted while folded (collapsed to 0) so folding can animate.
  const showPanel = !!Panel && !isMobile;

  // Close the mobile sheet once something in it has navigated.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a navigation is the trigger
  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => savePrefs({ panelOpen }), [panelOpen, savePrefs]);

  // Animate a toggle of the stored open state. A panel that mounts later lines itself up
  // in `onResize` instead: its group does not know it before that first call.
  useEffect(() => {
    if (openRef.current === panelOpen) return;
    openRef.current = panelOpen;
    const panel = panelRef.current;
    if (!panel) return;
    setAnimating(true);
    if (panelOpen) panel.resize(panelWidth(prefsRef.current));
    else panel.collapse();
  }, [panelOpen, panelRef]);

  useEffect(() => {
    if (!animating) return;
    const timer = setTimeout(setAnimating, 200, false);
    return () => clearTimeout(timer);
  }, [animating]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey || e.altKey || e.defaultPrevented) return;
      const key = e.key.toLowerCase();
      if (e.metaKey || e.ctrlKey) {
        if (key === "b") {
          e.preventDefault();
          togglePanel();
        } else if (key === "k" && onSearch) {
          e.preventDefault();
          onSearch();
        }
        return;
      }
      if (key === "c" && newAction && !isBareKeyBlocked(e)) {
        e.preventDefault();
        newAction.onSelect();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePanel, onSearch, newAction]);

  const railProps = {
    spaces,
    homeHref,
    logo,
    logoLabel,
    account,
    newAction,
    onSearch,
    hasPanel: (key: string) => !!panels[key],
  };

  return (
    <ShellLabelsContext value={labels}>
      <ShellPanelContext value={panelState}>
        <div className="flex h-dvh w-full overflow-hidden bg-[var(--shell-canvas,var(--color-muted))] text-foreground">
          <Rail className="hidden md:flex" {...railProps} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:py-2 md:pr-2">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3 md:hidden">
              <Sheet open={navOpen} onOpenChange={setNavOpen}>
                <SheetTrigger
                  render={<Button variant="ghost" size="icon-sm" aria-label={labels.openMenu} />}
                >
                  <Menu />
                </SheetTrigger>
                <SheetContent
                  side="left"
                  showCloseButton={false}
                  className="flex-row gap-0 bg-[var(--shell-canvas,var(--color-muted))] data-[side=left]:w-auto"
                >
                  <SheetTitle className="sr-only">{labels.openMenu}</SheetTitle>
                  <Rail {...railProps} onNavigate={() => setNavOpen(false)} />
                  {Panel && (
                    <div className="flex w-60 bg-background">
                      <Panel />
                    </div>
                  )}
                </SheetContent>
              </Sheet>
              {space && <span className="truncate text-sm font-medium">{space.label}</span>}
            </header>
            <div
              data-slot="content-card"
              className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background md:rounded-[8px] md:shadow-sm md:ring-1 md:ring-border/70"
            >
              <NavigationProgress />
              {/* Hiding the panel below `md` covers a server render on a phone, before `useIsMobile` knows. */}
              <ResizablePanelGroup
                orientation="horizontal"
                onLayoutChanged={layout => {
                  const size = layout.panel;
                  if (size) savePrefs({ panelSize: Math.round(size * 100) / 100 });
                }}
                className={`min-h-0 min-w-0 flex-1 max-md:[&>#panel]:hidden! ${animating ? "[&>[data-panel]]:transition-[flex-grow] [&>[data-panel]]:duration-200 [&>[data-panel]]:ease-out" : ""}`}
              >
                {/* Panel and handle come and go in front of the page, which keeps its position so folding never remounts it. */}
                {showPanel && (
                  <ResizablePanel
                    id="panel"
                    panelRef={panelRef}
                    defaultSize={panelOpen ? panelWidth(prefsRef.current) : 0}
                    minSize="200px"
                    maxSize="400px"
                    collapsible
                    collapsedSize={0}
                    onResize={(size, _id, prev) => {
                      const open = openRef.current;
                      const folded = size.inPixels === 0;
                      if (prev === undefined) {
                        // Just mounted: follow the stored state over the saved layout.
                        if (open && folded) panelRef.current?.resize(panelWidth(prefsRef.current));
                        else if (!open && !folded) panelRef.current?.collapse();
                      } else if (open && folded) {
                        // Dragging past the minimum folds the panel too.
                        openRef.current = false;
                        setOpen(false);
                      }
                    }}
                    className="min-w-0 overflow-hidden!"
                  >
                    {/* Keeps its width while the panel slides, so nothing reflows. */}
                    <div className="h-full w-full min-w-[200px]">
                      <Panel />
                    </div>
                  </ResizablePanel>
                )}
                {showPanel && (
                  <ResizableHandle
                    withHandle={panelOpen}
                    className={
                      panelOpen ? "max-md:hidden" : "pointer-events-none opacity-0 max-md:hidden"
                    }
                    title={labels.toggleSidebar}
                    onPointerDown={e => {
                      pressAtRef.current = e.clientX;
                    }}
                    onClick={e => {
                      // A click folds the panel; a drag only resizes it.
                      if (
                        pressAtRef.current !== null &&
                        Math.abs(e.clientX - pressAtRef.current) < 3
                      )
                        togglePanel();
                      pressAtRef.current = null;
                    }}
                  />
                )}
                <ResizablePanel id="page" minSize="40%" className="min-w-0">
                  <main className="flex h-full min-h-0 min-w-0 flex-col">
                    {banner}
                    <ScrollArea className="min-h-0 flex-1">
                      <div className={`${PAGE_GUTTER} ${PAGE_TOP} ${FILL_PAGE} pb-6`}>
                        <ShellPageContext
                          value={{
                            ...(space?.icon ? { icon: space.icon } : {}),
                            hasPanel: !!Panel,
                          }}
                        >
                          {children}
                        </ShellPageContext>
                      </div>
                    </ScrollArea>
                  </main>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </div>
        </div>
      </ShellPanelContext>
    </ShellLabelsContext>
  );
}
