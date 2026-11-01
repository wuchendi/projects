import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { NextRequest } from 'next/server'
import { isExpired, resolveLink } from '@/lib/data/links'
import { ogPageHtml } from '@/lib/redirect/html'
import { isReservedSlug } from '@/lib/redirect/reserve-slug'

type RouteContext = { params: Promise<{ slug: string }> }

// Dedicated OG/social-preview endpoint. Renders the link's OG metadata as HTML.
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  const { slug } = await params
  const { env } = getCloudflareContext()

  if (isReservedSlug(slug)) {
    return new Response('Not found', { status: 404 })
  }

  const domain = new URL(request.url).hostname
  const link = await resolveLink(env, domain, slug)

  if (!link || isExpired(link.expiresAt)) {
    return new Response('Not found', { status: 404 })
  }

  // A paused (disabled) link 404s on the GET/POST redirect paths — the OG path
  // must match, or it would leak the destination of a disabled link.
  if (link.config.disabled) {
    return new Response('Not found', { status: 404 })
  }

  // Never expose the destination of a password-protected link via OG metadata.
  if (link.config.passwordHash) {
    return new Response('Not found', { status: 404 })
  }

  return new Response(ogPageHtml(link.url, link.config, { redirect: false }), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
