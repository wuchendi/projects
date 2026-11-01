import { NextResponse } from 'next/server'
import { getLaunchpadById } from '@/lib/data/launchpads'
import { withSession } from '@/lib/platform/with-auth'

// Fetch a single launchpad by id.
export const GET = withSession(async ({ user, request, env }) => {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const launchpad = await getLaunchpadById(env, id, user.id)
  if (!launchpad) {
    return NextResponse.json({ error: 'Launchpad not found' }, { status: 404 })
  }
  return NextResponse.json({ launchpad })
})
