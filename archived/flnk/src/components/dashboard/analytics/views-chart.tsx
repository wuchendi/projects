'use client'

import { Badge } from '@cdlab/ui/components/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import type { ChartConfig } from '@cdlab/ui/components/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@cdlab/ui/components/chart'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { IKEmpty } from '@cdlab/ui/IK/IKEmpty'
import { cn } from '@cdlab/ui/lib/utils'
import { Inbox, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import type { ViewPoint } from '@/lib/platform/api'

const SERIES = ['visits', 'visitors'] as const

export function ViewsChart({
  data,
  loading,
}: {
  data: ViewPoint[]
  loading: boolean
}) {
  const t = useTranslations('analytics')

  const config = {
    visits: { label: t('counters.visits'), color: 'var(--chart-1)' },
    visitors: { label: t('counters.visitors'), color: 'var(--chart-2)' },
  } satisfies ChartConfig

  // Period-over-period change on visits, used for the header trend badge.
  const first = data[0]?.visits ?? 0
  const last = data[data.length - 1]?.visits ?? 0
  const trend = first === 0 ? null : ((last - first) / first) * 100
  const up = (trend ?? 0) >= 0

  return (
    <Card className="ring-1">
      <CardHeader>
        <CardTitle className="text-base">
          {t('views.title')}
          {trend !== null && data.length > 1 && (
            <Badge
              variant="secondary"
              className={cn(
                'ml-2',
                up
                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
              )}
            >
              {up ? (
                <TrendingUp aria-hidden="true" />
              ) : (
                <TrendingDown aria-hidden="true" />
              )}
              {`${up ? '+' : ''}${trend.toFixed(1)}%`}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{t('views.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : data.length === 0 ? (
          <IKEmpty className="h-[260px]" title={t('noData')} icon={Inbox} />
        ) : (
          <ChartContainer
            config={config}
            className="aspect-auto h-[260px] w-full"
          >
            <AreaChart
              accessibilityLayer
              data={data}
              margin={{ top: 20, right: 0, bottom: 0, left: 0 }}
            >
              <defs>
                {SERIES.map((key) => (
                  <linearGradient
                    key={key}
                    id={`fill-${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={`var(--color-${key})`}
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor={`var(--color-${key})`}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                interval="preserveStartEnd"
                padding={{ left: 12, right: 12 }}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              {SERIES.map((key) => (
                <Area
                  key={key}
                  dataKey={key}
                  type="natural"
                  fill={`url(#fill-${key})`}
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
