import { NextResponse } from 'next/server'
import { createLink } from '@/lib/data/links'
import { withAuth } from '@/lib/platform/with-auth'
import { CreateLinkSchema } from '@/schemas/link'

export const POST = withAuth(
  CreateLinkSchema,
  async (data, { user, request, env }) => {
    const domain = new URL(request.url).hostname
    const result = await createLink(env, data, domain, user.id, user.email)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      )
    }
    return NextResponse.json({ link: result.link }, { status: 201 })
  },
)
