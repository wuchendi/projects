'use client'

import { Skeleton } from '@cdlab/ui/components/skeleton'
import dynamic from 'next/dynamic'

// While the client chunk loads, mirror the view's header + grid so entry shows a
// skeleton instead of a blank flash. Grid shape matches the store's default view.
function LaunchpadsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 min-w-0 flex-1 md:max-w-md" />
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {['a', 'b', 'c'].map((k) => (
          <Skeleton key={k} className="h-72 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

const LaunchpadsView = dynamic(
  () =>
    import('@/components/dashboard/launchpads/launchpads-view').then(
      (m) => m.LaunchpadsView,
    ),
  { ssr: false, loading: () => <LaunchpadsSkeleton /> },
)

export default function LaunchpadsPage() {
  return <LaunchpadsView />
}
