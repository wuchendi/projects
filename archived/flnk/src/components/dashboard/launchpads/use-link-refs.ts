'use client'

import { useQuery } from '@tanstack/react-query'
import { linkApi } from '@/lib/platform/api'
import { buildLinkRefs } from './blocks'

// Shared ['links-all'] query — the full link list backing the launchpad block
// pickers and preview reference resolution. Kept as a single query key so its
// cache is shared across every consumer (view + editor).
export function useAllLinks() {
  return useQuery({
    queryKey: ['links-all'],
    queryFn: () => linkApi.list({ limit: 100, offset: 0, sort: 'createdAt' }),
  })
}

// Resolved link references (slug/id → LinkRef) derived from the shared query.
export function useLinkRefs() {
  const query = useAllLinks()
  return buildLinkRefs(query.data?.links ?? [])
}
