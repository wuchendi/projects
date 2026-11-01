import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Link, LinkRow } from '@/database/schema'
import { links, tags } from '@/database/schema'
import type { DB } from '@/lib/data/db'
import { getDb } from '@/lib/data/db'
import { purgeLink } from '@/lib/data/links/cache'
import { newId } from '@/lib/platform/genid'

// Max tags per link — mirrors the bound in `schemas/link.ts`.
const MAX_TAGS = 20

// Trim, drop empties, de-dupe, and cap a raw tag-name list.
export function normalizeTagList(input?: string[]): string[] {
  return Array.from(
    new Set((input ?? []).map((t) => t.trim()).filter(Boolean)),
  ).slice(0, MAX_TAGS)
}

// Ensure every name exists in the `tags` dictionary; return name → id. New names
// are inserted (conflicts on the unique name are ignored), then all are read
// back so existing tags resolve to their stored id. `ownerId` (user.id) is the
// scoping key; `createdBy` (email) is recorded on freshly inserted tags only for
// display — an existing tag keeps its original author.
export async function upsertTagIds(
  db: DB,
  names: string[],
  ownerId = '',
  createdBy = '',
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(names))
  if (unique.length === 0) return new Map()
  await db
    .insert(tags)
    .values(unique.map((name) => ({ id: newId(), name, ownerId, createdBy })))
    .onConflictDoNothing()
  // Read back only the caller's own tags. The (name, owner_id) unique index
  // lets the same name exist per owner, so an unscoped read could resolve a name
  // to ANOTHER owner's tag id — this filter keeps every id owner-local.
  const rows = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(and(inArray(tags.name, unique), eq(tags.ownerId, ownerId)))
  return new Map(rows.map((r) => [r.name, r.id]))
}

// Resolve normalized tag names to their stored IDs (creating any missing ones),
// preserving the input order. The order is what gets persisted in `links.tags`.
export async function tagNamesToIds(
  db: DB,
  names: string[],
  ownerId = '',
  createdBy = '',
): Promise<string[]> {
  const idByName = await upsertTagIds(db, names, ownerId, createdBy)
  return names.map((n) => idByName.get(n)).filter((id): id is string => !!id)
}

// Replace the inline tag-ID column on rows with their display names, the shape
// the API/UI expects (`Link.tags: string[]`). One dictionary lookup covers the
// whole batch; IDs whose tag is missing or soft-deleted drop out.
export async function attachTagNames(db: DB, rows: LinkRow[]): Promise<Link[]> {
  const ids = Array.from(new Set(rows.flatMap((r) => r.tags)))
  if (ids.length === 0) return rows
  const dict = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(and(inArray(tags.id, ids), eq(tags.isDeleted, 0)))
  const nameById = new Map(dict.map((d) => [d.id, d.name]))
  return rows.map((r) => ({
    ...r,
    tags: r.tags
      .map((id) => nameById.get(id))
      .filter((n): n is string => n !== undefined),
  }))
}

// The caller's own tags with their non-deleted link count, for the dashboard
// tag filter. Owner-scoped: only the caller's tags are listed, and the count
// covers only the caller's own links. Tags with no live link sort last (0).
export async function listTags(
  env: CloudflareEnv,
  ownerId: string,
): Promise<{ tag: string; count: number }[]> {
  const db = await getDb(env)
  const rows = await db.all<{ tag: string; count: number }>(sql`
    select t.name as tag,
      (
        select count(*) from ${links} l
        where l.is_deleted = 0
          and l.owner_id = ${ownerId}
          and exists (select 1 from json_each(l.tags) je where je.value = t.id)
      ) as count
    from ${tags} t
    where t.is_deleted = 0
      and t.owner_id = ${ownerId}
    order by count desc, tag asc
  `)
  return rows.map((r) => ({ tag: String(r.tag), count: Number(r.count) }))
}

// Add or remove a single tag across many links (dashboard bulk action). The tag
// name is resolved to its ID once, then each link's inline `tags` ID array is
// mutated and written back. The cached redirect copy is purged so it rebuilds.
// Returns the number of rows changed.
export async function bulkTagLinks(
  env: CloudflareEnv,
  ids: string[],
  tag: string,
  op: 'add' | 'remove',
  ownerId = '',
): Promise<number> {
  const db = await getDb(env)
  // Add creates the tag if it's new; remove on an unknown tag is a no-op. The
  // remove lookup is owner-scoped so it resolves the caller's own tag, not a
  // same-named tag belonging to another owner.
  const tagId =
    op === 'add'
      ? (await upsertTagIds(db, [tag], ownerId)).get(tag)
      : (
          await db
            .select({ id: tags.id })
            .from(tags)
            .where(and(eq(tags.name, tag), eq(tags.ownerId, ownerId)))
            .limit(1)
        )[0]?.id
  if (!tagId) return 0
  // One batched select up front (chunked at 100 ids — the D1 bound-parameter
  // cap); the updates stay per-row because each row's tag array differs. The
  // owner filter prevents tagging another owner's links.
  const rows: LinkRow[] = []
  for (let i = 0; i < ids.length; i += 100) {
    rows.push(
      ...(await db
        .select()
        .from(links)
        .where(
          and(
            inArray(links.id, ids.slice(i, i + 100)),
            eq(links.isDeleted, 0),
            eq(links.ownerId, ownerId),
          ),
        )),
    )
  }
  let updated = 0
  for (const current of rows) {
    const has = current.tags.includes(tagId)
    let next: string[]
    if (op === 'add') {
      if (has || current.tags.length >= MAX_TAGS) continue
      next = [...current.tags, tagId]
    } else {
      if (!has) continue
      next = current.tags.filter((x) => x !== tagId)
    }
    await db
      .update(links)
      .set({ tags: next, updatedAt: new Date() })
      .where(eq(links.id, current.id))
    await purgeLink(env, current.domain, current.slug)
    updated++
  }
  return updated
}

// Replace a single link's entire tag set (dashboard inline editor saves the
// staged selection on close). Resolves the names to IDs (creating new ones) and
// writes the inline `tags` column. Returns false when the link doesn't exist.
export async function setLinkTags(
  env: CloudflareEnv,
  id: string,
  tagNames: string[],
  ownerId = '',
): Promise<boolean> {
  const db = await getDb(env)
  // Owner-scoped: another owner's link resolves to no row → returns false → the
  // route 404s, so a user can't rewrite another owner's tag set.
  const current = (
    await db
      .select()
      .from(links)
      .where(
        and(
          eq(links.id, id),
          eq(links.isDeleted, 0),
          eq(links.ownerId, ownerId),
        ),
      )
      .limit(1)
  )[0]
  if (!current) return false
  const ids = await tagNamesToIds(db, normalizeTagList(tagNames), ownerId)
  const row = (
    await db
      .update(links)
      .set({ tags: ids, updatedAt: new Date() })
      .where(eq(links.id, id))
      .returning()
  )[0]!
  await purgeLink(env, row.domain, row.slug)
  return true
}
