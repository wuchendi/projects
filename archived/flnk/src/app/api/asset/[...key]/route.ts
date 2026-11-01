import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { NextRequest } from 'next/server'
import { getR2 } from '@/lib/data/r2'

type RouteContext = { params: Promise<{ key: string[] }> }

// Public OG-image serving from R2. Restricted to the `og/` prefix and to
// image content-types so it can't be used to read arbitrary objects.
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  const { key } = await params
  const path = key.join('/')
  if (!path.startsWith('og/')) {
    return new Response('Not found', { status: 404 })
  }

  const { env } = getCloudflareContext()
  const r2 = getR2(env)
  if (!r2) return new Response('Not found', { status: 404 })

  const object = await r2.get(path)
  const contentType = object?.httpMetadata?.contentType
  if (!object || !contentType?.startsWith('image/')) {
    return new Response('Not found', { status: 404 })
  }

  return new Response(object.body, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
