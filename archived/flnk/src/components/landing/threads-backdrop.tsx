'use client'

import dynamic from 'next/dynamic'

// Threads is a WebGL (ogl) backdrop — browser-only. Load it via next/dynamic
// with ssr:false so it stays out of the server bundle and the initial client
// chunk. This wrapper is a Client Component so the landing page can remain a
// Server Component (ssr:false is not allowed in Server Components).
const Threads = dynamic(() => import('@cdlab/ui/reactbits/Threads'), {
  ssr: false,
})

interface ThreadsBackdropProps {
  color?: [number, number, number]
  amplitude?: number
  distance?: number
  enableMouseInteraction?: boolean
}

export function ThreadsBackdrop(props: ThreadsBackdropProps) {
  return <Threads {...props} />
}
