'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Input } from '@cdlab/ui/components/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { IKEmpty } from '@cdlab/ui/IK'
import { IKPageHeader } from '@cdlab/ui/IK/IKPageHeader'
import { CollectionPager } from '@cdlab/ui/shell/collection/collection-pager'
import { CollectionTable } from '@cdlab/ui/shell/collection/collection-table'
import type { ShellColumn } from '@cdlab/ui/shell/collection/columns'
import { Chips, FilterMenu, MenuSection } from '@cdlab/ui/shell/menus/menus'
import { useQuery } from '@tanstack/react-query'
import { FileSearchCorner, RotateCw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DatePicker } from '@/components/DatePicker'
import { LogDetailDrawer } from '@/components/LogDetailDrawer'
import { fetchUsers } from '@/lib/queries'

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

const STATUS_OPTIONS: { value: Filters['status']; label: string }[] = [
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

function statusParam(value: string | null): Filters['status'] {
  return value === 'success' || value === 'failed' ? value : 'all'
}

export default function LogsPage() {
  // `?status=` is shared with the 日志 space panel: the panel links set it,
  // and the status filter below writes it back.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlStatus = statusParam(searchParams.get('status'))
  const [filters, setFilters] = useState<Filters>({
    userId: '',
    status: urlStatus,
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

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(0)
  }

  useEffect(() => {
    setFilters((prev) =>
      prev.status === urlStatus ? prev : { ...prev, status: urlStatus },
    )
    setPage(0)
  }, [urlStatus])

  const setStatus = (status: Filters['status']) => {
    const params = new URLSearchParams(searchParams.toString())
    if (status === 'all') params.delete('status')
    else params.set('status', status)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  // Status is in the URL (and the panel); the rest are filter-menu fields.
  const activeFilters = [
    filters.userId,
    filters.status !== 'all',
    filters.batchId,
    filters.from,
    filters.to,
  ].filter(Boolean).length

  const resetFilters = () => {
    setFilters((prev) => ({
      ...prev,
      userId: '',
      batchId: '',
      from: '',
      to: '',
    }))
    setPage(0)
    setStatus('all')
  }

  const columns: ShellColumn<LogRow>[] = [
    {
      key: 'sentAt',
      header: '时间',
      width: '11rem',
      cell: (row) => (
        <span className="font-mono text-xs">
          {new Date(row.sentAt).toLocaleString('zh-CN', { hour12: false })}
        </span>
      ),
    },
    {
      key: 'user',
      header: '用户',
      width: 'minmax(6rem,0.8fr)',
      cell: (row) => row.userName || row.userId,
    },
    {
      key: 'template',
      header: '模板',
      width: 'minmax(6rem,0.8fr)',
      cell: (row) => (
        <span className="font-mono">{row.templateCode || '—'}</span>
      ),
    },
    {
      key: 'title',
      header: '标题 / 错误',
      width: 'minmax(12rem,2fr)',
      cell: (row) => (
        <span className="text-xs">
          {row.status === 'failed' && row.errorMessage
            ? row.errorMessage
            : row.renderedTitle || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: '5.5rem',
      core: true,
      cell: (row) =>
        row.status === 'success' ? (
          <Badge>success</Badge>
        ) : (
          <Badge variant="destructive">failed</Badge>
        ),
    },
  ]

  return (
    <>
      <IKPageHeader
        title="推送日志"
        description="按时间倒序，所有推送记录持久保留。"
        tools={
          <FilterMenu count={activeFilters} onReset={resetFilters}>
            <MenuSection label="状态">
              <Chips
                value={[filters.status]}
                options={STATUS_OPTIONS}
                onChange={(next) => {
                  // Single choice: the newest pick wins, an empty pick is 全部.
                  const picked = next.find((v) => v !== filters.status)
                  setStatus(picked ?? 'all')
                }}
              />
            </MenuSection>
            <MenuSection label="用户">
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
                <SelectTrigger size="sm" className="w-full">
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
            </MenuSection>
            <MenuSection label="批次 ID">
              <Input
                value={filters.batchId}
                onChange={(e) => updateFilter('batchId', e.target.value)}
                placeholder="UUID"
                className="h-8 font-mono"
              />
            </MenuSection>
            <MenuSection label="日期">
              <div className="grid grid-cols-2 gap-2">
                <DatePicker
                  value={filters.from}
                  onChange={(v) => updateFilter('from', v)}
                  className="w-full"
                  placeholder="起始"
                />
                <DatePicker
                  value={filters.to}
                  onChange={(v) => updateFilter('to', v)}
                  className="w-full"
                  placeholder="结束"
                />
              </div>
            </MenuSection>
          </FilterMenu>
        }
        actions={
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
        }
      />

      <CollectionTable
        label="推送日志"
        columns={columns}
        rows={data?.rows ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.renderedTitle || row.id}
        loading={isLoading}
        onOpen={(row) => setOpenLogId(row.id)}
        empty={
          <IKEmpty
            icon={FileSearchCorner}
            title="没有匹配的日志"
            description="请尝试重新筛选条件"
          />
        }
      />

      {data && data.total > 0 && (
        <CollectionPager
          className="mt-4"
          page={page + 1}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPageChange={(next) => setPage(next - 1)}
        />
      )}

      <LogDetailDrawer logId={openLogId} onClose={() => setOpenLogId(null)} />
    </>
  )
}
