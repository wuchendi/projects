import { NextResponse } from 'next/server'
import { searchLinks } from '@/lib/data/links'
import { getConfig } from '@/lib/platform/env'
import { withSession } from '@/lib/platform/with-auth'

export const GET = withSession(async ({ user, request, env }) => {
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({ links: [] })

  const maxLimit = getConfig(env).listQueryLimit
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number(url.searchParams.get('limit')) || 20),
  )
  const links = await searchLinks(env, q, { limit }, user.id)
  return NextResponse.json({ links })
})
