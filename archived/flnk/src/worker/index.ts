// Custom Worker entry that wraps the opennextjs/cloudflare build output
// (`.open-next/worker.js`) and adds a `scheduled()` handler driven by
// `triggers.crons` in wrangler.jsonc.
//
// Build flow:
//   1. `opennextjs-cloudflare build` produces `.open-next/worker.js` + assets.
//   2. Wrangler bundles this file (esbuild) — it imports the built worker
//      to keep the Next.js fetch surface intact.
//   3. We add `scheduled` here so the cron entry point can run the cleanup
//      task without touching opennext's generated code.

import type {
  ExecutionContext,
  ExportedHandler,
  ExportedHandlerFetchHandler,
  ScheduledController,
} from '@cloudflare/workers-types'
import { backupToR2 } from '@/lib/data/backup'
import { cleanupExpiredLinks } from '@/lib/data/cleanup'
import { listCreators } from '@/lib/data/links/repo'
import { logger } from '@/lib/platform/logger'
// @ts-expect-error: artifact only exists after `opennextjs-cloudflare build`
import openNextWorker from '../../.open-next/worker.js'

interface NextWorker {
  fetch: ExportedHandlerFetchHandler<CloudflareEnv>
}

const worker = openNextWorker as NextWorker

export default {
  fetch: worker.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: CloudflareEnv,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // Forward `env` explicitly — opennext only installs the Cloudflare context
    // inside its fetch wrapper, so the cron path can't rely on
    // `getCloudflareContext()`.
    //
    // Order matters: back up BEFORE cleanup so links expiring today are still
    // `isDeleted=0` and get snapshotted. Each step is isolated in its own
    // try/catch so a failure in one doesn't abort the other or the whole run.
    try {
      // Daily R2 backup, one snapshot per owner under their own
      // `backups/<ownerSlug>/` prefix (no-op when R2 is not configured).
      // Per-owner isolation is preserved — the cron never dumps every owner's
      // links into a single shared object. One owner failing is logged and
      // skipped so the rest still get backed up.
      const owners = await listCreators(env)
      for (const owner of owners) {
        try {
          await backupToR2(env, owner)
        } catch (error) {
          logger.error(
            `Backup task failed for owner ${owner}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          )
        }
      }
    } catch (error) {
      logger.error(
        `Backup task failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }

    try {
      await cleanupExpiredLinks(env)
    } catch (error) {
      logger.error(
        `Cleanup task failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  },
} satisfies ExportedHandler<CloudflareEnv>
