import { describe, expect, it } from 'vitest'
import { countersSql, sanitize } from '@/lib/analytics/analytics-query'

// dataset() reads getConfig defaults (no env needed); an empty env is enough to
// exercise the SQL string builders.
const env = {} as CloudflareEnv

describe('sanitize', () => {
  it('leaves normal values untouched', () => {
    expect(sanitize('en-US')).toBe('en-US')
    expect(sanitize('https://example.com/path')).toBe(
      'https://example.com/path',
    )
  })

  it('escapes single quotes so they cannot close the SQL literal', () => {
    expect(sanitize("a' OR '1'='1")).toBe("a\\' OR \\'1\\'=\\'1")
  })

  it('escapes backslashes before quotes (ClickHouse breakout)', () => {
    // A trailing backslash would otherwise escape the closing quote.
    expect(sanitize('x\\')).toBe('x\\\\')
    expect(sanitize("x\\'")).toBe("x\\\\\\'")
  })

  it('drops control characters', () => {
    expect(sanitize('a\x00b\x1fc\x7fd\te')).toBe('abcde')
  })
})

describe('whereClause owner scoping (via countersSql)', () => {
  it('always filters by blob20 for a scoped query', () => {
    const sql = countersSql(env, { filters: {}, ownerKey: 'user_abc' })
    expect(sql).toContain("blob20 = 'user_abc'")
  })

  it('sanitizes the ownerKey value', () => {
    const sql = countersSql(env, { filters: {}, ownerKey: "user_a'b" })
    expect(sql).toContain("blob20 = 'user_a\\'b'")
  })

  it('omits the owner filter only for an explicit unscoped query', () => {
    const sql = countersSql(env, { filters: {}, unscoped: true })
    expect(sql).not.toContain('blob20')
  })

  it('is fail-closed: omitting both ownerKey and unscoped is a type error and throws', () => {
    expect(() =>
      // @ts-expect-error — a scoped query MUST carry ownerKey; omitting owner
      // scope entirely is unrepresentable (the old fail-open all-tenants call).
      countersSql(env, { filters: {} }),
    ).toThrow()
  })
})

describe('whereClause lower-bound floor (via countersSql)', () => {
  it('clamps an endAt-only query to a lookback floor instead of scanning all history', () => {
    const endAt = 1_700_000_000_000
    const sql = countersSql(env, { filters: {}, ownerKey: 'user_abc', endAt })
    expect(sql).toContain(
      `timestamp <= toDateTime(${Math.floor(endAt / 1000)})`,
    )
    const floor = Math.floor(endAt / 1000) - 7 * 86400
    expect(sql).toContain(`timestamp >= toDateTime(${floor})`)
  })

  it('uses the explicit startAt lower bound when both bounds are given', () => {
    const startAt = 1_699_000_000_000
    const endAt = 1_700_000_000_000
    const sql = countersSql(env, {
      filters: {},
      ownerKey: 'user_abc',
      startAt,
      endAt,
    })
    expect(sql).toContain(
      `timestamp >= toDateTime(${Math.floor(startAt / 1000)})`,
    )
    expect(sql).not.toContain(
      `timestamp >= toDateTime(${Math.floor(endAt / 1000) - 7 * 86400})`,
    )
  })

  it('falls back to the 7-day relative default when no range is given', () => {
    const sql = countersSql(env, { filters: {}, ownerKey: 'user_abc' })
    expect(sql).toContain(`timestamp >= now() - INTERVAL '7' DAY`)
  })
})
