'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { ContextMenuItem } from '@cdlab/ui/components/context-menu'
import { IKEmpty } from '@cdlab/ui/IK'
import { IKPageHeader } from '@cdlab/ui/IK/IKPageHeader'
import {
  BatchBar,
  BatchBarSeparator,
} from '@cdlab/ui/shell/collection/batch-bar'
import { CollectionTable } from '@cdlab/ui/shell/collection/collection-table'
import type { ShellColumn } from '@cdlab/ui/shell/collection/columns'
import { ColumnsSection } from '@cdlab/ui/shell/collection/columns-section'
import {
  FeatureIntro,
  IntroArtArrow,
  IntroArtCard,
} from '@cdlab/ui/shell/intro/feature-intro'
import { DisplayMenu, HeaderSearch } from '@cdlab/ui/shell/menus/menus'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Eye,
  FileSearchCorner,
  Pencil,
  Plus,
  RotateCw,
  Send,
  Trash2,
  Users,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { DryRunDialog } from '@/components/DryRunDialog'
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
  const [search, setSearch] = useState('')
  const hasUsers = !!data && data.length > 0
  const q = search.trim().toLowerCase()
  const rows = data?.filter(
    (u) =>
      (!template || u.templateCode === template) &&
      (!q ||
        [u.name, u.wechatOpenId, u.city].some((v) =>
          v?.toLowerCase().includes(q),
        )),
  )
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const toggleColumn = (key: string) =>
    setHiddenColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dryRunOpen, setDryRunOpen] = useState(false)
  const [dryRunResults, setDryRunResults] = useState<
    DryRunUserResult[] | undefined
  >()

  // A selection made under another filter / search is not visible any more.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on filter change only
  useEffect(() => setSelectedIds(new Set()), [template, search])

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

  const columns: ShellColumn<User>[] = [
    {
      key: 'name',
      header: '昵称',
      width: 'minmax(8rem,1fr)',
      cell: (u) => u.name || '—',
    },
    {
      key: 'openId',
      header: 'OpenID',
      width: 'minmax(12rem,1.4fr)',
      cell: (u) => (
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {u.wechatOpenId || '—'}
        </span>
      ),
    },
    {
      key: 'template',
      header: '模板',
      width: 'minmax(8rem,1fr)',
      cell: (u) => (
        <span className="block truncate font-mono" title={u.templateCode}>
          {u.templateCode || '—'}
        </span>
      ),
    },
    { key: 'city', header: '城市', cell: (u) => u.city || '—' },
    {
      key: 'status',
      header: '状态',
      width: '4.5rem',
      core: true,
      cell: (u) =>
        u.enabled ? (
          <Badge variant="secondary">启用</Badge>
        ) : (
          <Badge variant="outline">停用</Badge>
        ),
    },
  ]

  return (
    <>
      <IKPageHeader
        title={template ? `接收人 · ${template}` : '接收人'}
        description="微信测试号订阅者，含城市、纪念日、累计日配置。"
        tools={
          hasUsers ? (
            <>
              <HeaderSearch
                value={search}
                onChange={setSearch}
                placeholder="搜索昵称、OpenID、城市"
              />
              <DisplayMenu>
                <ColumnsSection
                  columns={columns}
                  hidden={hiddenColumns}
                  onToggle={toggleColumn}
                />
              </DisplayMenu>
            </>
          ) : undefined
        }
        actions={
          <>
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
              disabled={dryRun.isPending || !hasUsers}
              onClick={() => openDryRun(undefined)}
            >
              <Eye className="size-4" />
              预览推送
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={push.isPending || !hasUsers}
              onClick={() => push.mutate(undefined)}
            >
              <Zap className="size-4" />
              {push.isPending ? '推送中...' : '推送全部'}
            </Button>
            <Button
              size="sm"
              render={<Link href="/dashboard/users/new" />}
              nativeButton={false}
            >
              <Plus className="size-4" />
              新建接收人
            </Button>
          </>
        }
      />

      {!isLoading && !hasUsers ? (
        <FeatureIntro
          icon={Users}
          label="接收人"
          title="添加第一位接收人"
          description="接收人是关注了微信测试号的用户。为每位接收人设置模板、城市和纪念日，定时推送时会为他们各自生成一条模板消息。"
          action={
            <Button
              render={<Link href="/dashboard/users/new" />}
              nativeButton={false}
            >
              <Plus className="size-4" />
              新建接收人
            </Button>
          }
          art={
            <>
              <IntroArtCard>
                <p className="font-medium">小明 · 上海</p>
                <p className="text-muted-foreground">
                  模板 daily · 纪念日 05-20
                </p>
              </IntroArtCard>
              <IntroArtArrow />
              <IntroArtCard>
                <p className="font-medium">每天 07:30</p>
                <p className="text-muted-foreground">
                  天气、纪念日倒数、每日一句
                </p>
              </IntroArtCard>
            </>
          }
        />
      ) : (
        <CollectionTable
          label="接收人"
          columns={columns}
          rows={rows ?? []}
          getRowId={(u) => u.id}
          getRowLabel={(u) => u.name || u.id}
          hiddenColumns={hiddenColumns}
          loading={isLoading}
          selection={{
            selected: selectedIds,
            onToggle: toggleOne,
            onToggleAll: toggleAll,
          }}
          onOpen={(u) => router.push(`/dashboard/users/${u.id}`)}
          rowMenu={(u) => (
            <>
              <ContextMenuItem
                onClick={() => router.push(`/dashboard/users/${u.id}`)}
              >
                <Pencil />
                编辑
              </ContextMenuItem>
              <ContextMenuItem
                disabled={push.isPending || !u.enabled}
                onClick={() => push.mutate([u.id])}
              >
                <Send />
                立即推送
              </ContextMenuItem>
            </>
          )}
          rowActions={(u) => (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="立即推送"
                title="立即推送"
                disabled={push.isPending || !u.enabled}
                onClick={() => push.mutate([u.id])}
              >
                <Send />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="编辑"
                title="编辑"
                render={<Link href={`/dashboard/users/${u.id}`} />}
                nativeButton={false}
              >
                <Pencil />
              </Button>
              <ConfirmDeleteButton
                title="删除接收人"
                message={`确认删除 "${u.name || u.id}" ？此操作不可撤销。`}
                onConfirm={() => del.mutate(u.id)}
                disabled={del.isPending}
              >
                <Trash2 className="size-4" />
              </ConfirmDeleteButton>
            </>
          )}
          actionsWidth="6.5rem"
          empty={
            <IKEmpty
              icon={FileSearchCorner}
              title={template ? '该模板下没有接收人' : '没有匹配的接收人'}
              description={
                template
                  ? `没有接收人使用模板 ${template}。`
                  : '换个关键词试试。'
              }
            />
          }
        />
      )}

      {selectedIds.size > 0 && (
        <BatchBar count={selectedIds.size} onClear={clearSelection}>
          <Button
            variant="ghost"
            size="sm"
            disabled={bulkBusy}
            onClick={() => bulkEnable.mutate([...selectedIds])}
          >
            启用
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={bulkBusy}
            onClick={() => bulkDisable.mutate([...selectedIds])}
          >
            停用
          </Button>
          <BatchBarSeparator />
          <Button
            variant="ghost"
            size="sm"
            disabled={bulkBusy || dryRun.isPending}
            onClick={() => openDryRun([...selectedIds])}
          >
            <Eye />
            预览
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={bulkBusy || push.isPending}
            onClick={() => push.mutate([...selectedIds])}
          >
            <Send />
            推送
          </Button>
          <ConfirmDeleteButton
            title="批量删除接收人"
            message={`确认删除所选的 ${selectedIds.size} 位接收人？此操作不可撤销。`}
            onConfirm={() => bulkDelete.mutate([...selectedIds])}
            disabled={bulkBusy}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="mr-1 size-3.5" />
            删除
          </ConfirmDeleteButton>
        </BatchBar>
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
