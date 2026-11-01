import { NextResponse } from 'next/server'
import type { Dimension } from '@/lib/analytics/analytics-query'
import {
  AnalyticsNotConfiguredError,
  executeAeSql,
  METRIC_DIMENSIONS,
  metricsSql,
  parseStatsQuery,
} from '@/lib/analytics/analytics-query'
import { withSession } from '@/lib/platform/with-auth'

export const GET = withSession(
  async ({ user, request, env }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') as Dimension | null
    if (!type || !METRIC_DIMENSIONS.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid metric type' },
        { status: 400 },
      )
    }

    const q = {
      ...parseStatsQuery(url.searchParams),
      ownerKey: user.id,
    }
    const limit = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get('limit')) || 20),
    )

    try {
      const rows = await executeAeSql(env, metricsSql(env, q, type, limit))
      return NextResponse.json({
        configured: true,
        metrics: rows.map((r) => ({
          name: r.name,
          count: Number(r.count) || 0,
        })),
      })
    } catch (error) {
      if (error instanceof AnalyticsNotConfiguredError) {
        return NextResponse.json({ configured: false, metrics: [] })
      }
      throw error
    }
  },
  { bucket: 'stats', limit: 30, windowSec: 60 },
)
