import { NextResponse } from 'next/server'
import { withSession } from '@/lib/platform/with-auth'

export const GET = withSession(async ({ user }) => {
  // Per-owner isolation collapses the creator dimension to just the caller —
  // each user only ever sees their own links, so this never enumerates other
  // owners' emails.
  return NextResponse.json({ creators: [user.email] })
})
