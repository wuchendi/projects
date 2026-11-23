'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Checkbox } from '@cdlab/ui/components/checkbox'
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Eye,
  FileSearchCorner,
  Pencil,
  Plus,
  RotateCw,
  Send,
  Trash2,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { DryRunDialog } from '@/components/DryRunDialog'
import { SubHeader } from '@/components/layout'
import type { User } from '@/database/schema'
import type { DryRunUserResult } from '@/lib/push-client'
import { dryRunFromUi, runPushFromUi } from '@/lib/push-client'
import { fetchUsers } from '@/lib/queries'

async function patchUser(id: string, patch: Partial<User>): Promise<void> {
  const res = await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update user')
}

async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete user')
}

export default function UsersPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })
  // `?template=<code>` comes from the 接收人 space panel: only recipients bound
  // to that template are listed (and selectable).
  const template = useSearchParams().get('template')
  const rows = template
    ? data?.filter((u) => u.templateCode === template)
    : data

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dryRunOpen, setDryRunOpen] = useState(false)
  const [dryRunResults, setDryRunResults] = useState<
    DryRunUserResult[] | undefined
  >()

  // A selection made under another template filter is not visible any more.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on filter change only
  useEffect(() => setSelectedIds(new Set()), [template])

  const allSelected =
    !!rows && rows.length > 0 && selectedIds.size === rows.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked && rows ? new Set(rows.map((u) => u.id)) : new Set())
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const del = useMutation({
    mutationFn: async (id: string) => deleteUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('已删除')
    },
    onError: () => toast.error('删除失败'),
  })

  const push = useMutation({
    mutationFn: async (userIds?: string[]) =>
      runPushFromUi({ userIds, trigger: 'manual' }),
    onSuccess: (result) => {
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

  const dryRun = useMutation({
    mutationFn: async (userIds?: string[]) => dryRunFromUi({ userIds }),
    onSuccess: (res) => setDryRunResults(res.results),
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkEnable = useMutation({
    mutationFn: async (ids: string[]) =>
      Promise.all(ids.map((id) => patchUser(id, { enabled: true }))),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      clearSelection()
      toast.success('已批量启用')
    },
    onError: () => toast.error('操作失败'),
  })

  const bulkDisable = useMutation({
    mutationFn: async (ids: string[]) =>
      Promise.all(ids.map((id) => patchUser(id, { enabled: false }))),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      clearSelection()
      toast.success('已批量停用')
    },
    onError: () => toast.error('操作失败'),
  })

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) =>
      Promise.all(ids.map((id) => deleteUser(id))),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      clearSelection()
      toast.success('已批量删除')
    },
    onError: () => toast.error('删除失败'),
  })

  const bulkBusy =
    bulkEnable.isPending || bulkDisable.isPending || bulkDelete.isPending

  const openDryRun = (userIds?: string[]) => {
    setDryRunResults(undefined)
    setDryRunOpen(true)
    dryRun.mutate(userIds)
  }

  return (
    <>
      <SubHeader
        title={template ? `接收人 · ${template}` : '接收人'}
        description="微信测试号订阅者，含城市、纪念日、累计日配置。"
      >
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="刷新"
          onClick={() => void qc.invalidateQueries({ queryKey: ['users'] })}
        >
          <RotateCw className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={dryRun.isPending || !data || data.length === 0}
          onClick={() => openDryRun(undefined)}
        >
          <Eye className="size-4" />
          预览推送
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={push.isPending || !data || data.length === 0}
          onClick={() => push.mutate(undefined)}
        >
          <Zap className="size-4" />
          {push.isPending ? '推送中...' : '推送全部'}
        </Button>
        <Link href="/dashboard/users/new">
          <Button size="sm">
            <Plus className="size-4" />
            新建接收人
          </Button>
        </Link>
      </SubHeader>

      {/* Bulk action bar */}
      {selectedIds.size > 0 ? (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-2.5">
          <span className="text-sm font-medium">
            已选 {selectedIds.size} 人
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy}
              onClick={() => bulkEnable.mutate([...selectedIds])}
            >
              启用
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy}
              onClick={() => bulkDisable.mutate([...selectedIds])}
            >
              停用
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy || dryRun.isPending}
              onClick={() => openDryRun([...selectedIds])}
            >
              <Eye className="mr-1 size-3.5" />
              预览
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy || push.isPending}
              onClick={() => push.mutate([...selectedIds])}
            >
              <Send className="mr-1 size-3.5" />
              推送
            </Button>
            <ConfirmDeleteButton
              title="批量删除接收人"
              message={`确认删除所选的 ${selectedIds.size} 位接收人？此操作不可撤销。`}
              onConfirm={() => bulkDelete.mutate([...selectedIds])}
              disabled={bulkBusy}
              size="sm"
              variant="outline"
            >
              <Trash2 className="mr-1 size-3.5" />
              删除
            </ConfirmDeleteButton>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              取消
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-7 w-7" />
                  <Skeleton className="h-7 w-7" />
                  <Skeleton className="h-7 w-7" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : template && rows?.length === 0 ? (
        <IKEmpty
          icon={FileSearchCorner}
          className="border border-dashed"
          title="该模板下没有接收人"
          description={`没有接收人使用模板 ${template}。`}
        />
      ) : !rows || rows.length === 0 ? (
        <IKEmpty
          icon={FileSearchCorner}
          className="border border-dashed"
          title="还没有接收人"
          description="微信测试号订阅者，含城市、纪念日、累计日配置。"
        >
          <Link href="/dashboard/users/new" className="mt-4 inline-block">
            <Button size="sm">
              <Plus className="mr-1 size-4" />
              新建第一位接收人
            </Button>
          </Link>
        </IKEmpty>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={(c) => toggleAll(c === true)}
                    aria-label="全选"
                  />
                </TableHead>
                <TableHead>昵称</TableHead>
                <TableHead>OpenID</TableHead>
                <TableHead>模板</TableHead>
                <TableHead>城市</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-36 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow
                  key={u.id}
                  data-state={selectedIds.has(u.id) ? 'selected' : undefined}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={selectedIds.has(u.id)}
                      onCheckedChange={(c) => toggleOne(u.id, c === true)}
                      aria-label={`选择 ${u.name || u.id}`}
                    />
                  </TableCell>
                  <TableCell>{u.name || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {u.wechatOpenId || '—'}
                  </TableCell>
                  <TableCell className="font-mono">
                    {u.templateCode || '—'}
                  </TableCell>
                  <TableCell>{u.city || '—'}</TableCell>
                  <TableCell>
                    {u.enabled ? (
                      <Badge variant="secondary">启用</Badge>
                    ) : (
                      <Badge variant="outline">停用</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="立即推送"
                        title="立即推送"
                        disabled={push.isPending || !u.enabled}
                        onClick={() => push.mutate([u.id])}
                      >
                        <Send className="size-4" />
                      </Button>
                      <Link href={`/dashboard/users/${u.id}`}>
                        <Button variant="ghost" size="icon" aria-label="编辑">
                          <Pencil className="size-4" />
                        </Button>
                      </Link>
                      <ConfirmDeleteButton
                        title="删除接收人"
                        message={`确认删除 "${u.name || u.id}" ？此操作不可撤销。`}
                        onConfirm={() => del.mutate(u.id)}
                        disabled={del.isPending}
                      >
                        <Trash2 className="size-4" />
                      </ConfirmDeleteButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DryRunDialog
        open={dryRunOpen}
        onClose={() => setDryRunOpen(false)}
        loading={dryRun.isPending}
        results={dryRunResults}
        error={dryRun.error?.message}
      />
    </>
  )
}
