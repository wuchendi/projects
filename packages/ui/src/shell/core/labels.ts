/** Every string the shell shows. Hosts pass their own (e.g. built from i18n) to `<AppShell labels>`. */
export interface ShellLabels {
  toggleSidebar: string;
  openMenu: string;
  search: string;
  searchPlaceholder: string;
  searchEmpty: string;
  searchFailed: string;
  goTo: string;
  filter: string;
  /** `{count}` is replaced with the number of active filters. */
  filterActive: string;
  display: string;
  reset: string;
  clearSearch: string;
  loading: string;
  /** `{count}` is replaced with the number of selected rows. */
  selectedCount: string;
  selectAll: string;
  deselectAll: string;
  /** `{name}` is replaced with the row's name. */
  selectRow: string;
  clearSelection: string;
  columns: string;
  /** `{total}` is replaced with the number of rows. */
  pagerTotal: string;
  /** `{count}` and `{total}` are replaced with the selected and total rows. */
  pagerSelected: string;
  /** `{page}` and `{pages}` are replaced with the current page and the page count. */
  pagerPage: string;
  /** `{size}` is replaced with the rows per page. */
  pageSize: string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
}

export const shellLabelsEn: ShellLabels = {
  toggleSidebar: "Toggle sidebar",
  openMenu: "Open menu",
  search: "Search",
  searchPlaceholder: "Search or jump to…",
  searchEmpty: "Nothing found.",
  searchFailed: "Search failed.",
  goTo: "Go to",
  filter: "Filter",
  filterActive: "Filter · {count}",
  display: "Display",
  reset: "Reset",
  clearSearch: "Clear search",
  loading: "Loading",
  selectedCount: "{count} selected",
  selectAll: "Select all",
  deselectAll: "Deselect all",
  selectRow: "Select {name}",
  clearSelection: "Clear selection",
  columns: "Columns",
  pagerTotal: "{total} items",
  pagerSelected: "{count} of {total} selected",
  pagerPage: "Page {page} of {pages}",
  pageSize: "{size} / page",
  firstPage: "First page",
  previousPage: "Previous page",
  nextPage: "Next page",
  lastPage: "Last page",
};

export const shellLabelsZh: ShellLabels = {
  toggleSidebar: "切换左侧边栏",
  openMenu: "打开菜单",
  search: "搜索",
  searchPlaceholder: "搜索或跳转到…",
  searchEmpty: "没有找到结果。",
  searchFailed: "搜索失败。",
  goTo: "跳转到",
  filter: "筛选",
  filterActive: "筛选 · {count}",
  display: "显示",
  reset: "重置",
  clearSearch: "清除搜索",
  loading: "加载中",
  selectedCount: "已选 {count} 项",
  selectAll: "全选",
  deselectAll: "取消全选",
  selectRow: "选择 {name}",
  clearSelection: "取消选择",
  columns: "列",
  pagerTotal: "共 {total} 条",
  pagerSelected: "已选 {count} / {total} 条",
  pagerPage: "第 {page} / {pages} 页",
  pageSize: "{size} 条/页",
  firstPage: "第一页",
  previousPage: "上一页",
  nextPage: "下一页",
  lastPage: "最后一页",
};

/** Replaces `{name}` placeholders in a label. */
export function formatLabel(label: string, values: Record<string, string | number>): string {
  return label.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
