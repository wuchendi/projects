'use client'

import dynamic from 'next/dynamic'

const CheckView = dynamic(
  () =>
    import('@/components/dashboard/check/check-view').then((m) => m.CheckView),
  { ssr: false },
)

export default function CheckPage() {
  return <CheckView />
}
