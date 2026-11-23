'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cdlab/ui/components/table'
import { IKEmpty } from '@cdlab/ui/IK'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  FileSearchCorner,
  RotateCw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { DatePicker } from '@/components/DatePicker'
import { LogDetailDrawer } from '@/components/LogDetailDrawer'
import { SubHeader } from '@/components/layout'
import type { User } from '@/database/schema'

interface LogRow {
  id: string
  batchId: string
  userId: string
  userName: string | null
  templateCode: string
  status: 'success' | 'failed'
  renderedTitle: string
  errorMessage: string | null
  sentAt: string
}

interface LogsResponse {
  rows: LogRow[]
  total: number
  limit: number
  offset: number
}

interface Filters {
  userId: string
  status: 'all' | 'success' | 'failed'
  batchId: string
  from: string
  to: string
}

const PAGE_SIZE = 50

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
]

async function fetchLogs(
  filters: Filters,
  page: number,
): Promise<LogsResponse> {
  const params = new URLSearchParams()
  if (filters.userId) params.set('userId', filters.userId)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.batchId) params.set('batchId', filters.batchId)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  params.set('limit', String(PAGE_SIZE))
  params.set('offset', String(page * PAGE_SIZE))
  const res = await fetch(`/api/logs?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to load logs')
  return res.json()
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users?limit=200&offset=0')
  if (!res.ok) throw new Error('Failed to load users')
  const data = (await res.json()) as { rows: User[] }
  return data.rows
}

export default function LogsPage() {
  const [filters, setFilters] = useState<Filters>({
    userId: '',
    status: 'all',
    batchId: '',
    from: '',
    to: '',
  })
  const [page, setPage] = useState(0)
  const [openLogId, setOpenLogId] = useState<string | null>(null)

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['logs', filters, page],
    queryFn: () => fetchLogs(filters, page),
  })

  const totalPages = useMemo(() => {
    if (!data) return 1
    return Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  }, [data])

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(0)
  }

  return (
    <>
      <SubHeader
        title="推送日志"
        description="按时间倒序，所有推送记录持久保留。"
      >
        <>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="刷新"
          >
            <RotateCw
              className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`}
            />
          </Button>
        </>
      </SubHeader>

      <div className="mb-6 rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">用户</Label>
            <Select
              items={[
                { value: 'all', label: '全部用户' },
                ...(users ?? []).map((u) => ({
                  value: u.id,
                  label: u.name || u.id,
                })),
              ]}
              value={filters.userId || 'all'}
              onValueChange={(v) =>
                updateFilter('userId', !v || v === 'all' ? '' : v)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部用户</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">状态</Label>
            <Select
              items={STATUS_OPTIONS}
              value={filters.status}
              onValueChange={(v) => {
                if (v !== null) updateFilter('status', v as Filters['status'])
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">批次 ID</Label>
            <Input
              value={filters.batchId}
              onChange={(e) => updateFilter('batchId', e.target.value)}
              placeholder="UUID"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">起始日期</Label>
            <DatePicker
              value={filters.from}
              onChange={(v) => updateFilter('from', v)}
              className="w-full"
              placeholder="不限"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">结束日期</Label>
            <DatePicker
              value={filters.to}
              onChange={(v) => updateFilter('to', v)}
              className="w-full"
              placeholder="不限"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {[0, 1, 2, 3, 4, 5].map((i) => (
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
      ) : !data || data.rows.length === 0 ? (
        <IKEmpty
          icon={FileSearchCorner}
          className="border border-dashed"
          title="没有匹配的日志"
          description="请尝试重新筛选条件"
        />
      ) : (
        <>
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
                {data.rows.map((row) => (
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

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              共 {data.total} 条 · 当前 {page * PAGE_SIZE + 1}-
              {Math.min((page + 1) * PAGE_SIZE, data.total)}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-4" />
                上一页
              </Button>
              <span className="text-xs">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <LogDetailDrawer logId={openLogId} onClose={() => setOpenLogId(null)} />
    </>
  )
}
