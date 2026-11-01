import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import * as z from 'zod'
import { generateAiOg } from '@/lib/ai/ai-og'
import { requireSession } from '@/lib/platform/auth'
import { checkRateLimit, clientIp } from '@/lib/platform/rate-limit'

const QuerySchema = z.object({
  url: z.url(),
  locale: z.string().max(35).optional(),
})

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    url: url.searchParams.get('url'),
    locale: url.searchParams.get('locale') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  const { env } = getCloudflareContext()
  const identity = auth.user.id || clientIp(request)
  if (await checkRateLimit(env, 'og-ai', identity, 20, 60)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  const result = await generateAiOg(env, parsed.data.url, parsed.data.locale)
  return NextResponse.json(result)
}
