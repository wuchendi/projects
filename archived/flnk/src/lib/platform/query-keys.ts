import type { StatsParams } from '@/lib/platform/api'

// Central React Query key factory.
//
// Keys are stable, serializable arrays derived from the endpoint + window so
// the overview, analytics, and links views resolve to one shared cache entry
// when they request the same window. React Query hashes keys deterministically
// (object key order does not matter), so identical params → identical key → no
// refetch on navigation. Distinct windows/params/limits keep distinct keys, so
// queries that must return different data never collide.
export const queryKeys = {
  linkCount: () => ['link-count'] as const,
  counters: (params: StatsParams) => ['stats', 'counters', params] as const,
  views: (params: StatsParams) => ['stats', 'views', params] as const,
  metrics: (type: string, params: StatsParams, limit?: number) =>
    ['stats', 'metrics', type, params, limit ?? null] as const,
}
