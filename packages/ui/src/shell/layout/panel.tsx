"use client";

import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@cdlab/ui/components/context-menu";
import { ScrollArea } from "@cdlab/ui/components/scroll-area";
import { ShellLink, useShellNavigate } from "@cdlab/ui/shell/router";

const ROW_CLASS =
  "flex min-h-8 w-full items-center gap-2.5 rounded-[6px] px-3 py-1.5 text-left text-[13px] text-foreground/80 transition-colors outline-none hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-foreground/[0.06] aria-[current=page]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0";

export type ShellDotTone = "success" | "warning" | "danger" | "info" | "progress" | "muted";

const DOT_CLASS: Record<ShellDotTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-destructive",
  info: "bg-sky-500",
  progress: "animate-pulse bg-primary",
  muted: "bg-muted-foreground/40",
};

/** A space's panel: a 48px title row (with optional icon `actions`) over scrolling sections. */
export function PanelFrame({
  title,
  actions,
  className,
  children,
}: {
  title: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <aside
      data-slot="space-panel"
      aria-label={title}
      className={cn("flex h-full w-full min-w-0 flex-col", className)}
    >
      <div className="flex h-12 shrink-0 items-center gap-1 pr-2.5 pl-5">
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</h2>
        {actions}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col px-2 pb-3">{children}</div>
      </ScrollArea>
    </aside>
  );
}

/** A labelled group of rows; the label folds it. */
export function PanelSection({ label, children }: { label?: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section className="mt-5 first:mt-1">
      {label && (
        <h3 className="group/section flex h-7 items-center px-3 text-[12px] font-medium text-muted-foreground">
          <button
            type="button"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
            className="-mx-1 flex max-w-full items-center gap-0.5 rounded-md px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate">{label}</span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0 transition-[transform,opacity] duration-150",
                collapsed
                  ? "-rotate-90"
                  : "opacity-0 group-hover/section:opacity-100 group-focus-within/section:opacity-100",
              )}
            />
          </button>
        </h3>
      )}
      {!collapsed && <ul className="space-y-px">{children}</ul>}
    </section>
  );
}

function withMenu(row: ReactElement, menu: ReactNode) {
  if (!menu) return row;
  return (
    <ContextMenu>
      <ContextMenuTrigger render={row} />
      <ContextMenuContent className="w-auto min-w-40">{menu}</ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * One row: a link (`href`), an action (`onClick`, then opens `href` if given), or plain text.
 * Action rows are buttons because they share one path, and the router would mark every link to
 * the current path active.
 */
export function PanelRow({
  href,
  onClick,
  menu,
  active = false,
  icon: Icon,
  dot,
  inset = false,
  count,
  title,
  children,
}: {
  href?: string;
  onClick?: () => void;
  active?: boolean;
  icon?: LucideIcon;
  dot?: ShellDotTone;
  /** Reserve the marker slot when there is no `icon` or `dot`, so text lines up with rows that have one. */
  inset?: boolean;
  count?: number;
  title?: string;
  /** Right-click menu entries for the row. */
  menu?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useShellNavigate();
  const body = (
    <>
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("mx-[5px] size-1.5 shrink-0 rounded-full", DOT_CLASS[dot])}
        />
      ) : Icon ? (
        <Icon aria-hidden="true" />
      ) : (
        inset && <span aria-hidden="true" className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-auto shrink-0 text-[12px] text-muted-foreground/70 tabular-nums">
          {count}
        </span>
      )}
    </>
  );
  const current = active ? "page" : undefined;
  return (
    <li>
      {onClick ? (
        <button
          type="button"
          aria-current={current}
          title={title}
          onClick={() => {
            onClick();
            if (href) navigate(href);
          }}
          className={ROW_CLASS}
        >
          {body}
        </button>
      ) : href ? (
        withMenu(
          <ShellLink href={href} aria-current={current} title={title} className={ROW_CLASS}>
            {body}
          </ShellLink>,
          menu,
        )
      ) : (
        <div title={title} className={cn(ROW_CLASS, "hover:bg-transparent")}>
          {body}
        </div>
      )}
    </li>
  );
}

/** Muted closing row that opens the full list. */
export function PanelAllRow({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <ul className="mt-3">
      <li>
        <ShellLink
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(ROW_CLASS, "pl-[2.375rem] text-[12px] text-muted-foreground")}
        >
          {label}
        </ShellLink>
      </li>
    </ul>
  );
}
