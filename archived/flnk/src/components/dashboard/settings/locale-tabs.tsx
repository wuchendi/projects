'use client'

import { Tabs, TabsList, TabsTrigger } from '@cdlab/ui/components/tabs'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTransition } from 'react'
import type { Locale } from '@/i18n/config'
import { localeLabels, locales } from '@/i18n/config'
import { setUserLocale } from '@/i18n/locale'

export function LocaleTabs() {
  const current = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function onSelect(locale: string) {
    startTransition(async () => {
      await setUserLocale(locale as Locale)
      router.refresh()
    })
  }

  return (
    <Tabs value={current} onValueChange={onSelect}>
      <TabsList>
        {locales.map((locale) => (
          <TabsTrigger key={locale} value={locale} disabled={isPending}>
            {localeLabels[locale]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
