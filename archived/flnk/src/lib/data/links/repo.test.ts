import { createClient } from '@libsql/client'
import { and, eq } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { drizzle } from 'drizzle-orm/libsql'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewLink } from '@/database/schema'
import { links } from '@/database/schema'

// importLinks talks to the DB through getDb and to KV through the cache helpers.
// We swap getDb for a real in-memory libsql DB (so the owner-scoped WHERE is
// actually executed — no circular mock) and stub the cache helpers with spies.
const cacheMock = vi.hoisted(() => ({
  purgeLink: vi.fn(
    async (_env: CloudflareEnv, _domain: string, _slug: string) => {},
  ),
  writeCache: vi.fn(async () => {}),
}))
const dbHolder = vi.hoisted(() => ({ db: null as LibSQLDatabase | null }))

vi.mock('@/lib/data/db', () => ({ getDb: async () => dbHolder.db }))
vi.mock('@/lib/data/links/cache', () => cacheMock)

const { createLink, importLinks, isSlugOwnedBy } = await import(
  '@/lib/data/links/repo'
)

const env = {} as CloudflareEnv

// Mirror of the `links` table DDL for the columns importLinks touches. Timestamp
// columns are integers (drizzle `timestamp` mode); the unique index covers
// soft-deleted rows too, exactly like production.
async function freshDb(): Promise<LibSQLDatabase> {
  const client = createClient({ url: ':memory:' })
  await client.execute(`CREATE TABLE links (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    comment TEXT NOT NULL DEFAULT '',
    owner_id TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    config TEXT NOT NULL DEFAULT '{}',
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
  )`)
  await client.execute(
    'CREATE UNIQUE INDEX uniq_links_slug_domain ON links (slug, domain)',
  )
  return drizzle(client)
}

// Seed a row directly through drizzle so the schema defaults / timestamp mapping
// match production exactly.
async function seed(row: Partial<NewLink> & { slug: string; url: string }) {
  await dbHolder.db!.insert(links).values({
    id: row.id ?? `seed-${row.slug}`,
    domain: '',
    ownerId: '',
    createdBy: '',
    isDeleted: 0,
    ...row,
  })
}

beforeEach(async () => {
  dbHolder.db = await freshDb()
  cacheMock.purgeLink.mockClear()
  cacheMock.writeCache.mockClear()
})

afterEach(() => {
  dbHolder.db = null
})

describe('importLinks', () => {
  it('cannot revive or overwrite another owner soft-deleted (slug,domain)', async () => {
    // A soft-deleted link owned by the victim, holding (slug='vic', domain='').
    await seed({
      id: 'victim-row',
      slug: 'vic',
      url: 'https://victim.example',
      ownerId: 'user_victim',
      createdBy: 'victim@example.com',
      config: { passwordHash: 'VICTIM' },
      isDeleted: 1,
    })

    // The attacker imports the same (slug,domain). The owner-scoped lookup must
    // not see the victim's row, so import treats it as new — colliding on the
    // unique index (which covers soft-deleted rows), which is acceptable. Either
    // way the victim's row must stay byte-for-byte intact.
    await importLinks(
      env,
      [
        {
          slug: 'vic',
          url: 'https://attacker.example',
          config: { passwordHash: 'ATTACKER' },
        },
      ],
      'user_attacker',
      'attacker@example.com',
    ).catch(() => {})

    const victim = (
      await dbHolder.db!.select().from(links).where(eq(links.id, 'victim-row'))
    )[0]!
    expect(victim.createdBy).toBe('victim@example.com')
    expect(victim.url).toBe('https://victim.example')
    expect(victim.config.passwordHash).toBe('VICTIM')
    expect(victim.isDeleted).toBe(1)
  })

  it('stamps imported rows with the importer createdBy and purges their cache', async () => {
    const report = await importLinks(
      env,
      [
        { slug: 'new1', url: 'https://a.example' },
        { slug: 'new2', url: 'https://b.example' },
      ],
      'user_me',
      'me@example.com',
    )

    expect(report.success).toBe(2)
    const rows = await dbHolder.db!.select().from(links)
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.ownerId).toBe('user_me')
      expect(row.createdBy).toBe('me@example.com')
    }

    // H3: every inserted (domain,slug) clears the negative-cache tombstone.
    expect(cacheMock.purgeLink).toHaveBeenCalledTimes(2)
    const purged = cacheMock.purgeLink.mock.calls.map((c) => [c[1], c[2]])
    expect(purged).toContainEqual(['', 'new1'])
    expect(purged).toContainEqual(['', 'new2'])
  })

  it('revives a same-owner soft-deleted row in place and purges its cache', async () => {
    await seed({
      id: 'mine',
      slug: 'rev',
      url: 'https://old.example',
      ownerId: 'user_me',
      createdBy: 'me@example.com',
      isDeleted: 1,
    })

    const report = await importLinks(
      env,
      [{ slug: 'rev', url: 'https://new.example' }],
      'user_me',
      'me@example.com',
    )

    expect(report.success).toBe(1)
    const row = (
      await dbHolder.db!.select().from(links).where(eq(links.id, 'mine'))
    )[0]!
    expect(row.isDeleted).toBe(0)
    expect(row.url).toBe('https://new.example')
    expect(row.ownerId).toBe('user_me')
    expect(row.createdBy).toBe('me@example.com')
    expect(cacheMock.purgeLink).toHaveBeenCalledWith(env, '', 'rev')
  })

  it('skips a same-owner active (slug,domain) without touching it', async () => {
    await seed({
      id: 'active',
      slug: 'act',
      url: 'https://keep.example',
      ownerId: 'user_me',
      createdBy: 'me@example.com',
      isDeleted: 0,
    })

    const report = await importLinks(
      env,
      [{ slug: 'act', url: 'https://overwrite.example' }],
      'user_me',
      'me@example.com',
    )

    expect(report.skipped).toBe(1)
    expect(report.success).toBe(0)
    const row = (
      await dbHolder.db!.select().from(links).where(eq(links.id, 'active'))
    )[0]!
    expect(row.url).toBe('https://keep.example')
    expect(cacheMock.purgeLink).not.toHaveBeenCalled()
  })

  it('inserts a fresh owner-scoped row when the slug is free for the importer', async () => {
    // Same slug, but owned by someone else and ACTIVE under a different domain,
    // so the importer's owner-scoped lookup finds nothing and inserts fresh.
    await seed({
      id: 'other',
      slug: 'shared',
      domain: 'other.example',
      url: 'https://other.example/x',
      ownerId: 'user_other',
      createdBy: 'other@example.com',
    })

    const report = await importLinks(
      env,
      [
        {
          slug: 'shared',
          domain: 'mine.example',
          url: 'https://mine.example/x',
        },
      ],
      'user_me',
      'me@example.com',
    )

    expect(report.success).toBe(1)
    const mine = (
      await dbHolder
        .db!.select()
        .from(links)
        .where(and(eq(links.slug, 'shared'), eq(links.domain, 'mine.example')))
    )[0]!
    expect(mine.ownerId).toBe('user_me')
    expect(mine.createdBy).toBe('me@example.com')
    expect(mine.id).not.toBe('other')
    expect(cacheMock.purgeLink).toHaveBeenCalledWith(
      env,
      'mine.example',
      'shared',
    )
  })
})

describe('createLink', () => {
  it('returns 409 when an active link already holds the (slug,domain)', async () => {
    await seed({
      id: 'existing',
      slug: 'dup',
      url: 'https://keep.example',
      ownerId: 'user_me',
      createdBy: 'me@example.com',
      isDeleted: 0,
    })

    const result = await createLink(
      env,
      { slug: 'dup', url: 'https://new.example' },
      '',
      'user_me',
      'me@example.com',
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(409)
    // The pre-existing row is untouched.
    const row = (
      await dbHolder.db!.select().from(links).where(eq(links.id, 'existing'))
    )[0]!
    expect(row.url).toBe('https://keep.example')
  })
})

describe('isSlugOwnedBy', () => {
  it('is true for own non-deleted slug, false for another owner and soft-deleted', async () => {
    await seed({
      id: 'own',
      slug: 'mine',
      url: 'https://a.example',
      ownerId: 'user_me',
      createdBy: 'me@example.com',
      isDeleted: 0,
    })
    await seed({
      id: 'their',
      slug: 'theirs',
      url: 'https://b.example',
      ownerId: 'user_other',
      createdBy: 'other@example.com',
      isDeleted: 0,
    })
    await seed({
      id: 'gone',
      slug: 'dead',
      url: 'https://c.example',
      ownerId: 'user_me',
      createdBy: 'me@example.com',
      isDeleted: 1,
    })

    expect(await isSlugOwnedBy(env, 'mine', 'user_me')).toBe(true)
    expect(await isSlugOwnedBy(env, 'theirs', 'user_me')).toBe(false)
    expect(await isSlugOwnedBy(env, 'dead', 'user_me')).toBe(false)
  })
})
