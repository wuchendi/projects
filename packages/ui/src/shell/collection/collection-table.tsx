"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "cn";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactElement, ReactNode } from "react";
import { Fragment, useRef } from "react";
import { Checkbox } from "@cdlab/ui/components/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@cdlab/ui/components/context-menu";
import { ScrollBar } from "@cdlab/ui/components/scroll-area";
import type { ShellColumn } from "@cdlab/ui/shell/collection/columns";
import {
  ACTIONS_WIDTH,
  gridTracks,
  opensRow,
  rowLabel,
  tableMinWidth,
  visibleColumns,
} from "@cdlab/ui/shell/collection/columns";
import { formatLabel } from "@cdlab/ui/shell/core/labels";
import { useShellLabels } from "@cdlab/ui/shell/core/labels-context";
import { usePageFill } from "@cdlab/ui/shell/core/page-fill";
import { useIsMobile } from "@cdlab/ui/shell/core/use-is-mobile";
import { SHELL_ROW_ATTR, useRowNavigation } from "@cdlab/ui/shell/core/use-row-navigation";

export interface CollectionTableProps<T> {
  /** The first column is the primary (name) column. */
  columns: ShellColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** The row's name for its checkbox; defaults to a text primary cell, then the id. */
  getRowLabel?: ((row: T) => string) | undefined;
  hiddenColumns?: string[];
  sort?: { key: string; direction?: "asc" | "desc"; onSort: (key: string) => void };
  selection?:
    | {
        selected: ReadonlySet<string>;
        onToggle: (id: string, on: boolean) => void;
        onToggleAll: (on: boolean) => void;
      }
    | undefined;
  /** Opens a row on click (outside its own controls) or Enter. */
  onOpen?: ((row: T) => void) | undefined;
  /** Right-click menu entries for a row. */
  rowMenu?: ((row: T) => ReactNode) | undefined;
  /** Trailing cell, revealed on hover or focus (e.g. icon buttons and a "more" menu). */
  rowActions?: ((row: T) => ReactNode) | undefined;
  actionsWidth?: string;
  getRowClassName?: ((row: T) => string | undefined) | undefined;
  /** A full-width block under a row, shown while it returns non-null; the host owns expansion. */
  renderSubRow?: ((row: T) => ReactNode | null) | undefined;
  /** Skeleton rows in place of the rows, under the header. */
  loading?: boolean | undefined;
  /** Shown in place of the rows when there are none (and not loading), under the header. */
  empty?: ReactNode;
  /** Accessible name of the table. */
  label?: string;
  /** Extra classes for the sticky column header. */
  headerClassName?: string;
}

const SKELETON_ROWS = 8;

const ALIGN_END = "flex justify-end text-right";

// Opaque row states (the secondary tint mixed into the background), so the pinned actions cell
// can inherit them and cover what scrolls underneath.
const ROW_STATES =
  "hover:bg-[color-mix(in_oklab,var(--color-secondary)_50%,var(--color-background))] focus-visible:bg-[color-mix(in_oklab,var(--color-secondary)_60%,var(--color-background))] data-selected:bg-[color-mix(in_oklab,var(--color-secondary)_70%,var(--color-background))]";

// Cells clip; the 4px inset keeps focus rings of controls inside them visible.
const CELL = "-m-1 min-w-0 overflow-hidden p-1";

/** Plain text and numbers end with an ellipsis; other nodes manage their own overflow. */
function cellContent(node: ReactNode): ReactNode {
  return typeof node === "string" || typeof node === "number" ? (
    <span className="block min-w-0 truncate">{node}</span>
  ) : (
    node
  );
}

/**
 * A column list: a sticky header (select all, sortable columns) over rows of at least 36px. Rows
 * open on click or Enter, take J/K, offer a right-click menu and reveal their actions (pinned to
 * the right edge) on hover. Narrow screens keep the primary and `core` columns. Inside
 * `<PageBody fill>` the rows scroll on their own under the header; elsewhere the header pins below
 * the page header. A table wider than its container scrolls sideways inside itself and never
 * widens its parent.
 */
export function CollectionTable<T>({
  columns,
  rows,
  getRowId,
  getRowLabel,
  hiddenColumns = [],
  sort,
  selection,
  onOpen,
  rowMenu,
  rowActions,
  actionsWidth = ACTIONS_WIDTH,
  getRowClassName,
  renderSubRow,
  loading = false,
  empty,
  label,
  headerClassName,
}: CollectionTableProps<T>) {
  const labels = useShellLabels();
  const narrow = useIsMobile();
  const fill = usePageFill();
  const listRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useRowNavigation(listRef);

  const shown = visibleColumns(columns, hiddenColumns, narrow);
  const tracks = gridTracks(shown, {
    selectable: !!selection,
    actions: rowActions ? actionsWidth : null,
  });
  const template = tracks.join(" ");
  const minWidth = tableMinWidth(tracks);
  const ids = rows.map(getRowId);
  const allSelected = !!selection && ids.length > 0 && ids.every(id => selection.selected.has(id));

  function openFromClick(row: T, e: MouseEvent) {
    if (onOpen && opensRow(e.currentTarget, e.target)) onOpen(row);
  }
  function openOnEnter(row: T, e: KeyboardEvent) {
    if (onOpen && e.key === "Enter" && e.target === e.currentTarget) {
      e.preventDefault();
      onOpen(row);
    }
  }

  return (
    <div
      role="table"
      aria-label={label}
      ref={listRef}
      className={cn("flex min-w-0 flex-col [contain:inline-size]", fill && "min-h-0 flex-1")}
    >
      {/* Outside the scroll area so it can stick to the page; follows the rows sideways. */}
      <div
        ref={headRef}
        className={cn(
          "z-10 shrink-0 overflow-hidden border-b bg-background",
          !fill && "sticky top-12",
          headerClassName,
        )}
      >
        <div
          role="row"
          style={{ gridTemplateColumns: template, minWidth }}
          className="grid h-9 items-center gap-3 px-2 text-xs text-muted-foreground"
        >
          {selection && (
            <span className="flex">
              <Checkbox
                checked={allSelected}
                disabled={loading || ids.length === 0}
                onCheckedChange={v => selection.onToggleAll(v === true)}
                aria-label={labels.selectAll}
              />
            </span>
          )}
          {shown.map(c => {
            const active = !!sort && !!c.sortKey && sort.key === c.sortKey;
            const Arrow = sort?.direction === "asc" ? ArrowUp : ArrowDown;
            return (
              <span
                key={c.key}
                role="columnheader"
                aria-sort={
                  active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined
                }
                className={cn("min-w-0 truncate", c.align === "end" && ALIGN_END)}
              >
                {c.sortKey && sort ? (
                  <button
                    type="button"
                    onClick={() => sort.onSort(c.sortKey!)}
                    className={cn(
                      "inline-flex items-center gap-0.5 hover:text-foreground",
                      active && "text-foreground",
                    )}
                  >
                    {c.header}
                    {active && <Arrow className="size-3" />}
                  </button>
                ) : (
                  c.header
                )}
              </span>
            );
          })}
          {rowActions && <span />}
        </div>
      </div>
      <ScrollAreaPrimitive.Root
        data-slot="collection-scroll"
        className={cn("relative min-w-0", fill && "min-h-0 flex-1")}
      >
        <ScrollAreaPrimitive.Viewport
          className="size-full outline-none"
          onScroll={e => {
            if (headRef.current) headRef.current.scrollLeft = e.currentTarget.scrollLeft;
          }}
        >
          <div role="rowgroup" style={{ minWidth }} className="flex flex-col gap-px py-px">
            {loading &&
              Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
                  key={i}
                  role="row"
                  aria-hidden="true"
                  data-slot="collection-skeleton"
                  style={{ gridTemplateColumns: template }}
                  className="grid h-9 items-center gap-3 px-2"
                >
                  {selection && <span />}
                  {shown.map((c, j) => (
                    <span key={c.key} className={cn("flex", c.align === "end" && "justify-end")}>
                      <span
                        className={cn(
                          "h-3 animate-pulse rounded bg-muted",
                          j === 0 ? "w-2/3" : "w-1/2",
                        )}
                      />
                    </span>
                  ))}
                  {rowActions && <span />}
                </div>
              ))}
            {!loading && rows.length === 0 && empty}
            {!loading &&
              rows.map(row => {
                const id = getRowId(row);
                const selected = !!selection?.selected.has(id);
                const element = (
                  <div
                    role="row"
                    tabIndex={0}
                    {...{ [SHELL_ROW_ATTR]: "" }}
                    data-selected={selected || undefined}
                    style={{ gridTemplateColumns: template }}
                    onClick={e => openFromClick(row, e)}
                    onKeyDown={e => openOnEnter(row, e)}
                    className={cn(
                      "group grid min-h-9 min-w-0 items-center gap-3 rounded-md px-2 py-1 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                      ROW_STATES,
                      onOpen && "cursor-pointer",
                      getRowClassName?.(row),
                    )}
                  >
                    {selection && (
                      <span className="flex">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={v => selection.onToggle(id, v === true)}
                          aria-label={formatLabel(labels.selectRow, {
                            name: rowLabel(row, id, columns, getRowLabel),
                          })}
                          className={cn(
                            "transition-opacity",
                            !selected &&
                              "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100",
                          )}
                        />
                      </span>
                    )}
                    {shown.map(c => (
                      <span
                        key={c.key}
                        role="cell"
                        className={cn(CELL, c.align === "end" && ALIGN_END)}
                      >
                        {cellContent(c.cell(row))}
                      </span>
                    ))}
                    {rowActions && (
                      <span className="sticky right-0 flex justify-end rounded-r-md bg-inherit opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
                        {rowActions(row)}
                      </span>
                    )}
                  </div>
                );
                const sub = renderSubRow?.(row);
                return (
                  <Fragment key={id}>
                    {withMenu(element, rowMenu?.(row))}
                    {sub != null && (
                      <div role="row" data-slot="collection-subrow" className="px-2 pb-2">
                        <div role="cell" className="min-w-0">
                          {sub}
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
          </div>
        </ScrollAreaPrimitive.Viewport>
        {fill && <ScrollBar />}
        <ScrollBar orientation="horizontal" />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    </div>
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
