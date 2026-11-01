import { NextResponse } from 'next/server'
import { countLinks } from '@/lib/data/links'
import { withSession } from '@/lib/platform/with-auth'

export const GET = withSession(async ({ user, env }) => {
  const total = await countLinks(env, user.id)
  return NextResponse.json({ total })
})
