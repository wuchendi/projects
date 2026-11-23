/** Page sizes offered by `<CollectionPager>` unless the host passes its own. */
export const PAGE_SIZES = [20, 50, 100] as const;

/** Number of pages for `total` rows (at least one, so an empty list reads "1 of 1"). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/** `page` (1-based) kept within the pages that exist. */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, Math.floor(page)), pageCount(total, pageSize));
}

/** The rows of one page (1-based); out-of-range pages clamp to the nearest one. */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  const start = (clampPage(page, rows.length, pageSize) - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
