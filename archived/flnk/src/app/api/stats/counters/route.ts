import { NextResponse } from 'next/server'
import {
  AnalyticsNotConfiguredError,
  countersSql,
  executeAeSql,
  parseStatsQuery,
} from '@/lib/analytics/analytics-query'
import { withSession } from '@/lib/platform/with-auth'

export const GET = withSession(
  async ({ user, request, env }) => {
    const q = {
      ...parseStatsQuery(new URL(request.url).searchParams),
      ownerKey: user.id,
    }
    try {
      const rows = await executeAeSql(env, countersSql(env, q))
      const r = rows[0] ?? {}
      return NextResponse.json({
        configured: true,
        visits: Number(r.visits) || 0,
        visitors: Number(r.visitors) || 0,
        referers: Number(r.referers) || 0,
      })
    } catch (error) {
      if (error instanceof AnalyticsNotConfiguredError) {
        return NextResponse.json({
          configured: false,
          visits: 0,
          visitors: 0,
          referers: 0,
        })
      }
      throw error
    }
  },
  { bucket: 'stats', limit: 30, windowSec: 60 },
)
