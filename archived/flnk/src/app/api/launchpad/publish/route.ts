import { NextResponse } from 'next/server'
import { publishLaunchpad } from '@/lib/data/launchpads'
import { withAuth } from '@/lib/platform/with-auth'
import { PublishLaunchpadSchema } from '@/schemas/launchpad'

export const POST = withAuth(
  PublishLaunchpadSchema,
  async (data, { user, env }) => {
    const result = await publishLaunchpad(env, data.id, data.status, user.id)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      )
    }
    return NextResponse.json({ launchpad: result.launchpad })
  },
)
