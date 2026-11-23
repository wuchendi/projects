import type { ReactNode } from "react";

/** One column of a `CollectionTable`. The first column is the primary (name) column. */
export interface ShellColumn<T> {
  key: string;
  header: ReactNode;
  /** Name in the display menu's column switches; defaults to a text `header`, then `key`. */
  label?: string | undefined;
  /** CSS grid track. Primary defaults to `minmax(14rem,1fr)`, the others to `6.5rem`. */
  width?: string;
  align?: "start" | "end";
  /** Clicking the header sorts by this key. */
  sortKey?: string;
  /** Kept on narrow screens. */
  core?: boolean;
  /** Offered as a switch in the display menu (defaults to true; never for the primary column). */
  hideable?: boolean;
  cell: (row: T) => ReactNode;
}

const PRIMARY_WIDTH = "minmax(14rem,1fr)";
const DEFAULT_WIDTH = "6.5rem";
export const SELECT_WIDTH = "1rem";
export const ACTIONS_WIDTH = "5.25rem";

/** The columns to show: the primary always, the rest unless hidden; only core ones when narrow. */
export function visibleColumns<T>(
  columns: readonly ShellColumn<T>[],
  hidden: readonly string[],
  narrow: boolean,
): ShellColumn<T>[] {
  return columns.filter((c, i) => i === 0 || (narrow ? !!c.core : !hidden.includes(c.key)));
}

/** The grid tracks shared by the header and every row. */
export function gridTracks<T>(
  columns: readonly ShellColumn<T>[],
  { selectable, actions }: { selectable: boolean; actions: string | null },
): string[] {
  const tracks: string[] = [];
  if (selectable) tracks.push(SELECT_WIDTH);
  columns.forEach((c, i) => {
    tracks.push(c.width ?? (i === 0 ? PRIMARY_WIDTH : DEFAULT_WIDTH));
  });
  if (actions) tracks.push(actions);
  return tracks;
}

/** The grid template shared by the header and every row. */
export function gridTemplate<T>(
  columns: readonly ShellColumn<T>[],
  options: { selectable: boolean; actions: string | null },
): string {
  return gridTracks(columns, options).join(" ");
}

const LENGTH = /^-?\d*\.?\d+(px|rem|em|ch|vw|vh)$/;

/** The narrowest a track gets: the first argument of `minmax()`, a fixed length, else 0. */
export function trackMinimum(track: string): string {
  const t = track.trim();
  const minmax = /^minmax\(\s*([^,]+?)\s*,/.exec(t);
  const min = minmax ? (minmax[1] as string) : t;
  return LENGTH.test(min) ? min : "0px";
}

/** Row gap (`gap-3`) and horizontal padding (`px-2` on both sides) of every row. */
const ROW_GAP = 0.75;
const ROW_PADDING = 1;

/**
 * The narrowest the table can be before its columns overlap: every track's minimum plus the gaps
 * and the row padding. Wider containers stretch it; narrower ones scroll.
 */
export function tableMinWidth(tracks: readonly string[]): string {
  const gaps = Math.max(0, tracks.length - 1) * ROW_GAP + ROW_PADDING;
  return `calc(${[...tracks.map(trackMinimum), `${gaps}rem`].join(" + ")})`;
}

/** Columns a user can show or hide. */
export function hideableColumns<T>(columns: readonly ShellColumn<T>[]): ShellColumn<T>[] {
  return columns.filter((c, i) => i > 0 && c.hideable !== false);
}

/** Elements inside a row that handle their own clicks (and so do not open the row). */
const ROW_INTERACTIVE = 'a, button, input, label, [role="checkbox"], [role="menuitem"]';

/**
 * Whether a click opens the row: its target is inside the row's own DOM (React also bubbles clicks
 * from portaled menus and dialogs) and not on an element with its own click.
 */
export function opensRow(row: Element, target: EventTarget | null): boolean {
  return target instanceof Element && row.contains(target) && !target.closest(ROW_INTERACTIVE);
}

/** A row's accessible name: `getRowLabel`, else a text primary cell, else the id. */
export function rowLabel<T>(
  row: T,
  id: string,
  columns: readonly ShellColumn<T>[],
  getRowLabel: ((row: T) => string) | undefined,
): string {
  if (getRowLabel) return getRowLabel(row);
  const primary = columns[0]?.cell(row);
  return typeof primary === "string" || typeof primary === "number" ? String(primary) : id;
}

/** A column's name in the display menu. */
export function columnLabel<T>(column: ShellColumn<T>): string {
  return column.label ?? (typeof column.header === "string" ? column.header : column.key);
}
