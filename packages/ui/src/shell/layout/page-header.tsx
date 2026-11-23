"use client";

import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, PanelLeft } from "lucide-react";
import type { ReactNode } from "react";
import { use } from "react";
import { Button } from "@cdlab/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@cdlab/ui/components/dropdown-menu";
import { MOD_KEY } from "@cdlab/ui/shell/core/keys";
import { useShellLabels } from "@cdlab/ui/shell/core/labels-context";
import { useShellPanel } from "@cdlab/ui/shell/core/panel-state";
import { IconButton } from "@cdlab/ui/shell/layout/icon-button";
import {
  PAGE_GUTTER,
  PAGE_GUTTER_BLEED,
  PAGE_TOP_BLEED,
  ShellPageContext,
} from "@cdlab/ui/shell/layout/page-context";

function SpaceIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
}

/** Brings a folded space panel back; shown only while it is folded. */
function PanelToggle() {
  const labels = useShellLabels();
  const { hasPanel } = use(ShellPageContext);
  const { open, toggle } = useShellPanel();
  if (!hasPanel || open) return null;
  return (
    <IconButton
      label={labels.toggleSidebar}
      icon={PanelLeft}
      keys={[MOD_KEY, "B"]}
      onClick={toggle}
      className="-ml-1.5 hidden md:inline-flex"
    />
  );
}

/**
 * The page's one header row, pinned to the top of the shell's scroll area: panel toggle, space
 * icon and title (a menu when `menu` is given), `tools` right after it, `actions` (icon
 * controls) on the right.
 */
export function PageHeader({
  title,
  menu,
  tools,
  actions,
  className,
}: {
  title: ReactNode;
  menu?: ReactNode;
  tools?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const { icon } = use(ShellPageContext);
  const label = (
    <>
      {icon && <SpaceIcon icon={icon} />}
      <span className="min-w-0 truncate">{title}</span>
    </>
  );
  return (
    <header
      data-slot="page-header"
      className={cn(
        "sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background",
        PAGE_GUTTER,
        PAGE_GUTTER_BLEED,
        PAGE_TOP_BLEED,
        className,
      )}
    >
      <PanelToggle />
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {menu ? (
          <DropdownMenu>
            <h1 className="flex min-w-0">
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-7 min-w-0 max-w-72 gap-2 px-2 text-[15px] font-semibold"
                  />
                }
              >
                {label}
                <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
            </h1>
            <DropdownMenuContent align="start" className="w-auto min-w-52">
              {menu}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <h1 className="flex min-w-0 items-center gap-2 pr-1 text-[15px] font-semibold">
            {label}
          </h1>
        )}
        {tools}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}
