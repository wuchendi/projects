'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import CountUp from '@cdlab/ui/reactbits/CountUp'
import { MousePointerClick, Share2, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Counters } from '@/lib/platform/api'

export function CountersCards({
  data,
  loading,
}: {
  data?: Counters
  loading: boolean
}) {
  const t = useTranslations('analytics.counters')
  const items = [
    { key: 'visits', value: data?.visits ?? 0, icon: MousePointerClick },
    { key: 'visitors', value: data?.visitors ?? 0, icon: Users },
    { key: 'referers', value: data?.referers ?? 0, icon: Share2 },
  ] as const

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Card className="ring-1" key={item.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(item.key)}
              </CardTitle>
              <CardAction>
                <Icon className="size-4 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {loading ? (
                  <Skeleton className="h-9 w-20" />
                ) : (
                  <CountUp to={item.value} duration={1.2} separator="," />
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
