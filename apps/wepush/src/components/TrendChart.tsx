'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import type { ChartConfig } from '@cdlab/ui/components/chart'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@cdlab/ui/components/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { IKEmpty } from '@cdlab/ui/IK'
import { useQuery } from '@tanstack/react-query'
import { BarChart2 } from 'lucide-react'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

interface DayStats {
  date: string
  total: number
  success: number
  failed: number
}

async function fetchTrend(days: number): Promise<{ days: DayStats[] }> {
  const res = await fetch(`/api/stats/trend?days=${days}`)
  if (!res.ok) throw new Error('Failed to load trend')
  return res.json()
}

const chartConfig = {
  success: {
    label: '成功',
    color: '#22c55e',
  },
  failed: {
    label: '失败',
    color: '#ef4444',
  },
} satisfies ChartConfig

const DAY_OPTIONS = [
  { value: '7', label: '近 7 天' },
  { value: '30', label: '近 30 天' },
]

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

export function TrendChart() {
  const [days, setDays] = useState<7 | 30>(7)

  const { data, isLoading } = useQuery({
    queryKey: ['trend', days],
    queryFn: () => fetchTrend(days),
  })

  const totalPushes = data?.days.reduce((s, d) => s + d.total, 0) ?? 0
  const totalFailed = data?.days.reduce((s, d) => s + d.failed, 0) ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>推送趋势</CardTitle>
        <CardDescription>
          {!isLoading && totalPushes > 0 ? (
            <>
              近 {days} 天共 {totalPushes} 次
              {totalFailed > 0 && (
                <span className="ml-1 text-destructive/70">
                  · {totalFailed} 失败
                </span>
              )}
            </>
          ) : (
            `最近 ${days} 天的推送统计`
          )}
        </CardDescription>
        <CardAction>
          <Select
            items={DAY_OPTIONS}
            value={String(days)}
            onValueChange={(v) => {
              if (v !== null) setDays(Number(v) as 7 | 30)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">近 7 天</SelectItem>
              <SelectItem value="30">近 30 天</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-60 w-full rounded-lg" />
        ) : !data || data.days.every((d) => d.total === 0) ? (
          <div className="flex h-60 items-center justify-center">
            <IKEmpty
              icon={BarChart2}
              title="暂无推送记录"
              description={`近 ${days} 天内没有推送数据`}
            />
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-60 w-full"
          >
            <AreaChart data={data.days}>
              <defs>
                <linearGradient id="fillSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-success)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-success)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-failed)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-failed)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={formatDate}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatDate(value as string)}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="failed"
                type="natural"
                fill="url(#fillFailed)"
                stroke="var(--color-failed)"
                stackId="a"
              />
              <Area
                dataKey="success"
                type="natural"
                fill="url(#fillSuccess)"
                stroke="var(--color-success)"
                stackId="a"
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
