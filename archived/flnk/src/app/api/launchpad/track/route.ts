import { getCloudflareContext } from '@opennextjs/cloudflare'
import { extractAccessLog, writeAccessLog } from '@/lib/analytics/analytics'
import { getPublishedLaunchpadBySlug } from '@/lib/data/launchpads'
import { checkRateLimit, clientIp } from '@/lib/platform/rate-limit'
import { TrackLaunchpadSchema } from '@/schemas/launchpad'

// Public click-beacon for launchpad blocks. No auth — a visitor's click on a
// `/m/<slug>` block records a `launchpad_block` engagement. The clicked block id
// rides in the `url` blob (blob2); `type` (blob19) marks the entity kind.
export async function POST(request: Request): Promise<Response> {
  const parsed = TrackLaunchpadSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return new Response(null, { status: 204 })
  }

  const { env, cf, ctx } = getCloudflareContext()
  const { slug, blockId } = parsed.data

  // Per-IP rate limit on the unauthenticated beacon so a visitor can't flood
  // Analytics Engine. Fails open on limiter error (availability over strictness).
  if (await checkRateLimit(env, 'lptrack', clientIp(request), 60, 60)) {
    return new Response(null, { status: 429 })
  }

  // Only record clicks for a slug that resolves to an existing PUBLISHED
  // launchpad. A nonexistent/unpublished slug produces no Analytics write, so a
  // visitor can't inject arbitrary data points against slugs they don't own.
  const launchpad = await getPublishedLaunchpadBySlug(env, slug)
  if (!launchpad) {
    return new Response(null, { status: 204 })
  }

  // Only record clicks for a block that actually belongs to this launchpad. An
  // arbitrary `blockId` is dropped (no Analytics write) so a third party can't
  // inflate a victim's engagement points against blocks they don't own. Same
  // benign 204 as a real click — the beacon leaks no validation detail.
  const blockIds = new Set(launchpad.config.blocks.map((block) => block.id))
  if (!blockIds.has(blockId)) {
    return new Response(null, { status: 204 })
  }

  ctx.waitUntil(
    Promise.resolve().then(() =>
      writeAccessLog(
        env,
        extractAccessLog(
          request,
          slug,
          blockId,
          cf,
          'launchpad_block',
          launchpad.ownerId,
        ),
      ),
    ),
  )
  return new Response(null, { status: 204 })
}
