import { describe, expect, it } from 'vitest'
import { isBlockedHostname } from '@/lib/ai/health-check'

describe('isBlockedHostname', () => {
  it('blocks localhost and internal suffixes', () => {
    expect(isBlockedHostname('localhost')).toBe(true)
    expect(isBlockedHostname('foo.localhost')).toBe(true)
    expect(isBlockedHostname('svc.local')).toBe(true)
    expect(isBlockedHostname('db.internal')).toBe(true)
  })

  it('blocks loopback / private / link-local IPv4', () => {
    expect(isBlockedHostname('127.0.0.1')).toBe(true)
    expect(isBlockedHostname('10.0.0.1')).toBe(true)
    expect(isBlockedHostname('192.168.1.1')).toBe(true)
    expect(isBlockedHostname('172.16.0.1')).toBe(true)
    expect(isBlockedHostname('169.254.169.254')).toBe(true)
  })

  // SEC-11: alternate encodings + CGNAT + mapped IPv6 must all canonicalize.
  it('blocks CGNAT 100.64.0.0/10 (SEC-11)', () => {
    expect(isBlockedHostname('100.64.0.1')).toBe(true)
    expect(isBlockedHostname('100.127.255.255')).toBe(true)
  })

  it('blocks IPv4-mapped IPv6 metadata address (SEC-11)', () => {
    expect(isBlockedHostname('::ffff:169.254.169.254')).toBe(true)
    expect(isBlockedHostname('[::ffff:169.254.169.254]')).toBe(true)
    // hex tail form of the same address
    expect(isBlockedHostname('::ffff:a9fe:a9fe')).toBe(true)
  })

  it('blocks octal-encoded loopback (SEC-11)', () => {
    expect(isBlockedHostname('0177.0.0.1')).toBe(true)
  })

  it('blocks integer-encoded loopback (SEC-11)', () => {
    expect(isBlockedHostname('2130706433')).toBe(true)
  })

  it('allows a normal public host', () => {
    expect(isBlockedHostname('example.com')).toBe(false)
    expect(isBlockedHostname('8.8.8.8')).toBe(false)
    expect(isBlockedHostname('93.184.216.34')).toBe(false)
  })
})
