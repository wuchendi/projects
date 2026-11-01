'use client'

import dynamic from 'next/dynamic'

// The dashboard is auth-gated and fetches its data client-side (react-query), so
// SSR adds no value — lazy-load ssr:false to keep this view out of the Worker's
// server bundle (Cloudflare 3 MiB limit).
const LinksView = dynamic(
  () =>
    import('@/components/dashboard/links/links-view').then((m) => m.LinksView),
  { ssr: false },
)

export default function LinksPage() {
  return <LinksView />
}
