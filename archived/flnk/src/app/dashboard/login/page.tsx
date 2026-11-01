'use client'

import { Button } from '@cdlab/ui/components/button'
import { Field, FieldDescription, FieldGroup } from '@cdlab/ui/components/field'
import { GitHubIcon } from '@cdlab/ui/icon/GitHubIcon'
import { GoogleIcon } from '@cdlab/ui/icon/GoogleIcon'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { FlnkLogo, LocaleSwitcher, ThemeToggle } from '@/components/layout'
import { authClient } from '@/lib/platform/auth-client'

export default function LoginPage() {
  const t = useTranslations('login')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'google' | 'github' | null>(null)

  async function signIn(provider: 'google' | 'github') {
    setError(null)
    setPending(provider)
    try {
      await authClient.signIn.social({ provider, callbackURL: '/dashboard' })
    } catch {
      setError(t('error'))
      setPending(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 md:p-10">
      <div className="fixed top-4 right-4 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-4">
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <FlnkLogo className="size-8" />
            <h1 className="text-xl font-bold">{t('welcome')}</h1>
            <FieldDescription>{t('description')}</FieldDescription>
          </div>
          <Field className="grid gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => void signIn('google')}
              disabled={pending !== null}
            >
              <GoogleIcon />
              {pending === 'google'
                ? t('redirecting')
                : t('continueWithGoogle')}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void signIn('github')}
              disabled={pending !== null}
            >
              <GitHubIcon />
              {pending === 'github'
                ? t('redirecting')
                : t('continueWithGitHub')}
            </Button>
          </Field>
          {error && (
            <FieldDescription className="text-center text-destructive">
              {error}
            </FieldDescription>
          )}
        </FieldGroup>
        <FieldDescription className="px-6 text-center">
          {t.rich('agreement', {
            terms: (chunks) => (
              <Link
                href="/dashboard/terms"
                className="underline underline-offset-4 hover:text-foreground"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href="/dashboard/privacy"
                className="underline underline-offset-4 hover:text-foreground"
              >
                {chunks}
              </Link>
            ),
          })}
        </FieldDescription>
      </div>
    </div>
  )
}
