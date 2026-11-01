import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import * as z from 'zod'
import { generateAiSlug } from '@/lib/ai/ai-slug'
import { requireSession } from '@/lib/platform/auth'
import { checkRateLimit, clientIp } from '@/lib/platform/rate-limit'

const QuerySchema = z.object({ url: z.url() })

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({ url: url.searchParams.get('url') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  const { env } = getCloudflareContext()
  const identity = auth.user.id || clientIp(request)
  if (await checkRateLimit(env, 'ai-slug', identity, 20, 60)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  const result = await generateAiSlug(env, parsed.data.url)
  return NextResponse.json(result)
}
