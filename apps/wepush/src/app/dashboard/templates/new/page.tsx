'use client'

import { Button } from '@cdlab/ui/components/button'
import { IKPageHeader } from '@cdlab/ui/IK/IKPageHeader'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { TemplateFormValue } from '@/components/TemplateForm'
import { TemplateForm } from '@/components/TemplateForm'
import type { Template } from '@/database/schema'

export default function NewTemplatePage() {
  const router = useRouter()
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: async (value: TemplateFormValue): Promise<Template> => {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      })
      if (!res.ok) {
        const data = await res
          .json<{ error?: string }>()
          .catch<{ error?: string }>(() => ({}))
        throw new Error(data.error || 'Failed to create')
      }
      return res.json<Template>()
    },
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success('已创建')
      router.push(`/dashboard/templates/${t.id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <IKPageHeader
        title="新建模板"
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
        submitting={create.isPending}
        onSubmit={(value) => create.mutate(value)}
        onCancel={() => router.push('/dashboard/templates')}
      />
    </>
  )
}
