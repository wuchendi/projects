import { NextResponse } from 'next/server'
import {
  AnalyticsNotConfiguredError,
  eventsSql,
  executeAeSql,
  parseStatsQuery,
} from '@/lib/analytics/analytics-query'
import { withSession } from '@/lib/platform/with-auth'

export const GET = withSession(
  async ({ user, request, env }) => {
    const url = new URL(request.url)
    const q = {
      ...parseStatsQuery(url.searchParams),
      ownerKey: user.id,
    }
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get('limit')) || 50),
    )
    try {
      const rows = await executeAeSql(env, eventsSql(env, q, limit))
      return NextResponse.json({
        configured: true,
        events: rows.map((r) => ({
          slug: r.slug,
          country: r.country,
          city: r.city,
          os: r.os,
          browser: r.browser,
          deviceType: r.deviceType,
          timestamp: r.timestamp,
        })),
      })
    } catch (error) {
      if (error instanceof AnalyticsNotConfiguredError) {
        return NextResponse.json({ configured: false, events: [] })
      }
      throw error
    }
  },
  { bucket: 'stats', limit: 30, windowSec: 60 },
)
