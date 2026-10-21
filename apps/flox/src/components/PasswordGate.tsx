'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Field, FieldDescription, FieldGroup } from '@cdlab/ui/components/field'
import { PasswordInput } from '@cdlab/ui/components/password-input'
import { Spinner } from '@cdlab/ui/components/spinner'
import { hashPasswordFn } from '@cdlab/utils'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import * as z from 'zod'
import { useSubscriptionSync } from '@/lib/hooks/useSubscriptionSync'
import { useSettingsStore } from '@/lib/store/settings-store'
import { useUnlockStore } from '@/lib/store/unlock-store'

const passwordSchema = z.object({
  password: z.string().min(1, '请输入密码'),
})

type PasswordForm = z.infer<typeof passwordSchema>

type UnlockResult = { valid: true; token: string } | { valid: false }

interface AppConfig {
  hasEnvPassword: boolean
  persistPassword: boolean
  subscriptionSources?: string[]
}

async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-6" />
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    </div>
  )
}

export function PasswordGate({
  children,
  hasEnvPassword: initialHasEnvPassword,
}: {
  children: React.ReactNode
  hasEnvPassword: boolean
}) {
  useSubscriptionSync()

  const isUnlocked = useUnlockStore((s) => s.isUnlocked)
  const hasHydrated = useUnlockStore((s) => s._hasHydrated)
  const envToken = useUnlockStore((s) => s.envToken)
  const doUnlock = useUnlockStore((s) => s.unlock)
  const setEnvToken = useUnlockStore((s) => s.setEnvToken)
  const clearEnvToken = useUnlockStore((s) => s.clearEnvToken)

  const cardRef = useRef<HTMLDivElement>(null)
  const [isEnvVerifying, setIsEnvVerifying] = useState(false)

  const { data: config, isLoading } = useQuery({
    queryKey: ['app-config'],
    queryFn: async () => {
      const data = await fetchConfig()
      if (data.subscriptionSources) {
        useSettingsStore
          .getState()
          .syncEnvSubscriptions(JSON.stringify(data.subscriptionSources))
      }
      return data
    },
    initialData: {
      hasEnvPassword: initialHasEnvPassword,
      persistPassword: false,
    } satisfies AppConfig,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!hasHydrated) return
    if (!config?.hasEnvPassword || !envToken) return

    setIsEnvVerifying(true)
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash: envToken }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) doUnlock()
        else clearEnvToken()
      })
      .catch(() => clearEnvToken())
      .finally(() => setIsEnvVerifying(false))
  }, [hasHydrated, config?.hasEnvPassword, clearEnvToken, doUnlock, envToken])

  const { mutateAsync: unlock, isPending } = useMutation({
    mutationFn: async (pwd: string): Promise<UnlockResult> => {
      if (!config?.hasEnvPassword) return { valid: false }
      const envHash = await hashPasswordFn(pwd)
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: envHash }),
      })
      const data = await res.json()
      return data.valid ? { valid: true, token: envHash } : { valid: false }
    },
    onSuccess: (result) => {
      if (!result.valid) return
      setEnvToken(result.token)
      doUnlock()
    },
  })

  const form = useForm({
    defaultValues: { password: '' } satisfies PasswordForm,
    validators: {
      onSubmit: passwordSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      const result = await unlock(value.password)
      if (!result.valid) {
        formApi.setFieldMeta('password', (prev) => ({
          ...prev,
          errors: ['密码错误'],
          errorMap: { onSubmit: '密码错误' },
        }))
        cardRef.current?.classList.add('animate-shake')
        cardRef.current?.addEventListener(
          'animationend',
          () => cardRef.current?.classList.remove('animate-shake'),
          { once: true },
        )
      }
    },
  })

  const isProtected = config?.hasEnvPassword ?? initialHasEnvPassword

  if (!hasHydrated || isEnvVerifying || (isLoading && !initialHasEnvPassword)) {
    return <LoadingScreen />
  }

  if (!isProtected || isUnlocked) return <>{children}</>

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center">
      <Card ref={cardRef} className="w-full max-w-md">
        <CardHeader>
          <CardTitle>访问受限</CardTitle>
          <CardDescription>请输入访问密码以继续</CardDescription>
        </CardHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field name="password">
              {(field) => (
                <>
                  <CardContent>
                    <Field>
                      <PasswordInput
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="输入密码..."
                        autoFocus
                        aria-invalid={field.state.meta.errors.length > 0}
                        aria-describedby={
                          field.state.meta.errors.length > 0
                            ? 'pwd-gate-error'
                            : undefined
                        }
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldDescription
                          id="pwd-gate-error"
                          className="text-destructive"
                        >
                          {typeof field.state.meta.errors[0] === 'string'
                            ? field.state.meta.errors[0]
                            : field.state.meta.errors[0]?.message}
                        </FieldDescription>
                      )}
                    </Field>
                  </CardContent>

                  <CardFooter>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={
                        !field.state.value ||
                        isPending ||
                        form.state.isSubmitting
                      }
                    >
                      {isPending || form.state.isSubmitting
                        ? '验证中...'
                        : '解锁访问'}
                    </Button>
                  </CardFooter>
                </>
              )}
            </form.Field>
          </FieldGroup>
        </form>
      </Card>
    </div>
  )
}
