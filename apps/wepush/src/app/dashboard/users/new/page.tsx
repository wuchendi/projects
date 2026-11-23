'use client'

import { Button } from '@cdlab/ui/components/button'
import { Spinner } from '@cdlab/ui/components/spinner'
import { IKPageHeader } from '@cdlab/ui/IK/IKPageHeader'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { UserFormValue } from '@/components/UserForm'
import { UserForm } from '@/components/UserForm'
import type { Template } from '@/database/schema'

async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch('/api/templates')
  if (!res.ok) throw new Error('Failed to load templates')
  return res.json<Template[]>()
}

export default function NewUserPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  })

  const create = useMutation({
    mutationFn: async (value: UserFormValue): Promise<{ id: string }> => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      })
      if (!res.ok) {
        const d = await res
          .json<{ error?: string }>()
          .catch<{ error?: string }>(() => ({}))
        throw new Error(d.error || 'Failed to create')
      }
      return res.json<{ id: string }>()
    },
    onSuccess: ({ id }) => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('已创建')
      router.push(`/dashboard/users/${id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <main className="container mx-auto flex max-w-4xl items-center justify-center px-6 py-24">
        <Spinner className="size-6" />
      </main>
    )
  }

  return (
    <>
      <IKPageHeader
        title="新建接收人"
        actions={
          <>
            <Link href="/dashboard/users">
              <Button variant="ghost" size="sm">
                返回列表
              </Button>
            </Link>
          </>
        }
      />

      <UserForm
        templates={templates ?? []}
        submitting={create.isPending}
        onSubmit={(v) => create.mutate(v)}
        onCancel={() => router.push('/dashboard/users')}
      />
    </>
  )
}
