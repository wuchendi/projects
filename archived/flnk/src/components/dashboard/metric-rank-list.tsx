'use client'

import { Progress } from '@cdlab/ui/components/progress'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import { useLocale } from 'next-intl'
import { formatNumber } from '@/lib/format/format'

export interface RankItem {
  key: string
  label: string
  value: number
  /** Optional leading glyph, e.g. a country flag emoji ('🇺🇸'). */
  flag?: string
  /** When set, the row becomes a button. */
  onSelect?: () => void
}

// Ranked metric list: each row shows an optional flag, a label, its value and
// share of the total, with a Progress bar sized against the top item. Replaces
// the recharts bar chart for the overview "top links / top countries" cards.
export function MetricRankList({ items }: { items: RankItem[] }) {
  const locale = useLocale()
  const total = items.reduce((sum, i) => sum + i.value, 0) || 1

  return (
    // The scroll *viewport* (not the ScrollArea root) is the element that
    // overflows, so cap its height there: the list stays compact with few rows
    // and scrolls once it exceeds the cap. A plain <style> rule is used because
    // capping the root does nothing (the viewport's h-full grows past it).
    <>
      <style>
        {
          '.metric-rank-list [data-slot="scroll-area-viewport"]{max-height:280px}'
        }
      </style>
      <ScrollArea className="metric-rank-list">
        <ul className="space-y-3 pr-3">
          {items.map((it) => {
            const share = (it.value / total) * 100
            const body = (
              <>
                <div className="flex items-center gap-2 text-sm">
                  {it.flag && (
                    <span className="shrink-0 text-base leading-none">
                      {it.flag}
                    </span>
                  )}
                  <span className="truncate font-medium">{it.label}</span>
                  <span className="ml-auto shrink-0 tabular-nums">
                    {formatNumber(it.value, locale)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({share.toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <Progress value={share} className="mt-1.5 h-1.5" />
              </>
            )
            return (
              <li key={it.key}>
                {it.onSelect ? (
                  <button
                    type="button"
                    onClick={it.onSelect}
                    className="w-full text-left transition-opacity hover:opacity-80"
                  >
                    {body}
                  </button>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </>
  )
}
