import type {
  LaunchpadConfig,
  LaunchpadOg,
  LaunchpadStatus,
  LinkConfig,
} from '@/database/schema'
import type { SortKey } from '@/lib/format/types'
import type {
  CreateLaunchpadInput,
  EditLaunchpadInput,
} from '@/schemas/launchpad'
import type { CreateLinkInput, EditLinkInput } from '@/schemas/link'

// Client-facing link shape — dates are JSON strings over the wire.
export interface LinkRow {
  id: string
  slug: string
  domain: string
  url: string
  title: string
  comment: string
  createdBy: string
  tags: string[]
  config: LinkConfig
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  isDeleted: number
}

export type LinkStatusFilter = 'all' | 'active' | 'disabled' | 'expired'
export type TagMatch = 'and' | 'or'

export interface ListParams {
  limit: number
  offset: number
  sort: SortKey
  status?: LinkStatusFilter
  createdBy?: string
  startAt?: number | null
  endAt?: number | null
  tags?: string[]
  tagMatch?: TagMatch
  untagged?: boolean
}

export class ApiClientError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

// Turn a failed response into an ApiClientError: read the best-effort JSON body
// (`{ error?: string }`), falling back to the status text.
async function parseError(res: Response): Promise<ApiClientError> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return new ApiClientError(body.error || res.statusText, res.status)
}

// Auth is a better-auth session cookie, sent automatically on same-origin
// fetches — no Authorization header to attach.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<T>
}

export type { SortKey }

export const linkApi = {
  list: (params: ListParams) => {
    const sp = new URLSearchParams({
      limit: String(params.limit),
      offset: String(params.offset),
      sort: params.sort,
    })
    if (params.status && params.status !== 'all')
      sp.set('status', params.status)
    if (params.createdBy) sp.set('createdBy', params.createdBy)
    if (params.startAt) sp.set('startAt', String(params.startAt))
    if (params.endAt) sp.set('endAt', String(params.endAt))
    if (params.untagged) {
      sp.set('untagged', '1')
    } else if (params.tags?.length) {
      for (const tag of params.tags) sp.append('tag', tag)
      if (params.tagMatch) sp.set('tagMatch', params.tagMatch)
    }
    return request<{ links: LinkRow[]; total: number }>(
      `/api/link/list?${sp.toString()}`,
    )
  },
  count: () => request<{ total: number }>('/api/link/count'),
  creators: () => request<{ creators: string[] }>('/api/link/creators'),
  tags: () =>
    request<{ tags: { tag: string; count: number }[] }>('/api/link/tags'),
  tagBulk: (ids: string[], tag: string, op: 'add' | 'remove') =>
    request<{ updated: number }>('/api/link/tag-bulk', {
      method: 'POST',
      body: JSON.stringify({ ids, tag, op }),
    }),
  tagSet: (id: string, tags: string[]) =>
    request<{ ok: true }>('/api/link/tag-set', {
      method: 'POST',
      body: JSON.stringify({ id, tags }),
    }),
  search: (q: string) =>
    request<{ links: LinkRow[] }>(
      `/api/link/search?q=${encodeURIComponent(q)}`,
    ),
  get: (id: string) =>
    request<{ link: LinkRow }>(`/api/link/query?id=${encodeURIComponent(id)}`),
  create: (input: CreateLinkInput) =>
    request<{ link: LinkRow }>('/api/link/create', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  edit: (input: EditLinkInput) =>
    request<{ link: LinkRow }>('/api/link/edit', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<{ ok: true }>('/api/link/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  aiSlug: (url: string) =>
    request<{ slug: string; method: string }>(
      `/api/link/ai?url=${encodeURIComponent(url)}`,
    ),
  aiOg: (url: string, locale?: string) =>
    request<{ title: string; description: string; method: string }>(
      `/api/link/og-ai?url=${encodeURIComponent(url)}${
        locale ? `&locale=${encodeURIComponent(locale)}` : ''
      }`,
    ),
}

// Client-facing launchpad shape — dates are JSON strings over the wire.
export interface LaunchpadRow {
  id: string
  slug: string
  ownerId: string
  title: string
  status: LaunchpadStatus
  config: LaunchpadConfig
  og: LaunchpadOg
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  isDeleted: number
}

export interface LaunchpadStats {
  configured: boolean
  views: number
  engagements: number
  blocks: { blockId: string; count: number }[]
  series: { time: string; views: number }[]
}

// Batched per-launchpad totals keyed by id — ids the caller doesn't own are
// simply omitted (default to 0 on the client).
export interface LaunchpadStatsBatch {
  configured: boolean
  stats: Record<string, { views: number; engagements: number }>
}

export const launchpadApi = {
  list: (params: { limit: number; offset: number; sort: SortKey }) => {
    const sp = new URLSearchParams({
      limit: String(params.limit),
      offset: String(params.offset),
      sort: params.sort,
    })
    return request<{ launchpads: LaunchpadRow[]; total: number }>(
      `/api/launchpad/list?${sp.toString()}`,
    )
  },
  get: (id: string) =>
    request<{ launchpad: LaunchpadRow }>(
      `/api/launchpad/query?id=${encodeURIComponent(id)}`,
    ),
  create: (input: CreateLaunchpadInput) =>
    request<{ launchpad: LaunchpadRow }>('/api/launchpad/create', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  edit: (input: EditLaunchpadInput) =>
    request<{ launchpad: LaunchpadRow }>('/api/launchpad/edit', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<{ ok: true }>('/api/launchpad/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  publish: (id: string, status: LaunchpadStatus) =>
    request<{ launchpad: LaunchpadRow }>('/api/launchpad/publish', {
      method: 'POST',
      body: JSON.stringify({ id, status }),
    }),
  stats: (id: string, startAt: number, endAt?: number) =>
    request<LaunchpadStats>(
      `/api/launchpad/stats?id=${encodeURIComponent(id)}&startAt=${startAt}${
        endAt ? `&endAt=${endAt}` : ''
      }`,
    ),
  statsBatch: (ids: string[], startAt: number, endAt?: number) =>
    request<LaunchpadStatsBatch>('/api/launchpad/stats-batch', {
      method: 'POST',
      body: JSON.stringify({ ids, startAt, endAt }),
    }),
}

export interface StatsParams {
  startAt?: number
  endAt?: number
  filters?: Record<string, string>
}

export interface Counters {
  configured: boolean
  visits: number
  visitors: number
  referers: number
}
export interface ViewPoint {
  time: string
  visits: number
  visitors: number
}
export interface MetricItem {
  name: string
  count: number
}
export interface GeoPoint {
  lat: number
  lng: number
  count: number
}
export interface LogEvent {
  slug: string
  country: string
  city: string
  os: string
  browser: string
  deviceType: string
  timestamp: string
}

function statsQuery(params: StatsParams): string {
  const sp = new URLSearchParams()
  if (params.startAt) sp.set('startAt', String(params.startAt))
  if (params.endAt) sp.set('endAt', String(params.endAt))
  for (const [k, v] of Object.entries(params.filters ?? {})) {
    if (v) sp.set(k, v)
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const statsApi = {
  counters: (params: StatsParams) =>
    request<Counters>(`/api/stats/counters${statsQuery(params)}`),
  views: (params: StatsParams) =>
    request<{ configured: boolean; interval: string; views: ViewPoint[] }>(
      `/api/stats/views${statsQuery(params)}`,
    ),
  metrics: (type: string, params: StatsParams, limit?: number) => {
    const q = statsQuery(params)
    const sep = q ? '&' : '?'
    const limitQs = limit ? `&limit=${limit}` : ''
    return request<{ configured: boolean; metrics: MetricItem[] }>(
      `/api/stats/metrics${q}${sep}type=${type}${limitQs}`,
    )
  },
  location: (params: StatsParams) =>
    request<{ configured: boolean; points: GeoPoint[] }>(
      `/api/logs/locations${statsQuery(params)}`,
    ),
  events: (params: StatsParams) =>
    request<{ configured: boolean; events: LogEvent[] }>(
      `/api/logs/events${statsQuery(params)}`,
    ),
}

export interface CheckResult {
  id: string
  slug: string
  url: string
  status: number | null
  ok: boolean
  duration: number
  error?: string
  unsafe: boolean | null
}

export const checkApi = {
  // Check one batch of links by id, with an optional per-link timeout (seconds).
  run: (ids: string[], timeout?: number) =>
    request<{ results: CheckResult[] }>('/api/link/check', {
      method: 'POST',
      body: JSON.stringify({ ids, timeout }),
    }),
}

export interface ImportReport {
  success: number
  skipped: number
  failed: number
  failedItems: { slug: string; reason: string }[]
}

// Authed download → trigger a browser file save. Uses fetch (not a plain
// <a href>) so the session cookie + error handling apply consistently.
async function downloadAuthed(path: string, filename: string): Promise<void> {
  const res = await fetch(path)
  if (!res.ok) throw await parseError(res)
  const href = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export const migrateApi = {
  exportLinks: () =>
    downloadAuthed('/api/link/export', `flnk-links-${Date.now()}.json`),
  exportCsv: () =>
    downloadAuthed('/api/stats/export', `flnk-access-${Date.now()}.csv`),
  importLinks: (data: unknown) =>
    request<ImportReport>('/api/link/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  backup: () =>
    request<{ ok: true; key: string }>('/api/backup', { method: 'POST' }),
}

export const configApi = {
  get: () => request<{ r2: boolean; analytics: boolean }>('/api/config'),
}

export const uploadApi = {
  image: async (file: File, slug: string): Promise<{ url: string }> => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('slug', slug)
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) throw await parseError(res)
    return res.json() as Promise<{ url: string }>
  },
}
