import { hashPasswordFn } from '@cdlab/utils'
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import type { Link, LinkConfig, LinkRow, NewLink } from '@/database/schema'
import { links, tags } from '@/database/schema'
import { isUnsafeUrl } from '@/lib/ai/safe-browsing'
import { getDb } from '@/lib/data/db'
import { purgeLink, writeCache } from '@/lib/data/links/cache'
import { normalizeSlug } from '@/lib/data/links/resolve'
import {
  attachTagNames,
  normalizeTagList,
  tagNamesToIds,
  upsertTagIds,
} from '@/lib/data/links/tags'
import type { RepoResult as RepoResultBase, SortKey } from '@/lib/format/types'
import { getConfig } from '@/lib/platform/env'
import { newId } from '@/lib/platform/genid'
import { logger } from '@/lib/platform/logger'
import { randomSlug, validateSlug } from '@/lib/redirect/slug'
import type {
  CreateLinkInput,
  EditLinkInput,
  ImportLinkInput,
} from '@/schemas/link'

export type { SortKey }
export type RepoResult = RepoResultBase<{ link: Link }>

const SORT_COLUMNS = {
  createdAt: links.createdAt,
  updatedAt: links.updatedAt,
  expiresAt: links.expiresAt,
} as const

// Find a row by (slug, domain) regardless of soft-delete state — the unique
// index covers deleted rows too, so create/update must see them.
async function findBySlugDomain(
  env: CloudflareEnv,
  domain: string,
  slug: string,
): Promise<Link | null> {
  const db = await getDb(env)
  return (
    (
      await db
        .select()
        .from(links)
        .where(and(eq(links.slug, slug), eq(links.domain, domain)))
        .limit(1)
    )[0] ?? null
  )
}

// Owner-scoped by-id lookup: when `ownerId` is supplied, a row owned by a
// different user is treated as not-found (returns null) so callers 404 rather
// than 403 — never leaking that the id exists.
export async function getLinkById(
  env: CloudflareEnv,
  id: string,
  ownerId?: string,
): Promise<Link | null> {
  const db = await getDb(env)
  const row = (
    await db
      .select()
      .from(links)
      .where(and(eq(links.id, id), eq(links.isDeleted, 0)))
      .limit(1)
  )[0]
  if (!row) return null
  if (ownerId !== undefined && row.ownerId !== ownerId) return null
  return (await attachTagNames(db, [row]))[0]!
}

// Does the caller own a non-deleted link with this slug? Gates OG-image uploads
// to slugs the caller actually owns. Slug is normalized to match stored rows.
export async function isSlugOwnedBy(
  env: CloudflareEnv,
  slug: string,
  ownerId: string,
): Promise<boolean> {
  const db = await getDb(env)
  const normalized = normalizeSlug(slug, env)
  const row = (
    await db
      .select({ id: links.id })
      .from(links)
      .where(
        and(
          eq(links.slug, normalized),
          eq(links.ownerId, ownerId),
          eq(links.isDeleted, 0),
        ),
      )
      .limit(1)
  )[0]
  return !!row
}

// Batched id lookup for callers that don't need tag names (e.g. health check).
// Returns raw rows (`tags` holds IDs). Owner-scoped: only the caller's own rows
// are returned, so cross-owner ids resolve to nothing (no existence leak).
// Chunked at 99 ids per query so `inArray(ids)` + the `isDeleted`/`ownerId`
// predicates never exceed the D1 100 bound-parameter cap.
export async function getLinkRowsByIds(
  env: CloudflareEnv,
  ids: string[],
  ownerId: string,
): Promise<LinkRow[]> {
  if (ids.length === 0) return []
  const db = await getDb(env)
  const rows: LinkRow[] = []
  for (let i = 0; i < ids.length; i += 99) {
    const chunk = ids.slice(i, i + 99)
    rows.push(
      ...(await db
        .select()
        .from(links)
        .where(
          and(
            inArray(links.id, chunk),
            eq(links.isDeleted, 0),
            eq(links.ownerId, ownerId),
          ),
        )),
    )
  }
  return rows
}

export type LinkStatus = 'active' | 'disabled' | 'expired'

export interface ListOptions {
  limit: number
  offset: number
  sort?: SortKey
  status?: LinkStatus
  ownerId?: string
  // createdAt range (epoch ms).
  startAt?: number
  endAt?: number
  // Tag filter: match links that carry these tags (AND = all, OR = any).
  // `untagged` overrides `tags` and matches links with no tags.
  tags?: string[]
  tagMatch?: 'and' | 'or'
  untagged?: boolean
}

// Build the WHERE conditions shared by the list query and its count, so a
// filtered page reports a matching total.
function listConditions(opts: ListOptions) {
  const now = new Date()
  const conds = [eq(links.isDeleted, 0)]
  if (opts.ownerId) conds.push(eq(links.ownerId, opts.ownerId))
  if (opts.startAt) conds.push(gte(links.createdAt, new Date(opts.startAt)))
  if (opts.endAt) conds.push(lte(links.createdAt, new Date(opts.endAt)))
  // `disabled` lives inside the config JSON; json_extract returns 1 for true,
  // NULL when absent. `IS NOT 1` keeps NULL/0 rows in the "active" set.
  const notDisabled = sql`json_extract(${links.config}, '$.disabled') is not 1`
  const isDisabled = sql`json_extract(${links.config}, '$.disabled') = 1`
  if (opts.status === 'disabled') {
    conds.push(isDisabled)
  } else if (opts.status === 'expired') {
    conds.push(and(isNotNull(links.expiresAt), lte(links.expiresAt, now))!)
  } else if (opts.status === 'active') {
    conds.push(notDisabled)
    conds.push(or(isNull(links.expiresAt), gt(links.expiresAt, now))!)
  }
  // Tag filter, evaluated against the inline `links.tags` ID array. Filters take
  // tag names; each name is resolved to its ID through the `tags` dictionary
  // inside the EXISTS so a rename is transparent to stored links.
  if (opts.untagged) {
    conds.push(sql`json_array_length(${links.tags}) = 0`)
  } else if (opts.tags && opts.tags.length > 0) {
    const hasTag = (tag: string) =>
      sql`exists (select 1 from json_each(${links.tags}) je inner join ${tags} on ${tags.id} = je.value where ${tags.name} = ${tag} and ${tags.isDeleted} = 0)`
    if (opts.tagMatch === 'or') {
      conds.push(sql`(${sql.join(opts.tags.map(hasTag), sql` or `)})`)
    } else {
      for (const tag of opts.tags) conds.push(hasTag(tag))
    }
  }
  return and(...conds)
}

export async function listLinks(
  env: CloudflareEnv,
  opts: ListOptions,
): Promise<{ links: Link[]; total: number }> {
  const db = await getDb(env)
  const sortCol = SORT_COLUMNS[opts.sort ?? 'createdAt']
  const where = listConditions(opts)
  const rows = await db
    .select()
    .from(links)
    .where(where)
    .orderBy(desc(sortCol))
    .limit(opts.limit)
    .offset(opts.offset)
  const totalRow = await db
    .select({ value: sql<number>`count(*)` })
    .from(links)
    .where(where)
  return {
    links: await attachTagNames(db, rows),
    total: Number(totalRow[0]?.value ?? 0),
  }
}

// Distinct non-empty owner IDs (user.id) across ALL owners. This is an
// ALL-OWNERS enumeration and is for the per-owner backup CRON ONLY, which
// legitimately needs to iterate every owner server-side. It must NEVER back a
// request-facing route — exposing it to a caller would leak other owners'
// identities. Request-facing creator listing is the per-caller
// `/api/link/creators` route, which returns only `[user.email]`.
export async function listCreators(env: CloudflareEnv): Promise<string[]> {
  const db = await getDb(env)
  const rows = await db
    .selectDistinct({ ownerId: links.ownerId })
    .from(links)
    .where(eq(links.isDeleted, 0))
  return rows
    .map((r) => r.ownerId)
    .filter((v) => v.length > 0)
    .sort((a, b) => a.localeCompare(b))
}

// Count of the caller's own non-deleted links — backs the overview "total
// links" card. Owner-scoped so each user only ever counts their own links.
export async function countLinks(
  env: CloudflareEnv,
  ownerId: string,
): Promise<number> {
  const db = await getDb(env)
  const row = await db
    .select({ value: sql<number>`count(*)` })
    .from(links)
    .where(and(eq(links.isDeleted, 0), eq(links.ownerId, ownerId)))
  return Number(row[0]?.value ?? 0)
}

export async function searchLinks(
  env: CloudflareEnv,
  query: string,
  opts: { limit: number },
  ownerId: string,
): Promise<Link[]> {
  const db = await getDb(env)
  const q = `%${query.trim()}%`
  const rows = await db
    .select()
    .from(links)
    .where(
      and(
        eq(links.isDeleted, 0),
        eq(links.ownerId, ownerId),
        or(
          like(links.slug, q),
          like(links.url, q),
          like(links.comment, q),
          // Match links carrying a tag whose name matches the query.
          sql`exists (select 1 from json_each(${links.tags}) je inner join ${tags} on ${tags.id} = je.value where ${tags.name} like ${q} and ${tags.isDeleted} = 0)`,
        ),
      ),
    )
    .orderBy(desc(links.createdAt))
    .limit(opts.limit)
  return attachTagNames(db, rows)
}

// Build the stored LinkConfig from input config + password handling.
async function buildConfig(
  env: CloudflareEnv,
  input: CreateLinkInput | EditLinkInput,
  url: string,
  previous?: LinkConfig,
): Promise<LinkConfig> {
  const config: LinkConfig = { ...(input.config ?? {}) }
  // Password: undefined keeps previous; null/'' clears; string (re)hashes.
  if (input.password === undefined) {
    if (previous?.passwordHash) config.passwordHash = previous.passwordHash
  } else if (input.password) {
    config.passwordHash = await hashPasswordFn(input.password)
  }
  // Auto Safe-Browsing: when the caller didn't explicitly mark the link unsafe,
  // probe the destination via DoH and flag it on a hit. Best-effort and a no-op
  // when SAFE_BROWSING_DOH is unset — never blocks the write.
  if (config.unsafe === undefined && url) {
    if (await isUnsafeUrl(env, url)) config.unsafe = true
  }
  return config
}

// Maximum attempts to land a non-colliding random slug before giving up.
const SLUG_MAX_RETRIES = 12

// Allocate a random slug with race-safe insertion. `onConflictDoNothing` lets
// the unique index arbitrate uniqueness atomically (no check-then-insert race),
// and we retry with a longer slug to escape collision hot-spots, without a
// separate pre-query.
async function insertWithRandomSlug(
  env: CloudflareEnv,
  domain: string,
  values: Omit<NewLink, 'slug'>,
): Promise<RepoResult> {
  const db = await getDb(env)
  const baseLen = getConfig(env).slugDefaultLength

  for (let attempt = 1; attempt <= SLUG_MAX_RETRIES; attempt++) {
    const length = baseLen + (attempt <= 4 ? 0 : attempt <= 8 ? 1 : 2)
    const slug = normalizeSlug(randomSlug(length), env)
    const row = (
      await db
        .insert(links)
        .values({ ...values, slug })
        .onConflictDoNothing()
        .returning()
    )[0]
    // Tags are applied + cached by the caller once the row lands.
    if (row) return { ok: true, link: { ...row, tags: [] } }
    logger.debug(`Random slug collision on attempt ${attempt}: ${slug}`)
  }
  return { ok: false, status: 500, error: 'Failed to allocate a unique slug' }
}

export async function createLink(
  env: CloudflareEnv,
  input: CreateLinkInput,
  requestDomain: string,
  ownerId = '',
  createdBy = '',
): Promise<RepoResult> {
  const domain = input.domain?.trim() || requestDomain
  const config = await buildConfig(env, input, input.url)
  const tagNames = normalizeTagList(input.tags)
  const db = await getDb(env)
  const tagIds = await tagNamesToIds(db, tagNames, ownerId, createdBy)
  const baseValues: Omit<NewLink, 'slug'> = {
    id: newId(),
    domain,
    url: input.url,
    title: input.title ?? '',
    comment: input.comment ?? '',
    ownerId,
    createdBy,
    config,
    tags: tagIds,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    isDeleted: 0,
    updatedAt: new Date(),
  }

  const result = await insertLinkRow(env, domain, input, baseValues)
  if (!result.ok) return result

  // Hand back the link with display names and cache it.
  const link: Link = { ...result.link, tags: tagNames }
  await writeCache(env, link.domain, link.slug, link)
  return { ok: true, link }
}

// Insert the link row (random or user-supplied slug). The `tags` ID column is
// already part of `baseValues`; the returned link's `tags` is overwritten with
// display names by `createLink`.
async function insertLinkRow(
  env: CloudflareEnv,
  domain: string,
  input: CreateLinkInput,
  baseValues: Omit<NewLink, 'slug'>,
): Promise<RepoResult> {
  // No user-supplied slug → allocate a random one with collision retry.
  if (!input.slug?.trim()) {
    return insertWithRandomSlug(env, domain, baseValues)
  }

  // User-supplied slug: must be unique among active rows; a soft-deleted row
  // holding this slug is revived in place.
  const rawSlug = input.slug.trim()
  const slugError = validateSlug(rawSlug)
  if (slugError) return { ok: false, status: 400, error: `slug:${slugError}` }
  const slug = normalizeSlug(rawSlug, env)

  const existing = await findBySlugDomain(env, domain, slug)
  if (existing && existing.isDeleted === 0) {
    return { ok: false, status: 409, error: 'Slug already exists' }
  }

  const values: NewLink = {
    ...baseValues,
    id: existing?.id ?? baseValues.id,
    slug,
  }

  const db = await getDb(env)
  if (existing) {
    // Revive a soft-deleted row holding this slug.
    const row = (
      await db
        .update(links)
        .set(values)
        .where(eq(links.id, existing.id))
        .returning()
    )[0]!
    return { ok: true, link: { ...row, tags: [] } }
  }
  // Fresh insert: let the unique index arbitrate uniqueness atomically (no
  // check-then-insert race) — a concurrent create of the same (slug,domain)
  // that slipped past the pre-check surfaces as an empty returning array, which
  // we map to a clean 409 instead of a raw unique-constraint 500.
  const row = (
    await db.insert(links).values(values).onConflictDoNothing().returning()
  )[0]
  if (!row) return { ok: false, status: 409, error: 'Slug already exists' }
  return { ok: true, link: { ...row, tags: [] } }
}

export async function updateLink(
  env: CloudflareEnv,
  input: EditLinkInput,
  ownerId = '',
): Promise<RepoResult> {
  // Owner-scoped fetch: a cross-owner (or missing) id resolves to null → 404,
  // never 403, so existence isn't leaked.
  const current = await getLinkById(env, input.id, ownerId)
  if (!current) return { ok: false, status: 404, error: 'Link not found' }

  const domain = input.domain?.trim() || current.domain
  const rawSlug = input.slug?.trim() || current.slug
  const slugError = validateSlug(rawSlug)
  if (slugError) return { ok: false, status: 400, error: `slug:${slugError}` }
  const slug = normalizeSlug(rawSlug, env)

  const keyChanged = slug !== current.slug || domain !== current.domain
  if (keyChanged) {
    const clash = await findBySlugDomain(env, domain, slug)
    if (clash && clash.id !== current.id && clash.isDeleted === 0) {
      return { ok: false, status: 409, error: 'Slug already exists' }
    }
  }

  const config = await buildConfig(
    env,
    input,
    input.url ?? current.url,
    current.config,
  )
  // Omitted tags keep the current set; provided tags replace it. `current.tags`
  // is already names (getLinkById resolved them).
  const db = await getDb(env)
  const tagNames =
    input.tags === undefined ? current.tags : normalizeTagList(input.tags)
  const tagIds =
    input.tags === undefined
      ? undefined
      : await tagNamesToIds(db, tagNames, ownerId)
  // A concurrent writer may grab (slug,domain) between the `clash` pre-check and
  // this update; the unique index then throws rather than returning empty (the
  // INSERT-only `onConflictDoNothing` can't apply to UPDATE), so catch the
  // constraint violation and surface it as the same clean 409, not a raw 500.
  let row: LinkRow
  try {
    row = (
      await db
        .update(links)
        .set({
          slug,
          domain,
          url: input.url ?? current.url,
          title: input.title ?? current.title,
          comment: input.comment ?? current.comment,
          config,
          // Only rewrite the tag column when the caller supplied tags.
          ...(tagIds !== undefined ? { tags: tagIds } : {}),
          expiresAt:
            input.expiresAt === undefined
              ? current.expiresAt
              : input.expiresAt
                ? new Date(input.expiresAt)
                : null,
          updatedAt: new Date(),
        })
        .where(eq(links.id, current.id))
        .returning()
    )[0]!
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes('UNIQUE constraint failed')
    ) {
      return { ok: false, status: 409, error: 'Slug already exists' }
    }
    throw err
  }

  if (keyChanged) await purgeLink(env, current.domain, current.slug)
  const link: Link = { ...row, tags: tagNames }
  await writeCache(env, domain, slug, link)
  return { ok: true, link }
}

export async function upsertLink(
  env: CloudflareEnv,
  input: CreateLinkInput,
  requestDomain: string,
  ownerId = '',
  createdBy = '',
): Promise<RepoResult> {
  const domain = input.domain?.trim() || requestDomain
  const rawSlug = input.slug?.trim()
  if (rawSlug) {
    const existing = await findBySlugDomain(
      env,
      domain,
      normalizeSlug(rawSlug, env),
    )
    if (existing && existing.isDeleted === 0) {
      return updateLink(env, { ...input, id: existing.id }, ownerId)
    }
  }
  return createLink(env, input, requestDomain, ownerId, createdBy)
}

export async function deleteLink(
  env: CloudflareEnv,
  id: string,
  ownerId = '',
): Promise<RepoResult> {
  // Owner-scoped fetch: another owner's (or a missing) id → 404, not 403.
  const current = await getLinkById(env, id, ownerId)
  if (!current) return { ok: false, status: 404, error: 'Link not found' }
  const db = await getDb(env)
  await db
    .update(links)
    .set({ isDeleted: 1, updatedAt: new Date() })
    .where(eq(links.id, id))
  await purgeLink(env, current.domain, current.slug)
  return { ok: true, link: current }
}

export interface ImportReport {
  success: number
  skipped: number
  failed: number
  failedItems: { slug: string; reason: string }[]
}

// Batch sizing for import. D1 caps bound parameters at 100 per query. The
// per-chunk existence select binds up to IMPORT_CHUNK slugs plus the owner
// (`ownerId`) predicate, so it stays at 99 slugs (+1 owner = 100). Bulk
// inserts are split so rows × columns (14 incl. `ownerId`/`createdBy`/
// `createdAt`) stays under the cap.
const IMPORT_CHUNK = 99
const IMPORT_INSERT_BATCH = 7

// Non-destructive import: existing active (slug,domain) is skipped, a
// soft-deleted one is revived, otherwise inserted. Config (incl. passwordHash)
// and timestamps are preserved verbatim. Processed in chunks: one existence
// select and one tag-dictionary upsert per chunk, bulk inserts for new rows —
// only revived soft-deleted rows get a per-row update (their values differ).
export async function importLinks(
  env: CloudflareEnv,
  items: ImportLinkInput[],
  ownerId = '',
  createdBy = '',
): Promise<ImportReport> {
  const db = await getDb(env)
  const report: ImportReport = {
    success: 0,
    skipped: 0,
    failed: 0,
    failedItems: [],
  }
  // (domain,slug) keys already handled in this run. A later duplicate in the
  // same payload is skipped — same outcome as the old per-row lookup, which
  // saw the earlier occurrence as an existing active row.
  const seen = new Set<string>()
  const keyOf = (domain: string, slug: string) => `${domain}\n${slug}`

  for (let i = 0; i < items.length; i += IMPORT_CHUNK) {
    const chunk = items.slice(i, i + IMPORT_CHUNK)

    // Validate and normalize first so the chunk queries only cover viable rows.
    const pending: { item: ImportLinkInput; slug: string; domain: string }[] =
      []
    for (const item of chunk) {
      const domain = item.domain?.trim() || ''
      const rawSlug = item.slug.trim()
      const slugError = validateSlug(rawSlug)
      if (slugError) {
        report.failed++
        report.failedItems.push({ slug: rawSlug, reason: `slug:${slugError}` })
        continue
      }
      const slug = normalizeSlug(rawSlug, env)
      if (seen.has(keyOf(domain, slug))) {
        report.skipped++
        continue
      }
      seen.add(keyOf(domain, slug))
      pending.push({ item, slug, domain })
    }
    if (pending.length === 0) continue

    // One select per chunk: fetch every row (active or soft-deleted) OWNED BY
    // the importer holding any of the slugs, then match the domain in JS — the
    // unique index covers deleted rows too, so skip/revive must see them. The
    // owner filter is critical: a (slug,domain) owned by a different user must
    // stay invisible here so import never revives or overwrites their row —
    // it's treated as new and inserts a fresh owner-scoped row instead.
    const slugs = Array.from(new Set(pending.map((p) => p.slug)))
    const existingRows = await db
      .select()
      .from(links)
      .where(and(eq(links.ownerId, ownerId), inArray(links.slug, slugs)))
    const existingByKey = new Map(
      existingRows.map((r) => [keyOf(r.domain, r.slug), r]),
    )

    // One tag-dictionary upsert per chunk, then per-item name → id mapping.
    const tagNamesByItem = pending.map((p) => normalizeTagList(p.item.tags))
    const tagIdByName = await upsertTagIds(
      db,
      Array.from(new Set(tagNamesByItem.flat())),
      ownerId,
      createdBy,
    )

    const inserts: NewLink[] = []
    for (const [idx, { item, slug, domain }] of pending.entries()) {
      const existing = existingByKey.get(keyOf(domain, slug))
      if (existing && existing.isDeleted === 0) {
        report.skipped++
        continue
      }

      const values: NewLink = {
        // Always mint a fresh id for new rows — reusing the exported id would
        // collide with an existing PK when importing into a populated DB.
        id: existing?.id ?? newId(),
        slug,
        domain,
        url: item.url,
        title: item.title ?? '',
        comment: item.comment ?? '',
        // Owner stamp: revive can only reach the importer's own soft-deleted
        // rows (owner-scoped select above), and new rows must be owned by the
        // importer — scope by `ownerId` (user.id), keep `createdBy` (email) for
        // display; never leave `ownerId` at the schema default.
        ownerId,
        createdBy,
        config: (item.config ?? {}) as LinkConfig,
        tags: tagNamesByItem[idx]!.map((n) => tagIdByName.get(n)).filter(
          (id): id is string => !!id,
        ),
        expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
        isDeleted: 0,
        updatedAt: new Date(),
        ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}),
      }
      if (existing) {
        // Revive a soft-deleted row in place.
        await db.update(links).set(values).where(eq(links.id, existing.id))
        // Clear any negative-cache tombstone left by resolve.ts so the revived
        // slug isn't stuck 404-ing until the tombstone expires.
        await purgeLink(env, domain, slug)
      } else {
        inserts.push(values)
      }
      report.success++
    }

    for (let j = 0; j < inserts.length; j += IMPORT_INSERT_BATCH) {
      await db.insert(links).values(inserts.slice(j, j + IMPORT_INSERT_BATCH))
    }
    // Purge tombstones for freshly inserted rows too (same reason as revive).
    for (const row of inserts) {
      await purgeLink(env, row.domain ?? '', row.slug)
    }
  }
  return report
}
