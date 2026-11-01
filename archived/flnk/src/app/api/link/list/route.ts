import { NextResponse } from 'next/server'
import type { LinkStatus, SortKey } from '@/lib/data/links'
import { listLinks } from '@/lib/data/links'
import { getConfig } from '@/lib/platform/env'
import { withSession } from '@/lib/platform/with-auth'

const SORTS: readonly SortKey[] = ['createdAt', 'updatedAt', 'expiresAt']
const STATUSES: readonly LinkStatus[] = ['active', 'disabled', 'expired']

export const GET = withSession(async ({ user, request, env }) => {
  const url = new URL(request.url)
  const sp = url.searchParams
  const maxLimit = getConfig(env).listQueryLimit
  const limit = Math.min(maxLimit, Math.max(1, Number(sp.get('limit')) || 20))
  const offset = Math.max(0, Number(sp.get('offset')) || 0)
  const sortParam = sp.get('sort') as SortKey | null
  const sort = sortParam && SORTS.includes(sortParam) ? sortParam : 'createdAt'
  const statusParam = sp.get('status') as LinkStatus | null
  const status =
    statusParam && STATUSES.includes(statusParam) ? statusParam : undefined
  // Per-owner isolation: always scope the list to the caller by owner id. A
  // client-supplied owner is intentionally ignored so it can't read another
  // owner's links.
  const ownerId = user.id
  const startAt = Number(sp.get('startAt')) || undefined
  const endAt = Number(sp.get('endAt')) || undefined
  const untagged = sp.get('untagged') === '1'
  // De-dupe and cap to the per-link tag limit (20) so a crafted request can't
  // expand into an oversized EXISTS-per-tag query.
  const tags = Array.from(
    new Set(
      sp
        .getAll('tag')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ).slice(0, 20)
  const tagMatch = sp.get('tagMatch') === 'or' ? 'or' : 'and'

  const result = await listLinks(env, {
    limit,
    offset,
    sort,
    status,
    ownerId,
    startAt,
    endAt,
    untagged,
    tags,
    tagMatch,
  })
  return NextResponse.json(result)
})
