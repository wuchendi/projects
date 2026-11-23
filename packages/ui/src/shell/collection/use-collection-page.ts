"use client";

import { useState } from "react";
import { clampPage, paginate } from "@cdlab/ui/shell/collection/pager";

/** What `<CollectionPager>` needs; server-mode hosts build it from their own query state. */
export interface ShellPagerState {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: ((pageSize: number) => void) | undefined;
}

/**
 * Client-mode paging: slices already filtered and sorted `rows` and returns the page plus the
 * pager props. The page clamps when the rows shrink; a new page size starts from page 1.
 */
export function useCollectionPage<T>(
  rows: readonly T[],
  { pageSize: initialSize = 50 }: { pageSize?: number } = {},
): { rows: T[]; pager: ShellPagerState } {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const current = clampPage(page, rows.length, pageSize);
  return {
    rows: paginate(rows, current, pageSize),
    pager: {
      page: current,
      pageSize,
      total: rows.length,
      onPageChange: next => setPage(clampPage(next, rows.length, pageSize)),
      onPageSizeChange: size => {
        setPageSize(size);
        setPage(1);
      },
    },
  };
}
