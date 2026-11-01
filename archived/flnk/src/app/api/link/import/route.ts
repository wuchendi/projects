import { NextResponse } from 'next/server'
import { importLinks } from '@/lib/data/links'
import { checkRateLimit, clientIp } from '@/lib/platform/rate-limit'
import { withAuth } from '@/lib/platform/with-auth'
import { ImportDataSchema } from '@/schemas/link'

export const POST = withAuth(
  ImportDataSchema,
  async (data, { user, request, env }) => {
    const identity = user.id || clientIp(request)
    if (await checkRateLimit(env, 'link-import', identity, 5, 300)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    const report = await importLinks(env, data.links, user.id, user.email)
    return NextResponse.json(report)
  },
  'Invalid import data',
)
