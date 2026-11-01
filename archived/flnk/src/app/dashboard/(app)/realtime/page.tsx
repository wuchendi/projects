'use client'

import dynamic from 'next/dynamic'

const RealtimeView = dynamic(
  () =>
    import('@/components/dashboard/realtime/realtime-view').then(
      (m) => m.RealtimeView,
    ),
  { ssr: false },
)

export default function RealtimePage() {
  return <RealtimeView />
}
