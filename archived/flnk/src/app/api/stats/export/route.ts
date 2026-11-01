import { NextResponse } from 'next/server'
import {
  AnalyticsNotConfiguredError,
  accessExportSql,
  executeAeSql,
  parseStatsQuery,
} from '@/lib/analytics/analytics-query'
import { generateCsv } from '@/lib/format/csv'
import { withSession } from '@/lib/platform/with-auth'

export const GET = withSession(
  async ({ user, request, env }) => {
    const q = {
      ...parseStatsQuery(new URL(request.url).searchParams),
      ownerKey: user.id,
    }

    let rows: Record<string, string>[] = []
    try {
      rows = await executeAeSql(env, accessExportSql(env, q))
    } catch (error) {
      if (!(error instanceof AnalyticsNotConfiguredError)) throw error
    }

    const csv = generateCsv(
      ['slug', 'url', 'viewers', 'views', 'referers'],
      rows.map((r) => [r.slug, r.url, r.viewers, r.views, r.referers]),
    )

    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="flnk-access-${Date.now()}.csv"`,
        'cache-control': 'no-store',
      },
    })
  },
  { bucket: 'stats', limit: 30, windowSec: 60 },
)
