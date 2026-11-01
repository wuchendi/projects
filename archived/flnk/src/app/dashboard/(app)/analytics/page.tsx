'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const AnalyticsView = dynamic(
  () =>
    import('@/components/dashboard/analytics/analytics-view').then(
      (m) => m.AnalyticsView,
    ),
  { ssr: false },
)

export default function AnalyticsPage() {
  // AnalyticsView reads `?slug=` via useSearchParams — keep the Suspense
  // boundary so the client transition never warns.
  return (
    <Suspense>
      <AnalyticsView />
    </Suspense>
  )
}
