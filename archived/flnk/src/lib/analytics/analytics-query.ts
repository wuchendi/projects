import { getConfig } from '@/lib/platform/env'

// Logical dimension → Analytics Engine column, matching the write order in
// lib/analytics.ts (writeAccessLog). `timestamp` is AE's built-in event-time
// column; `_sample_interval` is AE's built-in sampling weight.
const FIELD = {
  slug: 'blob1',
  url: 'blob2',
  ua: 'blob3',
  ip: 'blob4',
  referer: 'blob5',
  country: 'blob6',
  region: 'blob7',
  city: 'blob8',
  timezone: 'blob9',
  language: 'blob10',
  os: 'blob11',
  browser: 'blob12',
  browserType: 'blob13',
  device: 'blob14',
  deviceType: 'blob15',
  colo: 'blob16',
  domain: 'blob17',
  source: 'blob18',
  type: 'blob19',
  owner: 'blob20',
} as const

// Entity kinds carried in blob19 (`type`). Launchpad points are excluded from
// the link-oriented queries so the two never inflate each other.
const LAUNCHPAD_TYPES = ['launchpad', 'launchpad_block'] as const

// Default range window (days) — single source of truth for both the no-range
// default and the endAt-only lower-bound floor, so neither can drift into an
// unbounded full-history scan.
const DEFAULT_LOOKBACK_DAYS = 7

export type Dimension = keyof typeof FIELD
export const METRIC_DIMENSIONS: Dimension[] = [
  'country',
  'region',
  'city',
  'referer',
  'slug',
  'language',
  'timezone',
  'device',
  'deviceType',
  'os',
  'browser',
  'browserType',
  'source',
]

// Filter dimensions a request may pin (drill-down). Subset of FIELD.
const FILTERABLE: Dimension[] = [
  'slug',
  'country',
  'region',
  'city',
  'referer',
  'device',
  'deviceType',
  'os',
  'browser',
  'browserType',
  'language',
  'timezone',
]

// Range + drill-down filters parsed from request params (parseStatsQuery).
// Carries NO owner scope — the caller must attach one to form a StatsQuery.
export interface StatsFilters {
  startAt?: number // epoch ms
  endAt?: number // epoch ms
  filters: Partial<Record<Dimension, string>>
}

// A runnable query is fail-closed by construction: it is EITHER scoped to a
// single tenant (`ownerKey` set — blob20 is filtered by the owner USER.ID for
// both link and launchpad scopes) OR explicitly opted out with
// `unscoped: true` (the rare internal/cross-tenant call). There is no third
// state, so forgetting the owner is a compile-time error, never a fail-open
// all-tenants query. ownerKey is injected by the stats/* + logs/* + launchpad
// routes from the session; never parsed from request params.
export type StatsQuery =
  | (StatsFilters & { ownerKey: string; unscoped?: never })
  | (StatsFilters & { unscoped: true; ownerKey?: never })

export class AnalyticsNotConfiguredError extends Error {
  constructor() {
    super('Analytics Engine SQL API credentials are not configured')
    this.name = 'AnalyticsNotConfiguredError'
  }
}

// Escape a value for a single-quoted Analytics Engine (ClickHouse) SQL literal.
// ClickHouse treats BOTH backslash and single-quote as escapes inside a string
// literal, so a trailing/embedded backslash can escape the closing quote and
// break out — escape the backslash first, then the quote. Control chars are
// also dropped. Filter values are second-order untrusted (analytics dimensions
// like referer/slug are visitor-controlled), so this must be backslash-safe.
export function sanitize(input: string): string {
  let out = ''
  for (const ch of input) {
    const code = ch.charCodeAt(0)
    if (code >= 32 && code !== 127) out += ch
  }
  return out.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function isConfigured(env: CloudflareEnv): boolean {
  const { cfAccountId, cfApiToken } = getConfig(env)
  return Boolean(cfAccountId && cfApiToken)
}

// `scope` selects the entity family: 'link' excludes launchpad points (so the
// short-link dashboards never count `/m/<slug>` traffic); 'launchpad' keeps
// them (the launchpad query splits views vs engagements via the `type` blob).
function whereClause(
  query: StatsQuery,
  scope: 'link' | 'launchpad' = 'link',
): string {
  const conditions: string[] = ['1=1']
  for (const dim of FILTERABLE) {
    const value = query.filters[dim]
    if (value) conditions.push(`${FIELD[dim]} = '${sanitize(value)}'`)
  }
  if (scope === 'link') {
    const list = LAUNCHPAD_TYPES.map((t) => `'${t}'`).join(', ')
    conditions.push(`${FIELD.type} NOT IN (${list})`)
  }
  // Owner tenant filter (fail-closed): a scoped query MUST carry ownerKey; the
  // only way to skip it is an explicit `unscoped: true` (internal/cross-tenant
  // calls only). The StatsQuery type makes any other state unrepresentable, so
  // reaching this without either is impossible — throw rather than silently
  // return every tenant's data. blob20 carries the owner USER.ID for both link
  // and launchpad scopes now, so the owner key is uniform across entity
  // families — no email<->id skew to reconcile.
  if (query.unscoped !== true) {
    if (query.ownerKey === undefined) {
      throw new Error('analytics query missing owner scope (fail-closed)')
    }
    conditions.push(`${FIELD.owner} = '${sanitize(query.ownerKey)}'`)
  }
  if (query.endAt) {
    conditions.push(
      `timestamp <= toDateTime(${Math.floor(query.endAt / 1000)})`,
    )
  }
  // A lower time bound is ALWAYS emitted so a request can never trigger an
  // unbounded full-history scan: the explicit startAt if given, else a
  // DEFAULT_LOOKBACK_DAYS floor anchored to endAt when only an upper bound is
  // present, else the relative last-N-days default.
  if (query.startAt) {
    conditions.push(
      `timestamp >= toDateTime(${Math.floor(query.startAt / 1000)})`,
    )
  } else if (query.endAt) {
    conditions.push(
      `timestamp >= toDateTime(${Math.floor(query.endAt / 1000) - DEFAULT_LOOKBACK_DAYS * 86400})`,
    )
  } else {
    conditions.push(
      `timestamp >= now() - INTERVAL '${DEFAULT_LOOKBACK_DAYS}' DAY`,
    )
  }
  return `WHERE ${conditions.join(' AND ')}`
}

// Sampling-weighted unique count (AE returns sampled rows; scale distinct).
const VISITORS = `ROUND(COUNT(DISTINCT ${FIELD.ip}) * SUM(_sample_interval) / COUNT())`

// Sampling-weighted unique referer count (excluding 'direct'), mirroring
// VISITORS so both distinct-count metrics are comparable sample-scaled estimates.
const REFERERS = `ROUND((COUNT(DISTINCT ${FIELD.referer}) - MAX(if(${FIELD.referer} = 'direct', 1, 0))) * SUM(_sample_interval) / COUNT())`

export async function executeAeSql<T = Record<string, string>>(
  env: CloudflareEnv,
  sql: string,
): Promise<T[]> {
  const { cfAccountId, cfApiToken } = getConfig(env)
  if (!cfAccountId || !cfApiToken) throw new AnalyticsNotConfiguredError()

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${cfApiToken}`,
        'content-type': 'application/sql',
      },
      body: sql,
    },
  )
  if (!res.ok) {
    throw new Error(`Analytics query failed: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as { data?: T[] }
  return body.data ?? []
}

export function dataset(env: CloudflareEnv): string {
  return getConfig(env).dataset
}

export function countersSql(env: CloudflareEnv, q: StatsQuery): string {
  return `SELECT
      SUM(_sample_interval) AS visits,
      ${VISITORS} AS visitors,
      ${REFERERS} AS referers
    FROM ${dataset(env)} ${whereClause(q)}`
}

export function viewsSql(
  env: CloudflareEnv,
  q: StatsQuery,
  interval: 'hour' | 'day',
): string {
  const fmt = interval === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d'
  return `SELECT
      formatDateTime(timestamp, '${fmt}') AS time,
      SUM(_sample_interval) AS visits,
      ${VISITORS} AS visitors
    FROM ${dataset(env)} ${whereClause(q)}
    GROUP BY time ORDER BY time`
}

export function metricsSql(
  env: CloudflareEnv,
  q: StatsQuery,
  type: Dimension,
  limit: number,
): string {
  const col = FIELD[type]
  return `SELECT ${col} AS name, SUM(_sample_interval) AS count
    FROM ${dataset(env)} ${whereClause(q)} AND ${col} != ''
    GROUP BY name ORDER BY count DESC LIMIT ${Math.max(1, Math.floor(limit))}`
}

// Aggregated geo points (rounded to ~0.1deg) for the world map.
// latitude/longitude are AE doubles (double1/double2), not blobs.
const LAT = 'double1'
const LNG = 'double2'
export function locationSql(
  env: CloudflareEnv,
  q: StatsQuery,
  limit: number,
): string {
  return `SELECT
      ROUND(${LAT}, 1) AS lat,
      ROUND(${LNG}, 1) AS lng,
      SUM(_sample_interval) AS count
    FROM ${dataset(env)} ${whereClause(q)}
      AND (${LAT} != 0 OR ${LNG} != 0)
    GROUP BY lat, lng ORDER BY count DESC LIMIT ${Math.max(1, Math.floor(limit))}`
}

// Recent raw events for the realtime log feed.
export function eventsSql(
  env: CloudflareEnv,
  q: StatsQuery,
  limit: number,
): string {
  return `SELECT
      ${FIELD.slug} AS slug,
      ${FIELD.country} AS country,
      ${FIELD.city} AS city,
      ${FIELD.os} AS os,
      ${FIELD.browser} AS browser,
      ${FIELD.deviceType} AS deviceType,
      timestamp
    FROM ${dataset(env)} ${whereClause(q)}
    ORDER BY timestamp DESC LIMIT ${Math.max(1, Math.floor(limit))}`
}

// Per-slug access aggregates for the CSV export.
export function accessExportSql(env: CloudflareEnv, q: StatsQuery): string {
  return `SELECT
      ${FIELD.slug} AS slug,
      ${FIELD.url} AS url,
      ${VISITORS} AS viewers,
      SUM(_sample_interval) AS views,
      ${REFERERS} AS referers
    FROM ${dataset(env)} ${whereClause(q)}
    GROUP BY slug, url ORDER BY views DESC`
}

// Per-launchpad view + engagement totals. A `launchpad` point is one
// `/m/<slug>` page load; a `launchpad_block` point is one block/button click.
// The caller pins the launchpad slug via `q.filters.slug`; the launchpad scope
// keeps both entity kinds so the two `if()` sums can split them.
export function launchpadStatsSql(env: CloudflareEnv, q: StatsQuery): string {
  return `SELECT
      SUM(if(${FIELD.type} = 'launchpad', _sample_interval, 0)) AS views,
      SUM(if(${FIELD.type} = 'launchpad_block', _sample_interval, 0)) AS engagements
    FROM ${dataset(env)} ${whereClause(q, 'launchpad')}`
}

// Launchpad page-view buckets over time for the Track tab chart. Counts only
// `launchpad` points (engagements excluded); the caller pins the slug via
// `q.filters.slug`.
export function launchpadViewsSql(
  env: CloudflareEnv,
  q: StatsQuery,
  interval: 'hour' | 'day',
): string {
  const fmt = interval === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d'
  return `SELECT
      formatDateTime(timestamp, '${fmt}') AS time,
      SUM(_sample_interval) AS views
    FROM ${dataset(env)} ${whereClause(q, 'launchpad')}
      AND ${FIELD.type} = 'launchpad'
    GROUP BY time ORDER BY time`
}

// Per-block engagement breakdown for the Track tab. A `launchpad_block` point
// carries the clicked block id in the `url` blob (blob2); group by it. The
// caller pins the launchpad slug via `q.filters.slug`.
export function launchpadBlockStatsSql(
  env: CloudflareEnv,
  q: StatsQuery,
  limit: number,
): string {
  return `SELECT ${FIELD.url} AS blockId, SUM(_sample_interval) AS count
    FROM ${dataset(env)} ${whereClause(q, 'launchpad')}
      AND ${FIELD.type} = 'launchpad_block' AND ${FIELD.url} != ''
    GROUP BY blockId ORDER BY count DESC LIMIT ${Math.max(1, Math.floor(limit))}`
}

// Parse StatsQuery (range + drill-down filters) from request search params.
export function parseStatsQuery(params: URLSearchParams): StatsFilters {
  const filters: Partial<Record<Dimension, string>> = {}
  for (const dim of FILTERABLE) {
    const v = params.get(dim)
    if (v) filters[dim] = v
  }
  const startAt = Number(params.get('startAt')) || undefined
  const endAt = Number(params.get('endAt')) || undefined
  return { startAt, endAt, filters }
}
