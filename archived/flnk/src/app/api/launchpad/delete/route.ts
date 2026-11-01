import { NextResponse } from 'next/server'
import { deleteLaunchpad } from '@/lib/data/launchpads'
import { withAuth } from '@/lib/platform/with-auth'
import { DeleteLaunchpadSchema } from '@/schemas/launchpad'

export const POST = withAuth(
  DeleteLaunchpadSchema,
  async (data, { user, env }) => {
    const result = await deleteLaunchpad(env, data.id, user.id)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      )
    }
    return NextResponse.json({ ok: true })
  },
)
