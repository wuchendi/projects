'use client'

import { useEffect } from 'react'

// Delegated click beacon for the public launchpad page. Listens for clicks on
// any element carrying `data-block-id` (rendered by `LaunchpadView`) and fires a
// non-blocking engagement beacon — navigation (for link/button blocks) proceeds
// uninterrupted. Short-link blocks therefore record BOTH a launchpad engagement
// here AND the short-link click on `/<slug>`; that double count is intentional
// reconciliation, not inflation (see PLAN-010).
export function LaunchpadTracker({ slug }: { slug: string }) {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null
      const el = target?.closest('[data-block-id]')
      if (!el) return
      const blockId = el.getAttribute('data-block-id')
      if (!blockId) return

      const body = JSON.stringify({ slug, blockId })
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/launchpad/track',
          new Blob([body], { type: 'application/json' }),
        )
      } else {
        void fetch('/api/launchpad/track', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {})
      }
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [slug])

  return null
}
