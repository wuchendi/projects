"use client";

import { cn } from "cn";
import type { ReactNode } from "react";
import { ShellPageFillContext } from "@cdlab/ui/shell/core/page-fill";

/**
 * The page content below `<PageHeader>`. With `fill`, the page stops scrolling as a whole: the
 * body takes the height left under the header and a child scrolls on its own (a
 * `CollectionTable`, or the page's own `ScrollArea`); anything taller still scrolls with the page.
 * Render it as a direct child of the page's root element.
 */
export function PageBody({
  fill = false,
  className,
  children,
}: {
  fill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!fill) return <div className={className}>{children}</div>;
  return (
    <ShellPageFillContext value>
      <div data-shell-fill="" className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
        {children}
      </div>
    </ShellPageFillContext>
  );
}
