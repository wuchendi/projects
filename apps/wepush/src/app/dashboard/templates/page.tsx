'use client'

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
import { IKEmpty } from '@cdlab/ui/IK'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileSearchCorner, Pencil, Plus, RotateCw, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { SubHeader } from '@/components/layout'
import { fetchTemplates } from '@/lib/queries'

export default function TemplatesPage() {
  const qc = useQueryClient()
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

  return (
    <>
      <SubHeader
        title="推送模板"
        description="支持 {{variable.DATA}} 模板变量，每位用户通过 code 关联模板。"
      >
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
          <Link href="/dashboard/templates/new">
            <Button size="sm">
              <Plus className="size-4" />
              新建模板
            </Button>
          </Link>
        </>
      </SubHeader>

      {isLoading ? (
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-7 w-7" />
                  <Skeleton className="h-7 w-7" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !data || data.length === 0 ? (
        <IKEmpty
          icon={FileSearchCorner}
          className="border border-dashed"
          title="还没有模板"
          description="每位用户通过 code 关联模板，支持 {{variable.DATA}} 模板变量。"
        >
          <Link href="/dashboard/templates/new" className="mt-4 inline-block">
            <Button size="sm">
              <Plus className="mr-1 size-4" />
              新建第一个模板
            </Button>
          </Link>
        </IKEmpty>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>内容预览</TableHead>
                <TableHead className="w-32 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono">{t.code}</TableCell>
                  <TableCell>{t.title || '—'}</TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">
                    {t.desc || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Link href={`/dashboard/templates/${t.id}`}>
                        <Button variant="ghost" size="icon" aria-label="编辑">
                          <Pencil className="size-4" />
                        </Button>
                      </Link>
                      <ConfirmDeleteButton
                        title="删除模板"
                        message={`确认删除模板 "${t.code}" ？此操作不可撤销。`}
                        onConfirm={() => del.mutate(t.id)}
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
    </>
  )
}
