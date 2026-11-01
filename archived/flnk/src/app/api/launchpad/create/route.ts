import { NextResponse } from 'next/server'
import { createLaunchpad } from '@/lib/data/launchpads'
import { withAuth } from '@/lib/platform/with-auth'
import { CreateLaunchpadSchema } from '@/schemas/launchpad'

export const POST = withAuth(
  CreateLaunchpadSchema,
  async (data, { user, env }) => {
    const result = await createLaunchpad(env, data, user.id)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      )
    }
    return NextResponse.json({ launchpad: result.launchpad }, { status: 201 })
  },
)
