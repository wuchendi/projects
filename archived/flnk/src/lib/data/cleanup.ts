import { and, eq, inArray, lt } from 'drizzle-orm'
import { links } from '@/database/schema'
import { visitsKey } from '@/lib/data/cache-keys'
import { getDb } from '@/lib/data/db'
import { linkCacheKey } from '@/lib/data/links'
import { logger } from '@/lib/platform/logger'

interface CleanupResult {
  deletedCount: number
  cacheCleanedCount: number
  errors: string[]
  executionTimeMs: number
}

// Max rows soft-deleted per run; the daily cadence drains the rest.
const CLEANUP_PAGE_SIZE = 500
// KV delete concurrency per chunk.
const KV_DELETE_CHUNK = 20

// Soft-delete expired links + purge their KV cache. Driven by the worker's
// `scheduled()` handler (cron "0 0 * * *").
export async function cleanupExpiredLinks(
  env: CloudflareEnv,
): Promise<CleanupResult> {
  const startedAt = Date.now()
  const result: CleanupResult = {
    deletedCount: 0,
    cacheCleanedCount: 0,
    errors: [],
    executionTimeMs: 0,
  }

  logger.info('Starting expired links cleanup')

  try {
    const db = await getDb(env)
    const now = new Date()

    // Bound the working set: page a fixed number of expired ids, soft-delete
    // only those, and let the daily cadence drain any remainder.
    const expired = await db
      .select({ id: links.id, domain: links.domain, slug: links.slug })
      .from(links)
      .where(and(eq(links.isDeleted, 0), lt(links.expiresAt, now)))
      .limit(CLEANUP_PAGE_SIZE)

    if (expired.length === 0) {
      result.executionTimeMs = Date.now() - startedAt
      logger.info('Soft-deleted 0 expired links')
      return result
    }

    await db
      .update(links)
      .set({ isDeleted: 1, updatedAt: now })
      .where(
        inArray(
          links.id,
          expired.map((link) => link.id),
        ),
      )

    result.deletedCount = expired.length
    logger.info(`Soft-deleted ${expired.length} expired links`)

    // Purge both the link cache key and the visits counter key for each row.
    for (let i = 0; i < expired.length; i += KV_DELETE_CHUNK) {
      const chunk = expired.slice(i, i + KV_DELETE_CHUNK)
      await Promise.all(
        chunk.map(async (link) => {
          try {
            await env.KV.delete(linkCacheKey(link.domain, link.slug))
            await env.KV.delete(visitsKey(link.id))
            result.cacheCleanedCount++
          } catch (error) {
            const msg = `Cache purge failed for ${link.id}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
            logger.warn(msg)
            result.errors.push(msg)
          }
        }),
      )
    }

    result.executionTimeMs = Date.now() - startedAt
    logger.info('Cleanup completed', JSON.stringify(result))
    return result
  } catch (error) {
    result.executionTimeMs = Date.now() - startedAt
    const msg = `Cleanup task failed: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`
    logger.error(msg)
    result.errors.push(msg)
    return result
  }
}
