'use client'

import { Button } from '@cdlab/ui/components/button'
import { IKEmpty } from '@cdlab/ui/IK'
import { IKPageHeader } from '@cdlab/ui/IK/IKPageHeader'
import { CollectionTable } from '@cdlab/ui/shell/collection/collection-table'
import type { ShellColumn } from '@cdlab/ui/shell/collection/columns'
import {
  FeatureIntro,
  IntroArtArrow,
  IntroArtCard,
} from '@cdlab/ui/shell/intro/feature-intro'
import { HeaderSearch } from '@cdlab/ui/shell/menus/menus'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileSearchCorner,
  FileText,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import type { Template } from '@/database/schema'
import { fetchTemplates } from '@/lib/queries'

export default function TemplatesPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success('已删除')
    },
    onError: () => toast.error('删除失败'),
  })

  const q = search.trim().toLowerCase()
  const rows = data?.filter(
    (t) =>
      !q || [t.code, t.title, t.desc].some((v) => v.toLowerCase().includes(q)),
  )
  const hasTemplates = !!data && data.length > 0

  const columns: ShellColumn<Template>[] = [
    {
      key: 'code',
      header: 'Code',
      width: 'minmax(8rem,0.8fr)',
      cell: (t) => <span className="font-mono">{t.code}</span>,
    },
    {
      key: 'title',
      header: '标题',
      width: 'minmax(8rem,1fr)',
      cell: (t) => t.title || '—',
    },
    {
      key: 'desc',
      header: '内容预览',
      width: 'minmax(12rem,2fr)',
      cell: (t) => (
        <span className="text-muted-foreground">{t.desc || '—'}</span>
      ),
    },
  ]

  return (
    <>
      <IKPageHeader
        title="推送模板"
        description="支持 {{variable.DATA}} 模板变量，每位用户通过 code 关联模板。"
        tools={
          hasTemplates ? (
            <HeaderSearch
              value={search}
              onChange={setSearch}
              placeholder="搜索 code、标题、内容"
            />
          ) : undefined
        }
        actions={
          <>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="刷新"
              onClick={() =>
                void qc.invalidateQueries({ queryKey: ['templates'] })
              }
            >
              <RotateCw className="size-3.5" />
            </Button>
            <Button
              size="sm"
              render={<Link href="/dashboard/templates/new" />}
              nativeButton={false}
            >
              <Plus className="size-4" />
              新建模板
            </Button>
          </>
        }
      />

      {!isLoading && !hasTemplates ? (
        <FeatureIntro
          icon={FileText}
          label="模板"
          title="创建第一个推送模板"
          description="模板对应微信测试号里的模板消息，正文用 {{variable.DATA}} 引用天气、纪念日、每日一句等变量。接收人通过 code 关联模板。"
          action={
            <Button
              render={<Link href="/dashboard/templates/new" />}
              nativeButton={false}
            >
              <Plus className="size-4" />
              新建模板
            </Button>
          }
          art={
            <>
              <IntroArtCard>
                <p className="font-mono text-xs">daily</p>
                <p className="text-muted-foreground">
                  {'今天{{city.DATA}}{{weather.DATA}}'}
                </p>
              </IntroArtCard>
              <IntroArtArrow />
              <IntroArtCard>
                <p className="text-muted-foreground">今天上海 多云 18°C</p>
              </IntroArtCard>
            </>
          }
        />
      ) : (
        <CollectionTable
          label="推送模板"
          columns={columns}
          rows={rows ?? []}
          getRowId={(t) => t.id}
          getRowLabel={(t) => t.code}
          loading={isLoading}
          onOpen={(t) => router.push(`/dashboard/templates/${t.id}`)}
          rowActions={(t) => (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="编辑"
                title="编辑"
                render={<Link href={`/dashboard/templates/${t.id}`} />}
                nativeButton={false}
              >
                <Pencil />
              </Button>
              <ConfirmDeleteButton
                title="删除模板"
                message={`确认删除模板 "${t.code}" ？此操作不可撤销。`}
                onConfirm={() => del.mutate(t.id)}
                disabled={del.isPending}
              >
                <Trash2 className="size-4" />
              </ConfirmDeleteButton>
            </>
          )}
          empty={
            <IKEmpty
              icon={FileSearchCorner}
              title="没有匹配的模板"
              description="换个关键词试试。"
            />
          }
        />
      )}
    </>
  )
}
