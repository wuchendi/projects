import { NextResponse } from 'next/server'
import {
  AnalyticsNotConfiguredError,
  executeAeSql,
  parseStatsQuery,
  viewsSql,
} from '@/lib/analytics/analytics-query'
import { withSession } from '@/lib/platform/with-auth'

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

export const GET = withSession(
  async ({ user, request, env }) => {
    const q = {
      ...parseStatsQuery(new URL(request.url).searchParams),
      ownerKey: user.id,
    }
    // Short ranges bucket by hour, longer ones by day.
    const span =
      q.startAt && q.endAt ? q.endAt - q.startAt : Number.POSITIVE_INFINITY
    const interval = span <= TWO_DAYS_MS ? 'hour' : 'day'

    try {
      const rows = await executeAeSql(env, viewsSql(env, q, interval))
      return NextResponse.json({
        configured: true,
        interval,
        views: rows.map((r) => ({
          time: r.time,
          visits: Number(r.visits) || 0,
          visitors: Number(r.visitors) || 0,
        })),
      })
    } catch (error) {
      if (error instanceof AnalyticsNotConfiguredError) {
        return NextResponse.json({ configured: false, interval, views: [] })
      }
      throw error
    }
  },
  { bucket: 'stats', limit: 30, windowSec: 60 },
)
