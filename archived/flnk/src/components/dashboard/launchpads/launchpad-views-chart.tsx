'use client'

import type { ChartConfig } from '@cdlab/ui/components/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@cdlab/ui/components/chart'
import { useLocale, useTranslations } from 'next-intl'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { formatNumber } from '@/lib/format/format'

// Daily launchpad page-views bar chart. Kept in its own client-only module so
// the Track tab can lazy-load it with `ssr: false`, keeping recharts' large d3
// dependency tree out of the Worker's server bundle.
export function LaunchpadViewsChart({
  data,
}: {
  data: { time: string; views: number }[]
}) {
  const t = useTranslations('launchpads')
  const locale = useLocale()

  const config = {
    views: { label: t('track.views'), color: 'var(--chart-1)' },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
          fontSize={11}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => formatNumber(Number(value), locale)}
            />
          }
        />
        <Bar
          dataKey="views"
          fill="var(--color-views)"
          radius={4}
          maxBarSize={40}
        />
      </BarChart>
    </ChartContainer>
  )
}
