import { NextResponse } from 'next/server'
import * as z from 'zod'
import { MAX_LINKS, runHealthCheck } from '@/lib/ai/health-check'
import { getLinkRowsByIds } from '@/lib/data/links'
import { checkRateLimit, clientIp } from '@/lib/platform/rate-limit'
import { withAuth } from '@/lib/platform/with-auth'

// One batch of links to check, with a per-link timeout. The client drives
// batching (so it can show progress and stop), so each request carries an
// explicit, bounded set of ids.
const BodySchema = z.object({
  ids: z.array(z.string()).min(1).max(MAX_LINKS),
  timeout: z.coerce.number().int().min(1).max(30).optional(),
})

export const POST = withAuth(
  BodySchema,
  async (data, { user, request, env }) => {
    const identity = user.id || clientIp(request)
    if (await checkRateLimit(env, 'linkcheck', identity, 10, 60)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    const { ids, timeout } = data

    // Re-resolve the ids to their stored links server-side — never trust a
    // client-supplied destination URL for the server-side fetch (SSRF surface).
    const found = await getLinkRowsByIds(env, ids, user.id)
    const targets = found.map((l) => ({ id: l.id, slug: l.slug, url: l.url }))

    const results = await runHealthCheck(
      env,
      targets,
      timeout ? timeout * 1000 : undefined,
    )
    return NextResponse.json({ results })
  },
)
