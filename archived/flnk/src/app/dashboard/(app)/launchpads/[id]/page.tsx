'use client'

import dynamic from 'next/dynamic'
import { use } from 'react'
import { LaunchpadEditorSkeleton } from '@/components/dashboard/launchpads/launchpad-editor-skeleton'

const LaunchpadEditor = dynamic(
  () =>
    import('@/components/dashboard/launchpads/launchpad-editor').then(
      (m) => m.LaunchpadEditor,
    ),
  {
    ssr: false,
    // Mirror the editor's own `existing.isLoading` skeleton so the chunk-load →
    // data-load handoff is seamless (no blank flash on entry).
    loading: () => <LaunchpadEditorSkeleton />,
  },
)

type PageProps = { params: Promise<{ id: string }> }

export default function LaunchpadEditorPage({ params }: PageProps) {
  const { id } = use(params)
  return <LaunchpadEditor id={id} />
}
