import { beforeEach, describe, expect, it, vi } from 'vitest'

// Rows the mock DB serves. `ownerId` (user.id) is the per-owner scoping key.
type Row = {
  id: number
  slug: string
  domain: string
  url: string
  comment: string | null
  config: unknown
  expiresAt: Date | null
  createdAt: Date
  ownerId: string
}

const dataset: Row[] = [
  {
    id: 1,
    slug: 'a1',
    domain: 'x.co',
    url: 'https://a.example',
    comment: null,
    config: { passwordHash: 'secret-a' },
    expiresAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ownerId: 'user_alice',
  },
  {
    id: 2,
    slug: 'a2',
    domain: 'x.co',
    url: 'https://a2.example',
    comment: 'note',
    config: {},
    expiresAt: null,
    createdAt: new Date('2026-01-02T00:00:00Z'),
    ownerId: 'user_alice',
  },
  {
    id: 3,
    slug: 'b1',
    domain: 'x.co',
    url: 'https://b.example',
    comment: null,
    config: { passwordHash: 'secret-b' },
    expiresAt: null,
    createdAt: new Date('2026-01-03T00:00:00Z'),
    ownerId: 'user_bob',
  },
]

// Recursively collect every string primitive reachable from a drizzle SQL
// condition, so a test can prove the owner value was baked into the `.where`
// without depending on drizzle's internal object shape.
function collectStrings(
  node: unknown,
  seen = new Set<unknown>(),
  out: string[] = [],
  depth = 0,
): string[] {
  if (depth > 20 || node == null) return out
  if (typeof node === 'string') {
    out.push(node)
    return out
  }
  if (typeof node !== 'object') return out
  if (seen.has(node)) return out
  seen.add(node)
  for (const v of Object.values(node as Record<string, unknown>)) {
    collectStrings(v, seen, out, depth + 1)
  }
  return out
}

// The last `.where(...)` condition the code under test built.
let capturedWhere: unknown

// A chainable mock of the drizzle query builder. `.where` records the condition
// and derives the owner filter from it (the only `user_`-prefixed string in the
// condition is the `ownerId` param), so awaiting the chain returns ONLY that
// owner's rows — mirroring what the real per-owner query would return. Only the
// query chain is thenable; the `db` object itself is not (an async getDb would
// otherwise unwrap a thenable db into its resolved rows).
function makeDb() {
  let ownerFilter: string | undefined
  let lim = 0
  let off = 0
  const query = {
    from: () => query,
    where: (cond: unknown) => {
      capturedWhere = cond
      ownerFilter = collectStrings(cond).find((s) => s.startsWith('user_'))
      return query
    },
    orderBy: () => query,
    limit: (n: number) => {
      lim = n
      return query
    },
    offset: (n: number) => {
      off = n
      return query
    },
    then: (resolve: (rows: Row[]) => void) => {
      const rows = dataset
        .filter((r) => r.ownerId === ownerFilter)
        .slice(off, off + lim)
      resolve(rows)
    },
  }
  return { select: () => query }
}

const putMock = vi.fn()

vi.mock('@/lib/data/db', () => ({
  getDb: async () => makeDb(),
}))

vi.mock('@/lib/data/r2', () => ({
  getR2: () => ({ put: putMock }),
}))

const { backupToR2, fetchLinksForBackup } = await import('@/lib/data/backup')

const env = {} as CloudflareEnv

beforeEach(() => {
  putMock.mockReset()
  capturedWhere = undefined
})

describe('fetchLinksForBackup', () => {
  it('returns only the given owner rows and scopes the where by that owner', async () => {
    const { links } = await fetchLinksForBackup(env, 'user_alice')

    expect(links.map((l) => l.id).sort()).toEqual([1, 2])
    expect(links.some((l) => l.slug === 'b1')).toBe(false)
    // The owner value was baked into the query's WHERE clause.
    expect(collectStrings(capturedWhere)).toContain('user_alice')
  })

  it('a different owner gets a disjoint row set', async () => {
    const { links } = await fetchLinksForBackup(env, 'user_bob')

    expect(links.map((l) => l.id)).toEqual([3])
    expect(collectStrings(capturedWhere)).toContain('user_bob')
  })
})

describe('backupToR2', () => {
  it('namespaces the R2 key per owner (sanitized, deterministic slug)', async () => {
    const keyA = await backupToR2(env, 'user_alice')
    const keyB = await backupToR2(env, 'user_bob')

    expect(keyA).toMatch(/^backups\/user_alice\/.+\.json$/)
    expect(keyB).toMatch(/^backups\/user_bob\/.+\.json$/)
    // One owner's snapshot can never overwrite/expose another's.
    expect(keyA?.split('/')[1]).not.toBe(keyB?.split('/')[1])
    expect(putMock.mock.calls[0]?.[0]).toBe(keyA)
    expect(putMock.mock.calls[1]?.[0]).toBe(keyB)
  })

  it('only serializes the owner rows into the payload', async () => {
    await backupToR2(env, 'user_alice')

    const payload = JSON.parse(putMock.mock.calls[0]?.[1] as string) as {
      count: number
      links: { slug: string }[]
    }
    expect(payload.count).toBe(2)
    expect(payload.links.map((l) => l.slug).sort()).toEqual(['a1', 'a2'])
  })
})
