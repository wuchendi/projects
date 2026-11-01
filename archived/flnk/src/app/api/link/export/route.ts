import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import { fetchAllLinks } from '@/lib/data/backup'
import { requireSession } from '@/lib/platform/auth'

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const { env } = getCloudflareContext()
  const { links, truncated } = await fetchAllLinks(env, auth.user.id)
  const out = links.map((l) => ({
    id: l.id,
    slug: l.slug,
    domain: l.domain,
    url: l.url,
    title: l.title,
    comment: l.comment,
    tags: l.tags,
    config: l.config,
    expiresAt: l.expiresAt ? l.expiresAt.getTime() : null,
    createdAt: l.createdAt.getTime(),
  }))

  return NextResponse.json(
    {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      count: out.length,
      truncated,
      links: out,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
