'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { IKEmpty } from '@cdlab/ui/IK'
import { IKPageHeader } from '@cdlab/ui/IK/IKPageHeader'
import CountUp from '@cdlab/ui/reactbits/CountUp'
import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  FileSearchCorner,
  FileText,
  RotateCw,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

// recharts is heavy and client-only — load TrendChart on the client (ssr: false)
// so recharts stays out of the server (Worker) bundle, mirroring how flnk keeps
// its heaviest client-only visualisations (globe / map) out of SSR.
const TrendChart = dynamic(
  () => import('@/components/TrendChart').then((m) => m.TrendChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
  },
)

interface Overview {
  users: { total: number; enabled: number }
  templates: { total: number }
  logs24h: {
    total: number
    success: number
    failed: number
    successRate: number | null
  }
  recentBatches: Array<{
    id: string
    trigger: 'manual' | 'api' | 'cron'
    status: 'running' | 'success' | 'partial' | 'failed'
    totalCount: number
    successCount: number
    failedCount: number
    startedAt: string
    finishedAt: string | null
  }>
}

async function fetchOverview(): Promise<Overview> {
  const res = await fetch('/api/stats/overview')
  if (!res.ok) throw new Error('Failed to load overview')
  return res.json()
}

function StatusBadge({
  status,
}: {
  status: Overview['recentBatches'][number]['status']
}) {
  if (status === 'success') return <Badge>success</Badge>
  if (status === 'partial') return <Badge variant="outline">partial</Badge>
  if (status === 'failed') return <Badge variant="destructive">failed</Badge>
  return <Badge variant="outline">running</Badge>
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="ring-1">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="size-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-14" />
            <Skeleton className="mt-2 h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function BatchesSkeleton() {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3 w-16" />
        </li>
      ))}
    </ul>
  )
}

export default function HomePage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
  })

  const stats: Array<{
    label: string
    value: number | null
    suffix?: string
    sub: string | null
    alert: boolean
    icon: LucideIcon
  }> = [
    {
      label: '接收人',
      value: data?.users.total ?? 0,
      sub: data ? `${data.users.enabled} 已启用` : null,
      alert: false,
      icon: Users,
    },
    {
      label: '推送模板',
      value: data?.templates.total ?? 0,
      sub: null,
      alert: false,
      icon: FileText,
    },
    {
      label: '近 24h 推送',
      value: data?.logs24h.total ?? 0,
      sub: data?.logs24h.total
        ? `${data.logs24h.success} 成功 · ${data.logs24h.failed} 失败`
        : null,
      alert: (data?.logs24h.failed ?? 0) > 0,
      icon: Send,
    },
    {
      label: '24h 成功率',
      value: data?.logs24h.successRate ?? null,
      suffix: '%',
      sub:
        data?.logs24h.successRate != null
          ? data.logs24h.successRate >= 90
            ? '成功率良好'
            : '成功率偏低'
          : null,
      alert: data?.logs24h.successRate != null && data.logs24h.successRate < 90,
      icon: TrendingUp,
    },
  ]

  return (
    <div className="space-y-6">
      <IKPageHeader
        title="wepush"
        description="微信公众号定时推送控制台"
        actions={
          <>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => void refetch()}
                disabled={isFetching}
                aria-label="刷新数据"
              >
                <RotateCw
                  className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`}
                />
              </Button>
              <Link href="/dashboard/users">
                <Button size="sm">立即推送</Button>
              </Link>
            </div>
          </>
        }
      />

      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label} className="ring-1">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <CardAction>
                    <Icon
                      className={`size-4 ${
                        stat.alert
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-3xl font-bold tabular-nums tracking-tight ${
                      stat.alert ? 'text-destructive' : ''
                    }`}
                  >
                    {stat.value == null ? (
                      '—'
                    ) : (
                      <>
                        <CountUp to={stat.value} duration={1.2} separator="," />
                        {stat.suffix}
                      </>
                    )}
                  </div>
                  {stat.sub && (
                    <p
                      className={`mt-1 text-xs ${
                        stat.alert
                          ? 'text-destructive/70'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {stat.sub}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <TrendChart />

      <Card>
        <CardHeader>
          <CardTitle>最近批次</CardTitle>
          <CardAction>
            <Link
              href="/dashboard/logs"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              查看全部 <ArrowRight className="size-3" />
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <BatchesSkeleton />
          ) : !data || data.recentBatches.length === 0 ? (
            <IKEmpty
              icon={FileSearchCorner}
              title="暂无推送批次"
              description="前往接收人页面发起第一次推送"
            />
          ) : (
            <ul className="divide-y">
              {data.recentBatches.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/dashboard/logs/batches/${b.id}`}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={b.status} />
                      <span className="font-mono text-xs text-muted-foreground">
                        {b.trigger}
                      </span>
                      <span className="text-sm">
                        {new Date(b.startedAt).toLocaleString('zh-CN', {
                          hour12: false,
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {b.successCount}/{b.totalCount} 成功
                      {b.failedCount > 0 ? ` · ${b.failedCount} 失败` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
