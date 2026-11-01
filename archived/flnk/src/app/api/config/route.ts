import { NextResponse } from 'next/server'
import { isConfigured } from '@/lib/analytics/analytics-query'
import { isR2Enabled } from '@/lib/data/r2'
import { withSession } from '@/lib/platform/with-auth'

// Feature-availability flags for the dashboard (so it can show/hide R2-gated
// affordances like the OG image uploader).
export const GET = withSession(async ({ env }) => {
  return NextResponse.json({
    r2: isR2Enabled(env),
    analytics: isConfigured(env),
  })
})
