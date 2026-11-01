'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { useQuery } from '@tanstack/react-query'
import { Globe } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { eventKey, localTime } from '@/lib/format/format'
import { statsApi } from '@/lib/platform/api'

// WebGL globe is client-only — skip SSR and lazy-load so it never blocks the page.
const RealtimeGlobe = dynamic(
  () =>
    import('@/components/dashboard/realtime/globe').then(
      (m) => m.RealtimeGlobe,
    ),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="mx-auto aspect-square w-full max-w-[420px] rounded-full" />
    ),
  },
)

// Recharts is heavy (~d3 tree) and browser-only — lazy-load ssr:false to keep
// it out of the Worker's server bundle.
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

const MIN = 60 * 1000
const WINDOWS: Record<string, number> = {
  '1h': 60 * MIN,
  '6h': 6 * 60 * MIN,
  '24h': 24 * 60 * MIN,
}
const EVENTS_INTERVAL = 12_000
const CHART_INTERVAL = 15_000
const GLOBE_INTERVAL = 20_000

export function RealtimeView() {
  const t = useTranslations('realtime')
  const locale = useLocale()
  const [windowKey, setWindowKey] = useState('6h')

  // refetchIntervalInBackground defaults to false, so polling pauses when the
  // tab is hidden — exactly the desired realtime behaviour.
  const events = useQuery({
    queryKey: ['rt-events'],
    queryFn: () => statsApi.events({}),
    refetchInterval: EVENTS_INTERVAL,
  })
  const views = useQuery({
    queryKey: ['rt-views', windowKey],
    queryFn: () => {
      const end = Date.now()
      return statsApi.views({ startAt: end - WINDOWS[windowKey]!, endAt: end })
    },
    refetchInterval: CHART_INTERVAL,
  })
  const location = useQuery({
    queryKey: ['rt-location', windowKey],
    queryFn: () => {
      const end = Date.now()
      return statsApi.location({
        startAt: end - WINDOWS[windowKey]!,
        endAt: end,
      })
    },
    refetchInterval: GLOBE_INTERVAL,
  })

  const rows = events.data?.events ?? []
  const points = location.data?.points ?? []
  const notConfigured =
    events.data?.configured === false || views.data?.configured === false

  // Track which event keys we've already shown so only genuinely new rows play
  // the entrance animation on each poll (the first render animates the batch).
  const seenRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (seenRef.current.size > 500) seenRef.current.clear()
    for (const e of rows) seenRef.current.add(eventKey(e))
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Select value={windowKey} onValueChange={setWindowKey}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(WINDOWS).map((w) => (
              <SelectItem key={w} value={w}>
                {t(`window.${w}`)}
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

      <ViewsChart data={views.data?.views ?? []} loading={views.isLoading} />

      <Card className="ring-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('globe.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {location.isLoading ? (
            <Skeleton className="mx-auto aspect-square w-full max-w-[420px] rounded-full" />
          ) : (
            <>
              <RealtimeGlobe points={points} />
              {points.length === 0 && (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {t('globe.empty')}
                </p>
              )}
            </>
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
            {t('events.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {t('events.empty')}
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((e) => {
                const key = eventKey(e)
                const isNew = !seenRef.current.has(key)
                return (
                  <li
                    key={key}
                    className={`flex items-center justify-between gap-3 py-2 text-sm${
                      isNew
                        ? ' animate-in fade-in slide-in-from-top-2 duration-500'
                        : ''
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium">/{e.slug}</span>
                      <span className="truncate text-muted-foreground">
                        {[e.city, e.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <span className="hidden sm:inline">
                        {[e.os, e.browser, e.deviceType]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span className="tabular-nums">
                        {localTime(e.timestamp, locale)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
