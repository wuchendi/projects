import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import {
  AnalyticsNotConfiguredError,
  dataset,
  executeAeSql,
  isConfigured,
  sanitize,
} from '@/lib/analytics/analytics-query'
import { getLaunchpadById } from '@/lib/data/launchpads'
import { requireSession } from '@/lib/platform/auth'

interface BatchBody {
  ids?: unknown
  startAt?: unknown
  endAt?: unknown
}

// AE column mapping mirrors FIELD in analytics-query.ts (not exported): blob1 =
// slug, blob19 = entity type, blob20 = owner tenant key.
const SLUG = 'blob1'
const TYPE = 'blob19'
const OWNER = 'blob20'

// Batched launchpad view + engagement totals for the dashboard list — one
// request per page instead of one per card (kills the N+1 AE fan-out).
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as BatchBody
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === 'string')
    : []
  const startAt = Number(body.startAt) || undefined
  const endAt = Number(body.endAt) || undefined

  const { env } = getCloudflareContext()

  // Resolve the requested ids to the caller's own launchpads (owner-scoped —
  // cross-owner ids resolve to null and are dropped, never leaked). slug → id
  // lets us key the grouped AE result back to the requested ids.
  const owned = (
    await Promise.all(ids.map((id) => getLaunchpadById(env, id, auth.user.id)))
  ).filter((l): l is NonNullable<typeof l> => l !== null)

  const slugToId = new Map(owned.map((l) => [l.slug, l.id]))
  const stats: Record<string, { views: number; engagements: number }> = {}

  if (slugToId.size === 0) {
    return NextResponse.json({ configured: isConfigured(env), stats })
  }

  try {
    const rows = await executeAeSql<{
      slug: string
      views: string
      engagements: string
    }>(
      env,
      batchStatsSql(env, [...slugToId.keys()], auth.user.id, startAt, endAt),
    )
    for (const r of rows) {
      const id = slugToId.get(r.slug)
      if (!id) continue
      // Owned launchpads with no traffic are simply absent from the AE result;
      // the client defaults those to 0.
      stats[id] = {
        views: Number(r.views) || 0,
        engagements: Number(r.engagements) || 0,
      }
    }
    return NextResponse.json({ configured: true, stats })
  } catch (error) {
    if (error instanceof AnalyticsNotConfiguredError) {
      return NextResponse.json({ configured: false, stats: {} })
    }
    throw error
  }
}

// One grouped AE query for every requested slug: split views vs engagements via
// the entity-type blob, owner-scoped and windowed like launchpadStatsSql. Built
// here (not in analytics-query.ts) because that module is out of scope.
function batchStatsSql(
  env: CloudflareEnv,
  slugs: string[],
  ownerKey: string,
  startAt?: number,
  endAt?: number,
): string {
  const inList = slugs.map((s) => `'${sanitize(s)}'`).join(', ')
  const conditions = [
    `${OWNER} = '${sanitize(ownerKey)}'`,
    `${SLUG} IN (${inList})`,
  ]
  if (startAt) {
    conditions.push(`timestamp >= toDateTime(${Math.floor(startAt / 1000)})`)
  }
  if (endAt) {
    conditions.push(`timestamp <= toDateTime(${Math.floor(endAt / 1000)})`)
  }
  if (!startAt && !endAt) {
    conditions.push(`timestamp >= now() - INTERVAL '7' DAY`)
  }
  return `SELECT ${SLUG} AS slug,
      SUM(if(${TYPE} = 'launchpad', _sample_interval, 0)) AS views,
      SUM(if(${TYPE} = 'launchpad_block', _sample_interval, 0)) AS engagements
    FROM ${dataset(env)}
    WHERE ${conditions.join(' AND ')}
    GROUP BY slug`
}
