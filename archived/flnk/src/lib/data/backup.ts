import { and, asc, eq } from 'drizzle-orm'
import type { Link } from '@/database/schema'
import { links as linksTable } from '@/database/schema'
import { getDb } from '@/lib/data/db'
import { listLinks } from '@/lib/data/links'
import { getR2 } from '@/lib/data/r2'
import { logger } from '@/lib/platform/logger'

const PAGE_SIZE = 1000
const MAX_LINKS = 50000

// Page through listLinks until exhausted, hard-capped at MAX_LINKS. When the
// cap is hit the result is flagged truncated and a warning is logged. Backs the
// user-facing export, which needs tag names + title (via listLinks). Scoped to
// the caller's own links via `ownerId` (user.id, per-owner isolation).
export async function fetchAllLinks(
  env: CloudflareEnv,
  ownerId: string,
): Promise<{ links: Link[]; truncated: boolean }> {
  const all: Link[] = []
  let offset = 0
  for (;;) {
    const { links, total } = await listLinks(env, {
      limit: PAGE_SIZE,
      offset,
      ownerId,
    })
    all.push(...links)
    offset += PAGE_SIZE
    if (all.length >= MAX_LINKS) {
      logger.warn(
        `Link export cap of ${MAX_LINKS} reached (total ${total}) — result truncated`,
      )
      return { links: all.slice(0, MAX_LINKS), truncated: true }
    }
    if (links.length < PAGE_SIZE || offset >= total) {
      return { links: all, truncated: false }
    }
  }
}

// Only the columns the backup payload serializes — no tag-name join, no count.
type BackupLinkRow = Pick<
  Link,
  | 'id'
  | 'slug'
  | 'domain'
  | 'url'
  | 'comment'
  | 'config'
  | 'expiresAt'
  | 'createdAt'
>

// Stream active links for the daily backup: a column-scoped, id-ordered select
// paged by limit/offset until a short page ends it, hard-capped at MAX_LINKS.
// No count(*) and no tag-name join — the backup payload needs neither. Scoped to
// the caller's own links via `ownerId` (user.id, per-owner isolation).
export async function fetchLinksForBackup(
  env: CloudflareEnv,
  owner: string,
): Promise<{ links: BackupLinkRow[]; truncated: boolean }> {
  const db = await getDb(env)
  const all: BackupLinkRow[] = []
  let offset = 0
  for (;;) {
    const page = await db
      .select({
        id: linksTable.id,
        slug: linksTable.slug,
        domain: linksTable.domain,
        url: linksTable.url,
        comment: linksTable.comment,
        config: linksTable.config,
        expiresAt: linksTable.expiresAt,
        createdAt: linksTable.createdAt,
      })
      .from(linksTable)
      .where(and(eq(linksTable.isDeleted, 0), eq(linksTable.ownerId, owner)))
      .orderBy(asc(linksTable.id))
      .limit(PAGE_SIZE)
      .offset(offset)
    all.push(...page)
    offset += PAGE_SIZE
    if (all.length >= MAX_LINKS) {
      logger.warn(`Link backup cap of ${MAX_LINKS} reached — result truncated`)
      return { links: all.slice(0, MAX_LINKS), truncated: true }
    }
    if (page.length < PAGE_SIZE) {
      return { links: all, truncated: false }
    }
  }
}

// Derive a filesystem/key-safe R2 path segment from an owner id (user.id) so
// each owner's snapshots live under their own prefix and never collide.
// Lowercase, then map every char outside [a-z0-9_-] to '_'. Deterministic and
// stable per owner.
function ownerSlug(owner: string): string {
  return owner.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
}

// Write a JSON snapshot of the owner's active links to R2 under
// backups/<ownerSlug>/. Returns the object key, or null when R2 is not
// configured.
export async function backupToR2(
  env: CloudflareEnv,
  owner: string,
): Promise<string | null> {
  const r2 = getR2(env)
  if (!r2) return null

  const { links, truncated } = await fetchLinksForBackup(env, owner)
  const payload = JSON.stringify({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    count: links.length,
    truncated,
    links: links.map((l) => ({
      id: l.id,
      slug: l.slug,
      domain: l.domain,
      url: l.url,
      comment: l.comment,
      config: l.config,
      expiresAt: l.expiresAt ? l.expiresAt.getTime() : null,
      createdAt: l.createdAt.getTime(),
    })),
  })

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const key = `backups/${ownerSlug(owner)}/${ts}.json`
  await r2.put(key, payload, {
    httpMetadata: { contentType: 'application/json' },
  })
  return key
}
