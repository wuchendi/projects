import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { LaunchpadTracker } from '@/components/launchpad/launchpad-tracker'
import type { LinkRef } from '@/components/launchpad/launchpad-view'
import { LaunchpadView } from '@/components/launchpad/launchpad-view'
import type { Launchpad } from '@/database/schema'
import { extractAccessLog, writeAccessLog } from '@/lib/analytics/analytics'
import {
  getLinksByIds,
  getPublishedLaunchpadBySlug,
} from '@/lib/data/launchpads'

// Every load resolves the launchpad fresh (publish/expiry checks) and emits a
// view data point — never serve a cached HTML snapshot.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const { env } = getCloudflareContext()
  const launchpad = await getPublishedLaunchpadBySlug(env, slug)
  if (!launchpad) return {}

  const { og, config } = launchpad
  const title = og.title || launchpad.title || config.profile.name || undefined
  const description = og.description || config.profile.bio || undefined
  const image = og.image || config.profile.avatar
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  }
}

// Resolve the link references (button/shortlink blocks) an enabled block needs.
async function resolveLinkRefs(
  env: CloudflareEnv,
  launchpad: Launchpad,
): Promise<Record<string, LinkRef>> {
  const ids = new Set<string>()
  for (const block of launchpad.config.blocks) {
    if (!block.enabled) continue
    if (block.type === 'button' && block.target.kind === 'link') {
      ids.add(block.target.linkId)
    } else if (block.type === 'shortlink') {
      for (const id of block.linkIds) ids.add(id)
    }
  }
  // Links are owner-scoped by ownerId (= user.id), which the launchpad carries
  // directly. A linkId owned by someone else resolves to nothing — no private
  // title of a foreign link is ever rendered on the public page.
  const linkMap = await getLinksByIds(env, [...ids], launchpad.ownerId)
  const refs: Record<string, LinkRef> = {}
  for (const [id, link] of linkMap) {
    refs[id] = { slug: link.slug, label: link.title || link.slug }
  }
  return refs
}

// Fire a launchpad VIEW (blob19 type=launchpad) for this page load. Reuses the
// redirect engine's access-log extraction by reconstructing a Request from the
// inbound headers; failures never affect the render.
async function recordView(
  env: CloudflareEnv,
  cf: IncomingRequestCfProperties | undefined,
  ctx: { waitUntil: (p: Promise<unknown>) => void },
  slug: string,
  ownerId: string,
): Promise<void> {
  const h = await headers()
  const host = h.get('host') ?? 'localhost'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const pageUrl = `${proto}://${host}/m/${slug}`
  const reqHeaders = new Headers()
  h.forEach((value, key) => reqHeaders.set(key, value))
  const request = new Request(pageUrl, { headers: reqHeaders })
  ctx.waitUntil(
    Promise.resolve().then(() =>
      writeAccessLog(
        env,
        extractAccessLog(request, slug, pageUrl, cf, 'launchpad', ownerId),
      ),
    ),
  )
}

export default async function LaunchpadPage({ params }: PageProps) {
  const { slug } = await params
  const { env, cf, ctx } = getCloudflareContext()

  const launchpad = await getPublishedLaunchpadBySlug(env, slug)
  if (!launchpad) notFound()

  const linkRefs = await resolveLinkRefs(env, launchpad)
  await recordView(env, cf, ctx, launchpad.slug, launchpad.ownerId)

  return (
    <>
      <LaunchpadView config={launchpad.config} linkRefs={linkRefs} />
      <LaunchpadTracker slug={launchpad.slug} />
    </>
  )
}
