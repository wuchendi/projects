'use client'

import { Button } from '@cdlab/ui/components/button'
import { Spinner } from '@cdlab/ui/components/spinner'
import { IKPageHeader } from '@cdlab/ui/IK/IKPageHeader'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { TemplateFormValue } from '@/components/TemplateForm'
import { TemplateForm } from '@/components/TemplateForm'
import type { Template } from '@/database/schema'

async function fetchTemplate(id: string): Promise<Template> {
  const res = await fetch(`/api/templates/${id}`)
  if (!res.ok) throw new Error('Failed to load')
  return res.json<Template>()
}

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['templates', id],
    queryFn: () => fetchTemplate(id),
    enabled: !!id,
  })

  const update = useMutation({
    mutationFn: async (value: TemplateFormValue): Promise<Template> => {
      const res = await fetch(`/api/templates/${id}`, {
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
      return res.json<Template>()
    },
    onSuccess: (fresh) => {
      qc.setQueryData(['templates', id], fresh)
      void qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success('已保存')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !data) {
    return (
      <main className="container mx-auto flex max-w-4xl items-center justify-center px-6 py-24">
        <Spinner className="size-6" />
      </main>
    )
  }

  return (
    <>
      <IKPageHeader
        title="编辑模板"
        description={data.code}
        actions={
          <>
            <Link href="/dashboard/templates">
              <Button variant="ghost" size="sm">
                返回列表
              </Button>
            </Link>
          </>
        }
      />

      <TemplateForm
        initial={data}
        submitting={update.isPending}
        onSubmit={(value) => update.mutate(value)}
        onCancel={() => router.push('/dashboard/templates')}
      />
    </>
  )
}
