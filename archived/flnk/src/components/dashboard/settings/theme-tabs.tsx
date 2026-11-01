'use client'

import { Tabs, TabsList, TabsTrigger } from '@cdlab/ui/components/tabs'
import { Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeTabs() {
  const t = useTranslations('settings.appearance')
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // The theme is unknown during SSR; only bind the active tab after hydration
  // so the initial render doesn't mismatch (or highlight the wrong option).
  useEffect(() => setMounted(true), [])

  return (
    <Tabs value={mounted ? resolvedTheme : undefined} onValueChange={setTheme}>
      <TabsList>
        <TabsTrigger value="light">
          <Sun />
          {t('light')}
        </TabsTrigger>
        <TabsTrigger value="dark">
          <Moon />
          {t('dark')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
