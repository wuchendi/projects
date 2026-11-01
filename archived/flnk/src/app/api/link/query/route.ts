import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import { getLinkById, resolveLink } from '@/lib/data/links'
import { requireSession } from '@/lib/platform/auth'

// Fetch a single link by id, or by (slug, domain) when id is absent.
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const { env } = getCloudflareContext()
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const slug = url.searchParams.get('slug')
  const domain = url.searchParams.get('domain') || url.hostname

  // By-id is owner-scoped (cross-owner id → null → 404, no existence leak). The
  // by-(slug,domain) branch reuses the public redirect resolver but is then
  // owner-checked here: a slug owned by another user is treated as not-found so
  // the full record (comment/config incl. passwordHash/tags) never leaks.
  let link = id
    ? await getLinkById(env, id, auth.user.id)
    : slug
      ? await resolveLink(env, domain, slug)
      : null

  if (link && link.ownerId !== auth.user.id) link = null

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }
  return NextResponse.json({ link })
}
