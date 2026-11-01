'use client'

import { NotFoundState } from '@cdlab/ui/components/not-found-state'
import { useRouter } from 'next/navigation'

export default function NotFound() {
  const router = useRouter()

  return (
    <NotFoundState
      onBack={() => router.back()}
      onHome={() => router.push('/')}
    />
  )
}
