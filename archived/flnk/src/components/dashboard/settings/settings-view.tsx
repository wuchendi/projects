'use client'

import { Badge } from '@cdlab/ui/components/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { LocaleTabs } from '@/components/dashboard/settings/locale-tabs'
import { ThemeTabs } from '@/components/dashboard/settings/theme-tabs'
import { configApi } from '@/lib/platform/api'

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  const t = useTranslations('settings.system')
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span>{label}</span>
      <Badge variant={ok ? 'default' : 'secondary'}>
        {ok ? t('enabled') : t('disabled')}
      </Badge>
    </div>
  )
}

export function SettingsView() {
  const t = useTranslations('settings')
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.get(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card className="ring-1">
        <CardHeader>
          <CardTitle className="text-base">{t('appearance.title')}</CardTitle>
          <CardDescription>{t('appearance.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeTabs />
        </CardContent>
      </Card>

      <Card className="ring-1">
        <CardHeader>
          <CardTitle className="text-base">{t('language.title')}</CardTitle>
          <CardDescription>{t('language.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LocaleTabs />
        </CardContent>
      </Card>

      <Card className="ring-1">
        <CardHeader>
          <CardTitle className="text-base">{t('system.title')}</CardTitle>
          <CardDescription>{t('system.description')}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <StatusRow label={t('system.r2')} ok={config?.r2 ?? false} />
          <StatusRow
            label={t('system.analytics')}
            ok={config?.analytics ?? false}
          />
        </CardContent>
      </Card>
    </div>
  )
}
