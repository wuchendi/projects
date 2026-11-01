import { NextResponse } from 'next/server'
import { listTags } from '@/lib/data/links'
import { withSession } from '@/lib/platform/with-auth'

export const GET = withSession(async ({ user, env }) => {
  const tags = await listTags(env, user.id)
  return NextResponse.json({ tags })
})
