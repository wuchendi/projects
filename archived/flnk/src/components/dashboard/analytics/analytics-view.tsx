'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { HeatmapCalendar } from '@cdlab/ui/components/heatmap-calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { IKEmpty } from '@cdlab/ui/IK/IKEmpty'
import { useQuery } from '@tanstack/react-query'
import { Inbox, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { CountersCards } from '@/components/dashboard/analytics/counters'
import { statsApi } from '@/lib/platform/api'
import { queryKeys } from '@/lib/platform/query-keys'

// Map lib is client-only (SVG, runtime topojson fetch) — skip SSR.
const WorldMap = dynamic(
  () =>
    import('@/components/dashboard/analytics/world-map').then(
      (m) => m.WorldMap,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />,
  },
)

// Recharts pulls in a large d3 tree and is browser-only — lazy-load ssr:false
// so it never enters the Worker's server bundle.
const ViewsChart = dynamic(
  () =>
    import('@/components/dashboard/analytics/views-chart').then(
      (m) => m.ViewsChart,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[240px] w-full" />,
  },
)

const MetricGroup = dynamic(
  () =>
    import('@/components/dashboard/analytics/metric-group').then(
      (m) => m.MetricGroup,
    ),
  { ssr: false },
)

const DAY = 24 * 60 * 60 * 1000
const RANGES: Record<string, number> = {
  '1d': DAY,
  '7d': 7 * DAY,
  '30d': 30 * DAY,
  '90d': 90 * DAY,
}
const GROUPS = [
  { key: 'location', dims: ['country', 'region', 'city'] },
  { key: 'referer', dims: ['referer', 'slug'] },
  { key: 'time', dims: ['language', 'timezone'] },
  { key: 'device', dims: ['device', 'deviceType'] },
  { key: 'browser', dims: ['os', 'browser', 'browserType'] },
] as const

export function AnalyticsView() {
  const t = useTranslations('analytics')
  const searchParams = useSearchParams()
  const [range, setRange] = useState('7d')
  // Seed the drill-down from a `?slug=` link (e.g. the links list Analytics action).
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const slug = searchParams.get('slug')
    const init: Record<string, string> = {}
    if (slug) init.slug = slug
    return init
  })

  // endAt is captured when the range changes so query keys stay stable.
  const dateWindow = useMemo(() => {
    const end = Date.now()
    return { startAt: end - RANGES[range]!, endAt: end }
  }, [range])
  const params = useMemo(
    () => ({ ...dateWindow, filters }),
    [dateWindow, filters],
  )

  const counters = useQuery({
    queryKey: queryKeys.counters(params),
    queryFn: () => statsApi.counters(params),
  })
  const views = useQuery({
    queryKey: ['views', params],
    queryFn: () => statsApi.views(params),
  })
  const location = useQuery({
    queryKey: ['location', params],
    queryFn: () => statsApi.location(params),
  })

  // GitHub-style calendar is fixed to the last 365 days — independent of the
  // range selector, so it needs its own daily-bucketed query (filters still
  // apply). Window is captured once per filter change to keep the key stable.
  const calendarParams = useMemo(() => {
    const end = Date.now()
    return { startAt: end - 365 * DAY, endAt: end, filters }
  }, [filters])
  const calendar = useQuery({
    queryKey: ['calendar', calendarParams],
    queryFn: () => statsApi.views(calendarParams),
  })
  const calendarData = useMemo(
    () =>
      (calendar.data?.views ?? []).map((v) => ({
        date: v.time.slice(0, 10),
        value: v.visits,
      })),
    [calendar.data],
  )

  function drill(dim: string, value: string) {
    setFilters((f) => ({ ...f, [dim]: value }))
  }
  function removeFilter(dim: string) {
    setFilters((f) =>
      Object.fromEntries(Object.entries(f).filter(([k]) => k !== dim)),
    )
  }

  const activeFilters = Object.entries(filters)
  const notConfigured = counters.data?.configured === false

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(RANGES).map((r) => (
              <SelectItem key={r} value={r}>
                {t(`range.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {notConfigured && (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {t('notConfigured')}
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map(([dim, value]) => (
            <Badge key={dim} variant="secondary" className="gap-1">
              <span className="text-muted-foreground">
                {t(`metrics.${dim}`)}:
              </span>
              {value}
              <button
                type="button"
                aria-label={t('removeFilter')}
                onClick={() => removeFilter(dim)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
            {t('clearFilters')}
          </Button>
        </div>
      )}

      <CountersCards data={counters.data} loading={counters.isLoading} />
      <ViewsChart data={views.data?.views ?? []} loading={views.isLoading} />

      <div className="grid gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <MetricGroup
            key={g.key}
            titleKey={g.key}
            dims={[...g.dims]}
            params={params}
            onDrill={drill}
          />
        ))}
      </div>

      <Card className="ring-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('map.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {location.isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (location.data?.points.length ?? 0) === 0 ? (
            <IKEmpty className="h-[300px]" title={t('noData')} icon={Inbox} />
          ) : (
            <div className="h-[300px]">
              <WorldMap points={location.data?.points ?? []} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="ring-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('heatmap.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {calendar.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <HeatmapCalendar
              data={calendarData}
              rangeDays={365}
              endDate={new Date(calendarParams.endAt)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
