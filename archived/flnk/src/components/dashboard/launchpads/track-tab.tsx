'use client'

import { Card } from '@cdlab/ui/components/card'
import type { DateRangePreset } from '@cdlab/ui/components/date-range-picker'
import { DateRangePicker } from '@cdlab/ui/components/date-range-picker'
import { Label } from '@cdlab/ui/components/label'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { useQuery } from '@tanstack/react-query'
import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import { BarChart3, Eye, Inbox, MousePointerClick } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import type { LaunchpadConfig } from '@/database/schema'
import { formatNumber } from '@/lib/format/format'
import { launchpadApi } from '@/lib/platform/api'

// Structural mirror of react-day-picker's DateRange — kept local so this app
// need not depend on react-day-picker (it lives in @cdlab/ui only).
type Range = { from: Date | undefined; to?: Date | undefined }

// Recharts drags in a large d3 tree; load the chart client-side only so it never
// reaches the Worker's server bundle.
const LaunchpadViewsChart = dynamic(
  () => import('./launchpad-views-chart').then((m) => m.LaunchpadViewsChart),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> },
)

function defaultRange(): Range {
  const to = new Date()
  return { from: subDays(to, 6), to }
}

interface TrackTabProps {
  launchpadId: string | null
  config: LaunchpadConfig
}

export function TrackTab({ launchpadId, config }: TrackTabProps) {
  const t = useTranslations('launchpads')
  const locale = useLocale()
  const dateLocale = locale === 'zh' ? zhCN : enUS

  const [range, setRange] = useState<Range>(defaultRange)
  const startAt = range.from ? startOfDay(range.from).getTime() : undefined
  const endAt = range.to
    ? endOfDay(range.to).getTime()
    : range.from
      ? endOfDay(range.from).getTime()
      : undefined

  const presets: DateRangePreset[] = [
    {
      label: t('track.range.today'),
      range: () => ({ from: new Date(), to: new Date() }),
    },
    {
      label: t('track.range.yesterday'),
      range: () => {
        const d = subDays(new Date(), 1)
        return { from: d, to: d }
      },
    },
    {
      label: t('track.range.last7'),
      range: () => ({ from: subDays(new Date(), 6), to: new Date() }),
    },
    {
      label: t('track.range.last30'),
      range: () => ({ from: subDays(new Date(), 29), to: new Date() }),
    },
    {
      label: t('track.range.thisWeek'),
      range: () => ({
        from: startOfWeek(new Date(), { locale: dateLocale }),
        to: endOfWeek(new Date(), { locale: dateLocale }),
      }),
    },
    {
      label: t('track.range.lastWeek'),
      range: () => {
        const d = subWeeks(new Date(), 1)
        return {
          from: startOfWeek(d, { locale: dateLocale }),
          to: endOfWeek(d, { locale: dateLocale }),
        }
      },
    },
    {
      label: t('track.range.thisMonth'),
      range: () => ({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
      }),
    },
    {
      label: t('track.range.lastMonth'),
      range: () => {
        const d = subMonths(new Date(), 1)
        return { from: startOfMonth(d), to: endOfMonth(d) }
      },
    },
  ]

  const query = useQuery({
    queryKey: ['launchpad-stats', launchpadId, startAt, endAt],
    enabled: Boolean(launchpadId && startAt),
    queryFn: () => launchpadApi.stats(launchpadId!, startAt!, endAt),
  })

  const stats = query.data
  const counts = new Map(stats?.blocks.map((b) => [b.blockId, b.count]))

  // Fill every day in the selected range so quiet days render as empty bars
  // (bitly parity); AE only returns days that actually had traffic.
  const chartData = useMemo(() => {
    if (!range.from) return []
    const series = new Map(stats?.series.map((s) => [s.time, s.views]))
    return eachDayOfInterval({
      start: range.from,
      end: range.to ?? range.from,
    }).map((day) => ({
      time: format(day, 'MMM d', { locale: dateLocale }),
      views: series.get(format(day, 'yyyy-MM-dd')) ?? 0,
    }))
  }, [stats, range, dateLocale])

  const picker = (
    <DateRangePicker
      value={range}
      onChange={(r) => r?.from && setRange(r)}
      presets={presets}
      clearable={false}
      numberOfMonths={2}
      maxDate={new Date()}
      locale={dateLocale}
      dateFormat="MMM d, yyyy"
      placeholder={t('track.range.placeholder')}
      className="w-full sm:w-[240px]"
    />
  )

  if (!launchpadId) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t('track.saveFirst')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label className="text-sm font-medium text-muted-foreground">
          {t('track.overview')}
        </Label>
        {picker}
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
          <Skeleton className="h-56 rounded-lg" />
        </div>
      ) : stats && !stats.configured ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('track.notConfigured')}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="gap-1 p-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Eye className="size-3.5" />
                {t('track.views')}
              </span>
              <span className="text-2xl font-semibold">
                {formatNumber(stats?.views ?? 0, locale)}
              </span>
            </Card>
            <Card className="gap-1 p-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MousePointerClick className="size-3.5" />
                {t('track.engagements')}
              </span>
              <span className="text-2xl font-semibold">
                {formatNumber(stats?.engagements ?? 0, locale)}
              </span>
            </Card>
          </div>

          <Card className="gap-3 p-4">
            <h3 className="text-sm font-medium">{t('track.chartTitle')}</h3>
            {chartData.some((d) => d.views > 0) ? (
              <LaunchpadViewsChart data={chartData} />
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Inbox className="size-6" />
                {t('track.noData')}
              </div>
            )}
          </Card>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <BarChart3 className="size-4" />
              {t('track.perBlock')}
            </Label>
            {config.blocks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('track.noBlocks')}
              </p>
            ) : (
              <Card className="divide-y p-0">
                {config.blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {t(`block.type.${block.type}`)}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(counts.get(block.id) ?? 0, locale)}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
