import { NextResponse } from 'next/server'
import { updateLaunchpad } from '@/lib/data/launchpads'
import { withAuth } from '@/lib/platform/with-auth'
import { EditLaunchpadSchema } from '@/schemas/launchpad'

export const PUT = withAuth(
  EditLaunchpadSchema,
  async (data, { user, env }) => {
    const result = await updateLaunchpad(env, data, user.id)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      )
    }
    return NextResponse.json({ launchpad: result.launchpad })
  },
)
