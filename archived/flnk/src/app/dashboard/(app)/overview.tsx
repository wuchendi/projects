'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import CountUp from '@cdlab/ui/reactbits/CountUp'
import { useQuery } from '@tanstack/react-query'
import { Globe, Link2, MousePointerClick, Share2, Users } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { MetricRankList } from '@/components/dashboard/metric-rank-list'
import { eventKey, localTime } from '@/lib/format/format'
import { flagEmoji, regionName } from '@/lib/geo/country'
import { linkApi, statsApi } from '@/lib/platform/api'
import { queryKeys } from '@/lib/platform/query-keys'

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

// Recharts / the SVG map pull in large browser-only trees — lazy-load ssr:false
// so they stay out of the Worker's server bundle.
const ViewsChart = dynamic(
  () =>
    import('@/components/dashboard/analytics/views-chart').then(
      (m) => m.ViewsChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> },
)
const WorldMap = dynamic(
  () =>
    import('@/components/dashboard/analytics/world-map').then(
      (m) => m.WorldMap,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> },
)

export function DashboardOverview() {
  const t = useTranslations('dashboard')
  const tAnalytics = useTranslations('analytics')
  const locale = useLocale()
  const router = useRouter()

  // Fixed at first render — the 30d window is anchored to page load.
  const startAt = useMemo(() => Date.now() - THIRTY_DAYS, [])

  const countQuery = useQuery({
    queryKey: queryKeys.linkCount(),
    queryFn: () => linkApi.count(),
  })
  const countersQuery = useQuery({
    queryKey: queryKeys.counters({ startAt }),
    queryFn: () => statsApi.counters({ startAt }),
  })
  const viewsQuery = useQuery({
    queryKey: ['overview-views', startAt],
    queryFn: () => statsApi.views({ startAt }),
  })
  const eventsQuery = useQuery({
    queryKey: ['overview-events'],
    queryFn: () => statsApi.events({}),
    refetchInterval: 20_000,
  })
  const topLinksQuery = useQuery({
    queryKey: ['overview-top-links', startAt],
    queryFn: () => statsApi.metrics('slug', { startAt }),
  })
  const topCountriesQuery = useQuery({
    queryKey: ['overview-top-countries', startAt],
    queryFn: () => statsApi.metrics('country', { startAt }),
  })

  const configured = countersQuery.data?.configured ?? true
  const counters = countersQuery.data
  const events = (eventsQuery.data?.events ?? []).slice(0, 12)
  const topLinks = (topLinksQuery.data?.metrics ?? []).slice(0, 5)
  // Full country list drives the map choropleth; the bar chart shows the top 5.
  const countryMetrics = topCountriesQuery.data?.metrics ?? []
  const topCountries = countryMetrics.slice(0, 5)

  const stats = [
    {
      key: 'totalLinks',
      icon: Link2,
      value: countQuery.data?.total ?? 0,
      loading: countQuery.isLoading,
      gated: false,
      caption: t('overview.allTime'),
    },
    {
      key: 'totalVisits',
      icon: MousePointerClick,
      value: counters?.visits ?? 0,
      loading: countersQuery.isLoading,
      gated: true,
      caption: t('overview.last30Days'),
    },
    {
      key: 'totalVisitors',
      icon: Users,
      value: counters?.visitors ?? 0,
      loading: countersQuery.isLoading,
      gated: true,
      caption: t('overview.last30Days'),
    },
    {
      key: 'totalReferers',
      icon: Share2,
      value: counters?.referers ?? 0,
      loading: countersQuery.isLoading,
      gated: true,
      caption: t('overview.last30Days'),
    },
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card className="ring-1" key={s.key}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t(`overview.${s.key}`)}
                </CardTitle>
                <CardAction>
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent>
                {s.loading ? (
                  <Skeleton className="h-9 w-20" />
                ) : s.gated && !configured ? (
                  <p className="text-sm text-muted-foreground">
                    {tAnalytics('notConfigured')}
                  </p>
                ) : (
                  <>
                    <div className="text-3xl font-bold tabular-nums">
                      <CountUp to={s.value} duration={1.2} separator="," />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.caption}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <ViewsChart
        data={viewsQuery.data?.views ?? []}
        loading={viewsQuery.isLoading}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="ring-1 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('overview.globalReach')}
            </CardTitle>
            <CardDescription>{t('overview.last30Days')}</CardDescription>
          </CardHeader>
          <CardContent>
            {topCountriesQuery.isLoading ? (
              <Skeleton className="h-[340px] w-full" />
            ) : countryMetrics.length === 0 ? (
              <div className="flex h-[340px] items-center justify-center text-sm text-muted-foreground">
                {tAnalytics('noData')}
              </div>
            ) : (
              <div className="h-[340px]">
                <WorldMap countries={countryMetrics} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="ring-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              {t('overview.recentActivity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsQuery.isLoading ? (
              <Skeleton className="h-[340px] w-full" />
            ) : events.length === 0 ? (
              <div className="flex h-[340px] items-center justify-center text-sm text-muted-foreground">
                {t('overview.activityEmpty')}
              </div>
            ) : (
              <ScrollArea className="h-[340px]">
                <ul className="-my-1 divide-y">
                  {events.map((e) => (
                    <li
                      key={eventKey(e)}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-medium">/{e.slug}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[e.city, e.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {localTime(e.timestamp, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="ring-1">
          <CardHeader>
            <CardTitle>{t('overview.topLinks')}</CardTitle>
            <CardDescription>{t('overview.last30Days')}</CardDescription>
          </CardHeader>
          <CardContent>
            {topLinksQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : topLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tAnalytics('noData')}
              </p>
            ) : (
              <MetricRankList
                items={topLinks.map((l) => ({
                  key: l.name,
                  label: `/${l.name}`,
                  value: l.count,
                  onSelect: () =>
                    router.push(
                      `/dashboard/analytics?slug=${encodeURIComponent(l.name)}`,
                    ),
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card className="ring-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>{t('overview.topCountries')}</CardTitle>
              <CardDescription>{t('overview.last30Days')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {topCountriesQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tAnalytics('noData')}
              </p>
            ) : (
              <MetricRankList
                items={topCountries.map((c) => ({
                  key: c.name,
                  label: regionName(c.name, locale),
                  value: c.count,
                  flag: flagEmoji(c.name),
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
