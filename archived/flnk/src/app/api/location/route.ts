import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import { withSession } from '@/lib/platform/with-auth'

// Returns the caller's own geo from Cloudflare's request properties. The
// aggregated globe feed lives at `/api/logs/locations`.
export const GET = withSession(async () => {
  const { cf } = getCloudflareContext()
  return NextResponse.json({
    latitude: cf?.latitude,
    longitude: cf?.longitude,
  })
})
