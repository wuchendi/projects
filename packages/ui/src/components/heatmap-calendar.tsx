'use client'

import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import * as React from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { cn } from '@cdlab/ui/lib/utils'

export type HeatmapDatum = {
  date: string | Date
  value: number
  meta?: unknown
}

export type HeatmapCell = {
  date: Date
  key: string
  value: number
  level: number
  label: string
  disabled: boolean
  meta?: unknown
}

export type LegendConfig = {
  show?: boolean
  /** Default: "Less" */
  lessText?: React.ReactNode
  /** Default: "More" */
  moreText?: React.ReactNode
  /** Default: "bottom" */
  placement?: 'right' | 'bottom'
  /** Default: "row" */
  direction?: 'row' | 'column'
  /** Default: true */
  showText?: boolean
  /** Default: uses cellSize */
  swatchSize?: number
  /** Default: uses cellGap */
  swatchGap?: number
  className?: string
}

export type AxisLabelsConfig = {
  /** Default: true */
  show?: boolean
  /** Show weekday labels on the left. Default: true */
  showWeekdays?: boolean
  /** Show month labels on top. Default: true */
  showMonths?: boolean
  /**
   * Which weekday rows to label (0..6 in grid order top->bottom).
   * Default: Mon/Wed/Fri — [0,2,4] when weekStartsOn=1, [1,3,5] when =0.
   */
  weekdayIndices?: number[]
  /** Month label format. Default: "short" */
  monthFormat?: 'short' | 'long' | 'numeric'
  /** Minimum spacing in weeks between month labels. Default: 3 */
  minWeekSpacing?: number
  className?: string
}

export type HeatmapCalendarProps = {
  data: HeatmapDatum[]
  /** Number of days ending at endDate (default 365) */
  rangeDays?: number
  /** Last day of the range. Default: today */
  endDate?: Date
  weekStartsOn?: 0 | 1

  /** Cell size in px (default 12) */
  cellSize?: number
  /** Gap between cells in px (default 3) */
  cellGap?: number

  /** Called when a cell is clicked */
  onCellClick?: (cell: HeatmapCell) => void

  /** Tailwind class names for levels 0..N (used when palette is not provided) */
  levelClassNames?: string[]

  /**
   * Direct color palette for levels 0..N (e.g. ["#eee", "#bbf7d0", ...]). When
   * provided, it overrides levelClassNames for cell and legend coloring.
   */
  palette?: string[]

  /** Maps a raw value to a level index. Default: GitHub-ish buckets. */
  getLevel?: (value: number) => number

  /** Configure the legend, or set to false to hide it */
  legend?: boolean | LegendConfig

  /** Configure axis labels (weekday + month), or set to false to hide them */
  axisLabels?: boolean | AxisLabelsConfig

  /** Full custom legend render (overrides legend config UI) */
  renderLegend?: (args: {
    levelCount: number
    levelClassNames: string[]
    palette?: string[]
    cellSize: number
    cellGap: number
  }) => React.ReactNode

  /** Tooltip content override */
  renderTooltip?: (cell: HeatmapCell) => React.ReactNode

  className?: string
}

/* ---------------- utilities ---------------- */

/** Stable local-day key (date-fns formats in local time, matching parseDate). */
function toKey(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

/**
 * Parse a date input to a local Date. A bare `YYYY-MM-DD` becomes that local
 * day (lining up with toKey); a full ISO timestamp with an offset is converted
 * to local time as usual, which may land on the adjacent day.
 */
function parseDate(input: string | Date) {
  return input instanceof Date ? input : parseISO(input)
}

/** Default GitHub-ish buckets. */
function defaultGetLevel(value: number) {
  if (value <= 0) return 0
  if (value <= 2) return 1
  if (value <= 5) return 2
  if (value <= 10) return 3
  return 4
}

function clampLevel(level: number, levelCount: number) {
  return Math.max(0, Math.min(levelCount - 1, level))
}

function bgStyleForLevel(level: number, palette?: string[]) {
  if (!palette?.length) return undefined
  const idx = clampLevel(level, palette.length)
  return { backgroundColor: palette[idx] }
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

// Labels use date-fns format (en-US by default) so server and client agree —
// toLocaleDateString resolves the locale differently per environment and breaks
// hydration (e.g. "6月" on the server vs "Jun" on the client).
function formatMonth(d: Date, fmt: 'short' | 'long' | 'numeric') {
  if (fmt === 'numeric') return format(d, 'M/yy')
  return format(d, fmt === 'long' ? 'MMMM' : 'MMM')
}

function weekdayLabelForIndex(index: number, weekStartsOn: 0 | 1) {
  const actualDay = (weekStartsOn + index) % 7
  const base = new Date(2024, 0, 7 + actualDay)
  return format(base, 'EEE').toUpperCase()
}

const DEFAULT_LEVELS = [
  'bg-muted',
  'bg-primary/20',
  'bg-primary/35',
  'bg-primary/55',
  'bg-primary/75',
]

/* ---------------- component ---------------- */

export function HeatmapCalendar({
  data,
  rangeDays = 365,
  endDate,
  weekStartsOn = 1,
  cellSize = 12,
  cellGap = 3,
  onCellClick,
  levelClassNames,
  palette,
  getLevel = defaultGetLevel,
  legend = true,
  axisLabels = true,
  renderLegend,
  renderTooltip,
  className,
}: HeatmapCalendarProps) {
  // Default classes are semantic => good in light/dark.
  const levels = levelClassNames ?? DEFAULT_LEVELS
  const levelCount = palette?.length ? palette.length : levels.length

  const legendCfg: LegendConfig =
    legend === true ? {} : legend === false ? { show: false } : legend

  const axisCfg: AxisLabelsConfig =
    axisLabels === true
      ? {}
      : axisLabels === false
        ? { show: false }
        : axisLabels

  const showAxis = axisCfg.show ?? true
  const showWeekdays = axisCfg.showWeekdays ?? true
  const showMonths = axisCfg.showMonths ?? true
  // Mon/Wed/Fri regardless of week start (row 0 is weekStartsOn's day).
  const weekdayIndices =
    axisCfg.weekdayIndices ?? (weekStartsOn === 1 ? [0, 2, 4] : [1, 3, 5])
  const monthFormat = axisCfg.monthFormat ?? 'short'
  const minWeekSpacing = axisCfg.minWeekSpacing ?? 3

  // Primitive end-of-day timestamp keeps the columns memo stable across renders.
  const endTime = startOfDay(endDate ?? new Date()).getTime()

  const valueMap = React.useMemo(() => {
    const map = new Map<string, { value: number; meta?: unknown }>()
    for (const item of data) {
      const key = toKey(parseDate(item.date))
      const prev = map.get(key)
      const nextVal = (prev?.value ?? 0) + (item.value ?? 0) // sum merge
      map.set(key, { value: nextVal, meta: item.meta ?? prev?.meta })
    }
    return map
  }, [data])

  const columns: HeatmapCell[][] = React.useMemo(() => {
    const days = Math.max(1, Math.floor(rangeDays))
    const end = new Date(endTime)
    const start = addDays(end, -(days - 1))
    const firstWeek = startOfWeek(start, { weekStartsOn })
    const totalDays = differenceInCalendarDays(end, firstWeek) + 1
    const weeks = Math.ceil(totalDays / 7)

    const cols: HeatmapCell[][] = []
    for (let w = 0; w < weeks; w++) {
      const col: HeatmapCell[] = []
      for (let d = 0; d < 7; d++) {
        const date = addDays(firstWeek, w * 7 + d)
        const inRange = date >= start && date <= end
        const key = toKey(date)
        const v = inRange ? (valueMap.get(key)?.value ?? 0) : 0
        const meta = inRange ? valueMap.get(key)?.meta : undefined
        const lvl = inRange ? getLevel(v) : 0
        col.push({
          date,
          key,
          value: v,
          level: clampLevel(lvl, levelCount),
          disabled: !inRange,
          meta,
          label: format(date, 'MMM d, yyyy'),
        })
      }
      cols.push(col)
    }
    return cols
  }, [valueMap, endTime, rangeDays, weekStartsOn, levelCount, getLevel])

  const monthLabels = React.useMemo(() => {
    if (!showAxis || !showMonths)
      return [] as { colIndex: number; text: string }[]

    const labels: { colIndex: number; text: string }[] = []
    let lastLabeledWeek = -999

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      const firstInCol = col.find((c) => !c.disabled)?.date ?? col[0].date
      const prevCol = i > 0 ? columns[i - 1] : null
      const prevFirst =
        prevCol?.find((c) => !c.disabled)?.date ?? prevCol?.[0]?.date
      const monthChanged = !prevFirst || !sameMonth(firstInCol, prevFirst)

      if (monthChanged && i - lastLabeledWeek >= minWeekSpacing) {
        labels.push({ colIndex: i, text: formatMonth(firstInCol, monthFormat) })
        lastLabeledWeek = i
      }
    }
    return labels
  }, [columns, showAxis, showMonths, monthFormat, minWeekSpacing])

  /* ---------------- legend ---------------- */

  const showLegend = legendCfg.show ?? true
  const placement = legendCfg.placement ?? 'bottom'
  const direction = legendCfg.direction ?? 'row'
  const showText = legendCfg.showText ?? true
  const lessText = legendCfg.lessText ?? 'Less'
  const moreText = legendCfg.moreText ?? 'More'
  const swatchSize = legendCfg.swatchSize ?? cellSize
  const swatchGap = legendCfg.swatchGap ?? cellGap

  const LegendUI = renderLegend ? (
    renderLegend({
      levelCount,
      levelClassNames: levels,
      palette,
      cellSize,
      cellGap,
    })
  ) : !showLegend ? null : (
    // GitHub-style inline legend: Less ▢▢▢▢▢ More.
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs text-muted-foreground',
        direction === 'row' ? 'flex-row' : 'flex-col',
        legendCfg.className,
      )}
    >
      {showText ? <span>{lessText}</span> : null}

      <div
        className={cn(
          'flex items-center',
          direction === 'row' ? 'flex-row' : 'flex-col',
        )}
        style={{ gap: `${swatchGap}px` }}
      >
        {Array.from({ length: levelCount }, (_, level) => ({
          level,
          cls: levels[clampLevel(level, levels.length)],
        })).map(({ level, cls }) => (
          // key by level (0..N-1) — always unique even if colors/classes repeat.
          <div
            key={level}
            className={cn('rounded-[3px]', !palette?.length && cls)}
            style={{
              width: swatchSize,
              height: swatchSize,
              ...(bgStyleForLevel(level, palette) ?? {}),
            }}
            aria-hidden="true"
          />
        ))}
      </div>

      {showText ? <span>{moreText}</span> : null}
    </div>
  )

  /* ---------------- tooltip ---------------- */

  const tooltipNode = (cell: HeatmapCell) => {
    if (renderTooltip) return renderTooltip(cell)
    if (cell.disabled) return 'Outside range'
    const unit = cell.value === 1 ? 'event' : 'events'
    return (
      <div className="text-left">
        <div className="font-medium">
          {cell.value} {unit}
        </div>
        <div className="text-background/70">{cell.label}</div>
      </div>
    )
  }

  // Weekday cell is 40px wide + mr-2 (8px) → month labels must clear 48px.
  const weekdayLabelWidth = showAxis && showWeekdays ? 48 : 0

  const weekdayRows = Array.from({ length: 7 }, (_, rowIdx) => ({
    name: weekdayLabelForIndex(rowIdx, weekStartsOn),
    show: weekdayIndices.includes(rowIdx),
  }))

  return (
    <TooltipProvider delay={80}>
      <div
        className={cn(
          'flex w-full min-w-0 gap-3',
          placement === 'bottom' ? 'flex-col' : 'flex-row items-start',
          className,
        )}
      >
        {/* Labeled calendar area — scrolls on its own so it never overlaps the legend */}
        <div className={cn('min-w-0 overflow-x-auto', axisCfg.className)}>
          {/* Month labels row */}
          {showAxis && showMonths ? (
            <div
              className="flex items-end"
              style={{ paddingLeft: weekdayLabelWidth }}
            >
              <div
                className="relative"
                style={{
                  height: 18,
                  width: columns.length * (cellSize + cellGap) - cellGap,
                }}
              >
                {monthLabels.map((m) => (
                  <div
                    key={m.colIndex}
                    className="absolute text-xs text-muted-foreground"
                    style={{ left: m.colIndex * (cellSize + cellGap), top: 0 }}
                  >
                    {m.text}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex">
            {/* Weekday labels column */}
            {showAxis && showWeekdays ? (
              <div
                className="mr-2 flex flex-col"
                style={{ gap: `${cellGap}px` }}
                aria-hidden="true"
              >
                {weekdayRows.map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-end text-xs text-muted-foreground"
                    style={{ width: 40, height: cellSize }}
                  >
                    {row.show ? row.name : ''}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Heatmap grid */}
            <div
              className="flex"
              style={{ gap: `${cellGap}px` }}
              role="grid"
              aria-label="Heatmap calendar"
            >
              {columns.map((col, i) => (
                <div
                  key={col[0].key}
                  className="flex flex-col"
                  style={{ gap: `${cellGap}px` }}
                  role="rowgroup"
                >
                  {col.map((cell) => {
                    const cls = levels[clampLevel(cell.level, levels.length)]
                    return (
                      <Tooltip key={cell.key}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              disabled={cell.disabled}
                              onClick={() =>
                                !cell.disabled && onCellClick?.(cell)
                              }
                              className={cn(
                                'rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                !palette?.length && cls,
                                cell.disabled &&
                                  'cursor-default opacity-30 pointer-events-none',
                              )}
                              style={{
                                width: cellSize,
                                height: cellSize,
                                ...(bgStyleForLevel(cell.level, palette) ?? {}),
                              }}
                              aria-label={
                                cell.disabled
                                  ? 'Outside range'
                                  : `${cell.label}: ${cell.value}`
                              }
                            />
                          }
                        />
                        <TooltipContent side="top">
                          {tooltipNode(cell)}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        {LegendUI}
      </div>
    </TooltipProvider>
  )
}
