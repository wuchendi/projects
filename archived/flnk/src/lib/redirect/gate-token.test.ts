import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGateToken, verifyGateToken } from '@/lib/redirect/gate-token'

const env = {
  BETTER_AUTH_SECRET: 'test-secret-do-not-use-in-prod',
} as unknown as CloudflareEnv

const SLUG = 'promo'
const IP = '203.0.113.7'

afterEach(() => {
  vi.useRealTimers()
})

describe('gate-token', () => {
  it('verifies a freshly created token (happy path)', async () => {
    const token = await createGateToken(env, SLUG, IP)
    expect(await verifyGateToken(env, SLUG, IP, token)).toBe(true)
  })

  it('rejects a tampered signature', async () => {
    const token = await createGateToken(env, SLUG, IP)
    // Flip the final hex nibble of the signature.
    const last = token.at(-1) === '0' ? '1' : '0'
    const tampered = token.slice(0, -1) + last
    expect(await verifyGateToken(env, SLUG, IP, tampered)).toBe(false)
  })

  it('rejects a token replayed from a different IP', async () => {
    const token = await createGateToken(env, SLUG, IP)
    expect(await verifyGateToken(env, SLUG, '198.51.100.9', token)).toBe(false)
  })

  it('rejects a token for a different slug', async () => {
    const token = await createGateToken(env, SLUG, IP)
    expect(await verifyGateToken(env, 'other', IP, token)).toBe(false)
  })

  it('rejects an expired token', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'))
    const token = await createGateToken(env, SLUG, IP)
    // Advance past the 5-minute TTL.
    vi.setSystemTime(new Date('2020-01-01T00:06:00Z'))
    expect(await verifyGateToken(env, SLUG, IP, token)).toBe(false)
  })

  it('rejects malformed tokens', async () => {
    expect(await verifyGateToken(env, SLUG, IP, 'garbage')).toBe(false)
    expect(await verifyGateToken(env, SLUG, IP, '')).toBe(false)
  })
})
