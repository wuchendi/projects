'use client'

import { Button } from '@cdlab/ui/components/button'
import { Spinner } from '@cdlab/ui/components/spinner'
import { IKPageHeader } from '@cdlab/ui/IK/IKPageHeader'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Send } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import type { PreviewResult } from '@/components/PreviewDialog'
import { PreviewDialog } from '@/components/PreviewDialog'
import type { UserFormValue } from '@/components/UserForm'
import { UserForm } from '@/components/UserForm'
import type { CustomDate, Festival, Template, User } from '@/database/schema'
import { runPushFromUi } from '@/lib/push-client'

type UserFull = User & { festivals: Festival[]; customDates: CustomDate[] }

async function fetchUser(id: string): Promise<UserFull> {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) throw new Error('Failed to load')
  return res.json<UserFull>()
}

async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch('/api/templates')
  if (!res.ok) throw new Error('Failed to load templates')
  return res.json<Template[]>()
}

export default function EditUserPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const qc = useQueryClient()

  const userQ = useQuery({
    queryKey: ['users', id],
    queryFn: () => fetchUser(id),
    enabled: !!id,
  })

  const tmplQ = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  })

  const update = useMutation({
    mutationFn: async (value: UserFormValue): Promise<UserFull> => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      })
      if (!res.ok) {
        const d = await res
          .json<{ error?: string }>()
          .catch<{ error?: string }>(() => ({}))
        throw new Error(d.error || 'Failed to save')
      }
      return res.json<UserFull>()
    },
    onSuccess: (fresh) => {
      qc.setQueryData(['users', id], fresh)
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('已保存')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const [previewOpen, setPreviewOpen] = useState(false)
  const preview = useMutation({
    mutationFn: async (): Promise<PreviewResult> => {
      const res = await fetch('/api/push/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      })
      if (!res.ok) {
        const d = await res
          .json<{ error?: string }>()
          .catch<{ error?: string }>(() => ({}))
        throw new Error(d.error || 'Failed to preview')
      }
      return res.json<PreviewResult>()
    },
  })

  const push = useMutation({
    mutationFn: () => runPushFromUi({ userIds: [id], trigger: 'manual' }),
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

  if (userQ.isLoading || tmplQ.isLoading || !userQ.data) {
    return (
      <main className="container mx-auto flex max-w-4xl items-center justify-center px-6 py-24">
        <Spinner className="size-6" />
      </main>
    )
  }

  return (
    <>
      <IKPageHeader
        title="编辑接收人"
        description={userQ.data.name || userQ.data.id}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={preview.isPending}
              onClick={() => {
                setPreviewOpen(true)
                preview.mutate()
              }}
            >
              <Eye className="mr-1 size-4" />
              预览
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={push.isPending}
              onClick={() => push.mutate()}
            >
              <Send className="mr-1 size-4" />
              {push.isPending ? '推送中...' : '立即推送'}
            </Button>
            <Link href="/dashboard/users">
              <Button variant="ghost" size="sm">
                返回列表
              </Button>
            </Link>
          </>
        }
      />

      <UserForm
        initial={userQ.data}
        templates={tmplQ.data ?? []}
        submitting={update.isPending}
        onSubmit={(v) => update.mutate(v)}
        onCancel={() => router.push('/dashboard/users')}
      />

      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        loading={preview.isPending}
        result={preview.data}
        error={preview.error?.message}
      />
    </>
  )
}
