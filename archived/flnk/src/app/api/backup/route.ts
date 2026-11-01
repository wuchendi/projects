import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import { backupToR2 } from '@/lib/data/backup'
import { requireSession } from '@/lib/platform/auth'
import { checkRateLimit, clientIp } from '@/lib/platform/rate-limit'

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const { env } = getCloudflareContext()
  const identity = auth.user.id || clientIp(request)
  if (await checkRateLimit(env, 'backup', identity, 5, 300)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  const key = await backupToR2(env, auth.user.id)
  if (!key) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 503 })
  }
  return NextResponse.json({ ok: true, key })
}
