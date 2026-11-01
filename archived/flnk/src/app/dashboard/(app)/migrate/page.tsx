'use client'

import dynamic from 'next/dynamic'

const MigrateView = dynamic(
  () =>
    import('@/components/dashboard/migrate/migrate-view').then(
      (m) => m.MigrateView,
    ),
  { ssr: false },
)

export default function MigratePage() {
  return <MigrateView />
}
