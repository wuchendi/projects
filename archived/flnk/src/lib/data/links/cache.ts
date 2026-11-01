import type { Link } from '@/database/schema'
import { linkKey } from '@/lib/data/cache-keys'
import { getConfig } from '@/lib/platform/env'
import { logger } from '@/lib/platform/logger'

// Negative-cache sentinel stored under the link cache key when a slug resolves
// to nothing. A real link is always serialized JSON ('{'…), so this marker can
// never be mistaken for one. A later create/import writes the real link under
// the SAME key, overwriting the tombstone in place — no separate invalidation
// needed.
const NEGATIVE_CACHE = '__miss__'

// KV cache key. Multi-domain links are namespaced by host so the same slug can
// point to different destinations per domain.
export function linkCacheKey(domain: string, slug: string): string {
  return linkKey(domain, slug)
}

// Three-state cache read: a Link (positive hit), 'negative' (tombstone hit —
// known not to exist, skip the DB), or null (not cached, fall through to DB).
export async function readCache(
  env: CloudflareEnv,
  domain: string,
  slug: string,
): Promise<Link | 'negative' | null> {
  try {
    const raw = await env.KV.get(linkCacheKey(domain, slug), 'text')
    if (raw === null) return null
    if (raw === NEGATIVE_CACHE) return 'negative'
    const parsed = JSON.parse(raw) as Link
    // The whole link row is serialized/parsed, so `ownerId` round-trips for free
    // once resolve provides it. KV entries written before the ownerId change lack
    // the field (parses as undefined); they self-heal within the 60s+ link cache
    // TTL as the row is re-read from D1 and rewritten — acceptable under the
    // clean analytics break.
    // JSON round-trips timestamps to strings — restore the Date shape.
    return {
      ...parsed,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
    }
  } catch (error) {
    logger.warn('KV read error', error instanceof Error ? error.message : error)
    return null
  }
}

// Write a short-TTL tombstone for a slug that resolved to nothing. No-op when
// disabled (TTL 0). A real create/import later overwrites this same key.
export async function writeNegativeCache(
  env: CloudflareEnv,
  domain: string,
  slug: string,
): Promise<void> {
  const ttl = getConfig(env).negativeCacheTtl
  if (ttl <= 0) return
  try {
    await env.KV.put(linkCacheKey(domain, slug), NEGATIVE_CACHE, {
      expirationTtl: Math.max(60, ttl),
    })
  } catch (error) {
    logger.warn(
      'KV write error',
      error instanceof Error ? error.message : error,
    )
  }
}

export async function writeCache(
  env: CloudflareEnv,
  domain: string,
  slug: string,
  link: Link,
): Promise<void> {
  // Skip caching a link that outlives its own KV entry's minimum TTL: KV floors
  // expirationTtl to 60s, so a link expiring sooner would linger as a stale hit
  // (served, then purged by the route's isExpired check). Let those fall through
  // to D1 — they're about to vanish anyway, so the traffic is negligible.
  if (link.expiresAt) {
    const remainingSec = Math.floor(
      (link.expiresAt.getTime() - Date.now()) / 1000,
    )
    if (remainingSec < 60) return
  }
  try {
    await env.KV.put(linkCacheKey(domain, slug), JSON.stringify(link), {
      expirationTtl: Math.max(60, getConfig(env).linkCacheTtl),
    })
  } catch (error) {
    logger.warn(
      'KV write error',
      error instanceof Error ? error.message : error,
    )
  }
}

export async function purgeLink(
  env: CloudflareEnv,
  domain: string,
  slug: string,
): Promise<void> {
  try {
    await env.KV.delete(linkCacheKey(domain, slug))
  } catch (error) {
    logger.warn(
      'KV delete error',
      error instanceof Error ? error.message : error,
    )
  }
}
