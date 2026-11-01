import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { headers } from 'next/headers'
import { countLinks } from '@/lib/data/links'
import { getAllowedSession } from '@/lib/platform/auth'
import { queryKeys } from '@/lib/platform/query-keys'
import { DashboardOverview } from './overview'

// Warm the React Query cache for the stable-keyed "total links" counter on the
// server so the mostly-static stat card paints immediately, without the
// auth→mount→fetch waterfall. The analytics counters/views/metrics stay
// client-fetched: their keys are anchored to a client-mount `Date.now()`
// window, so a server prefetch could not hydrate-match them.
export default async function DashboardOverviewPage() {
  const queryClient = new QueryClient()

  const user = await getAllowedSession(await headers())
  if (user) {
    const { env } = getCloudflareContext()
    await queryClient.prefetchQuery({
      queryKey: queryKeys.linkCount(),
      queryFn: async () => ({ total: await countLinks(env, user.id) }),
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardOverview />
    </HydrationBoundary>
  )
}
