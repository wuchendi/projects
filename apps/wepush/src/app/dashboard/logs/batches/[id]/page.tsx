'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cdlab/ui/components/table'
import { IKPageHeader } from '@cdlab/ui/IK/IKPageHeader'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { LogDetailDrawer } from '@/components/LogDetailDrawer'
import { retryBatchFromUi } from '@/lib/push-client'

interface BatchSummary {
  id: string
  trigger: 'manual' | 'api' | 'cron'
  status: 'running' | 'success' | 'partial' | 'failed'
  totalCount: number
  successCount: number
  failedCount: number
  startedAt: string
  finishedAt: string | null
}

interface BatchLogRow {
  id: string
  userId: string
  userName: string | null
  templateCode: string
  status: 'success' | 'failed'
  renderedTitle: string
  errorMessage: string | null
  sentAt: string
}

interface BatchResponse {
  batch: BatchSummary
  logs: BatchLogRow[]
}

async function fetchBatch(id: string): Promise<BatchResponse> {
  const res = await fetch(`/api/batches/${id}`)
  if (!res.ok) throw new Error('Failed to load batch')
  return res.json()
}

function statusBadge(status: BatchSummary['status']) {
  if (status === 'success') return <Badge>success</Badge>
  if (status === 'partial') return <Badge variant="outline">partial</Badge>
  if (status === 'failed') return <Badge variant="destructive">failed</Badge>
  return <Badge variant="outline">running</Badge>
}

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const qc = useQueryClient()
  const [openLogId, setOpenLogId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['batch', id],
    queryFn: () => fetchBatch(id),
    // The batch is populated asynchronously in the background, so keep polling
    // while it's still running to surface live progress.
    refetchInterval: (query) =>
      query.state.data?.batch?.status === 'running' ? 2000 : false,
  })

  const retry = useMutation({
    mutationFn: () => retryBatchFromUi(id),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['batch', id] })
      const action = {
        label: '查看批次',
        onClick: () => router.push(`/dashboard/logs/batches/${result.batchId}`),
      }
      if (result.alreadyRunning) {
        toast.info('已有推送正在进行', { action })
      } else {
        toast.success('推送已开始，正在后台发送', { action })
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <IKPageHeader
        title="推送批次详情"
        description={`批次 ID: ${id}`}
        actions={
          <>
            {data?.batch.failedCount ? (
              <Button
                variant="outline"
                size="sm"
                disabled={retry.isPending}
                onClick={() => retry.mutate()}
              >
                <RotateCcw className="mr-1 size-3.5" />
                {retry.isPending
                  ? '重推中...'
                  : `重推失败（${data.batch.failedCount}）`}
              </Button>
            ) : null}
            <Link href="/dashboard/logs">
              <Button variant="ghost" size="sm">
                返回日志
              </Button>
            </Link>
          </>
        }
      />

      {isLoading ? (
        <>
          <div className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-card">
            <div className="divide-y">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : isError || !data ? (
        <div className="rounded-lg border bg-card py-16 text-center text-sm text-muted-foreground">
          批次未找到
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cell label="触发">{data.batch.trigger}</Cell>
            <Cell label="状态">{statusBadge(data.batch.status)}</Cell>
            <Cell label="开始">
              {new Date(data.batch.startedAt).toLocaleString('zh-CN', {
                hour12: false,
              })}
            </Cell>
            <Cell label="结束">
              {data.batch.finishedAt
                ? new Date(data.batch.finishedAt).toLocaleString('zh-CN', {
                    hour12: false,
                  })
                : '—'}
            </Cell>
            <Cell label="总数">{data.batch.totalCount}</Cell>
            <Cell label="成功">{data.batch.successCount}</Cell>
            <Cell label="失败">
              <span
                className={data.batch.failedCount > 0 ? 'text-destructive' : ''}
              >
                {data.batch.failedCount}
              </span>
            </Cell>
            <Cell label="成功率">
              {data.batch.totalCount === 0
                ? '—'
                : `${Math.round(
                    (data.batch.successCount / data.batch.totalCount) * 100,
                  )}%`}
            </Cell>
          </div>

          {data.logs.length === 0 ? (
            <div className="rounded-lg border bg-card py-16 text-center text-sm text-muted-foreground">
              该批次没有日志
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>模板</TableHead>
                    <TableHead>标题 / 错误</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={() => setOpenLogId(row.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs">
                        {new Date(row.sentAt).toLocaleString('zh-CN', {
                          hour12: false,
                        })}
                      </TableCell>
                      <TableCell>{row.userName || row.userId}</TableCell>
                      <TableCell className="font-mono">
                        {row.templateCode || '—'}
                      </TableCell>
                      <TableCell className="max-w-md truncate text-xs">
                        {row.status === 'failed' && row.errorMessage
                          ? row.errorMessage
                          : row.renderedTitle || '—'}
                      </TableCell>
                      <TableCell>
                        {row.status === 'success' ? (
                          <Badge>success</Badge>
                        ) : (
                          <Badge variant="destructive">failed</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <LogDetailDrawer logId={openLogId} onClose={() => setOpenLogId(null)} />
    </>
  )
}

function Cell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
