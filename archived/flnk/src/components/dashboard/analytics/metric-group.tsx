'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@cdlab/ui/components/tabs'
import { IKEmpty } from '@cdlab/ui/IK/IKEmpty'
import { useQuery } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { MetricRankList } from '@/components/dashboard/metric-rank-list'
import { flagEmoji, regionName } from '@/lib/geo/country'
import type { StatsParams } from '@/lib/platform/api'
import { statsApi } from '@/lib/platform/api'
import { queryKeys } from '@/lib/platform/query-keys'

function MetricList({
  type,
  params,
  onDrill,
}: {
  type: string
  params: StatsParams
  onDrill: (dim: string, value: string) => void
}) {
  const t = useTranslations('analytics')
  const locale = useLocale()
  const query = useQuery({
    queryKey: queryKeys.metrics(type, params),
    queryFn: () => statsApi.metrics(type, params),
  })
  const rows = query.data?.metrics ?? []

  if (query.isLoading) {
    return <Skeleton className="h-40 w-full" />
  }
  if (rows.length === 0) {
    return <IKEmpty className="h-40" title={t('noData')} icon={Inbox} />
  }

  return (
    <MetricRankList
      items={rows.map((r) => ({
        key: r.name || '—',
        label: type === 'country' ? regionName(r.name, locale) : r.name || '—',
        value: r.count,
        flag: type === 'country' ? flagEmoji(r.name) : undefined,
        onSelect: () => onDrill(type, r.name),
      }))}
    />
  )
}

export function MetricGroup({
  titleKey,
  dims,
  params,
  onDrill,
}: {
  titleKey: string
  dims: string[]
  params: StatsParams
  onDrill: (dim: string, value: string) => void
}) {
  const t = useTranslations('analytics')
  const [tab, setTab] = useState(dims[0]!)

  return (
    <Card className="ring-1">
      <Tabs value={tab} onValueChange={setTab}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t(`groups.${titleKey}`)}</CardTitle>
          <CardAction>
            <TabsList>
              {dims.map((dim) => (
                <TabsTrigger key={dim} value={dim}>
                  {t(`metrics.${dim}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </CardAction>
        </CardHeader>
        <CardContent>
          {dims.map((dim) => (
            <TabsContent key={dim} value={dim}>
              <MetricList type={dim} params={params} onDrill={onDrill} />
            </TabsContent>
          ))}
        </CardContent>
      </Tabs>
    </Card>
  )
}
