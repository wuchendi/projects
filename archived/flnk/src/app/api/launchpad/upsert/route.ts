import { NextResponse } from 'next/server'
import { upsertLaunchpad } from '@/lib/data/launchpads'
import { withAuth } from '@/lib/platform/with-auth'
import { UpsertLaunchpadSchema } from '@/schemas/launchpad'

export const POST = withAuth(
  UpsertLaunchpadSchema,
  async (data, { user, env }) => {
    const result = await upsertLaunchpad(env, data, user.id)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      )
    }
    return NextResponse.json({ launchpad: result.launchpad })
  },
)
