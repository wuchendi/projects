"use client";

import { cn } from "cn";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@cdlab/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@cdlab/ui/components/dropdown-menu";
import { PAGE_SIZES, pageCount } from "@cdlab/ui/shell/collection/pager";
import type { ShellPagerState } from "@cdlab/ui/shell/collection/use-collection-page";
import { formatLabel } from "@cdlab/ui/shell/core/labels";
import { useShellLabels } from "@cdlab/ui/shell/core/labels-context";

export interface CollectionPagerProps extends ShellPagerState {
  /** Selected rows; the count line reads "selected / total" while it is above 0. */
  selected?: number;
  /** Choices for the page-size menu (shown when `onPageSizeChange` is given). */
  pageSizes?: readonly number[];
  className?: string;
}

/**
 * The bar under a list: the total (or "selected / total"), a page-size menu, "page X of Y" and
 * first / previous / next / last. Client mode takes its props from `useCollectionPage`; server
 * mode passes `page`, `pageSize`, `total` and the change handlers itself.
 */
export function CollectionPager({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  selected = 0,
  pageSizes = PAGE_SIZES,
  className,
}: CollectionPagerProps) {
  const labels = useShellLabels();
  const pages = pageCount(total, pageSize);
  const steps = [
    { label: labels.firstPage, icon: ChevronsLeft, to: 1, disabled: page <= 1 },
    { label: labels.previousPage, icon: ChevronLeft, to: page - 1, disabled: page <= 1 },
    { label: labels.nextPage, icon: ChevronRight, to: page + 1, disabled: page >= pages },
    { label: labels.lastPage, icon: ChevronsRight, to: pages, disabled: page >= pages },
  ];
  return (
    <div
      data-slot="collection-pager"
      className={cn(
        "flex h-11 shrink-0 items-center gap-3 border-t bg-background px-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate tabular-nums">
        {selected > 0
          ? formatLabel(labels.pagerSelected, { count: selected, total })
          : formatLabel(labels.pagerTotal, { total })}
      </span>
      {onPageSizeChange && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="xs" className="gap-1 text-muted-foreground" />}
          >
            {formatLabel(labels.pageSize, { size: pageSize })}
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-28">
            <DropdownMenuRadioGroup
              value={String(pageSize)}
              onValueChange={v => onPageSizeChange(Number(v))}
            >
              {pageSizes.map(size => (
                <DropdownMenuRadioItem key={size} value={String(size)} closeOnClick>
                  {formatLabel(labels.pageSize, { size })}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <span className="shrink-0 tabular-nums">
        {formatLabel(labels.pagerPage, { page, pages })}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        {steps.map(({ label, icon: Icon, to, disabled }) => (
          <Button
            key={label}
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            disabled={disabled}
            onClick={() => onPageChange(to)}
          >
            <Icon />
          </Button>
        ))}
      </div>
    </div>
  );
}
