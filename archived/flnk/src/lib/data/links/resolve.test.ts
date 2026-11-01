import { describe, expect, it, vi } from 'vitest'
import type { Link } from '@/database/schema'
import { visitsKey } from '@/lib/data/cache-keys'
import { visitLimitReached } from '@/lib/data/links/resolve'

// visitLimitReached only touches env.KV, ctx.waitUntil and the visits counter,
// so a couple of spies fully cover it — no DB / Cloudflare context needed.
function makeCtx() {
  const scheduled: Promise<unknown>[] = []
  return {
    scheduled,
    ctx: { waitUntil: (p: Promise<unknown>) => scheduled.push(p) },
  }
}

function makeEnv(count: number | null) {
  const put = vi.fn(async () => {})
  const del = vi.fn(async () => {})
  const env = {
    KV: {
      get: vi.fn(async () => (count === null ? null : String(count))),
      put,
      delete: del,
    },
  } as unknown as CloudflareEnv
  return { env, put, del }
}

const link = { id: 'abc', config: { maxVisits: 3 } } as unknown as Link

describe('visitLimitReached', () => {
  it('enforces the cap even when countVisit is false', async () => {
    const { env, put, del } = makeEnv(3)
    const { ctx } = makeCtx()
    const reached = await visitLimitReached(env, link, ctx, false)
    expect(reached).toBe(true)
    // Cap hit still schedules the counter delete, never an increment.
    expect(put).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledWith(visitsKey(link.id))
  })

  it('does not burn a visit when under the cap and countVisit is false', async () => {
    const { env, put } = makeEnv(1)
    const { ctx } = makeCtx()
    const reached = await visitLimitReached(env, link, ctx, false)
    expect(reached).toBe(false)
    expect(put).not.toHaveBeenCalled()
  })

  it('increments the counter when under the cap and countVisit is true', async () => {
    const { env, put } = makeEnv(1)
    const { ctx } = makeCtx()
    const reached = await visitLimitReached(env, link, ctx, true)
    expect(reached).toBe(false)
    expect(put).toHaveBeenCalledWith(visitsKey(link.id), '2')
  })
})
