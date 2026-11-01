import { NextResponse } from 'next/server'
import { deleteLink } from '@/lib/data/links'
import { withAuth } from '@/lib/platform/with-auth'
import { DeleteLinkSchema } from '@/schemas/link'

export const POST = withAuth(DeleteLinkSchema, async (data, { user, env }) => {
  const result = await deleteLink(env, data.id, user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true })
})
