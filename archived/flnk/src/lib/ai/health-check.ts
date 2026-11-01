import { safeBrowsingHost } from '@/lib/ai/safe-browsing'
import { getConfig } from '@/lib/platform/env'

const TIMEOUT_MS = 5000
const CONCURRENCY = 5
// Hard cap — this endpoint fetches user-stored destination URLs server-side
// (SSRF/abuse surface), so the batch size is bounded in addition to the
// site-token gate, per-request timeout, and bounded concurrency. Each id costs
// up to two outbound subrequests (reachability fetch + Safe Browsing DoH), so
// the cap keeps worst-case fan-out (≈40) under the Workers free 50-subrequest
// limit.
export const MAX_LINKS = 20

export interface CheckTarget {
  id: string
  slug: string
  url: string
}

export interface CheckResult extends CheckTarget {
  status: number | null
  ok: boolean
  // Round-trip time of the reachability fetch, in milliseconds.
  duration: number
  error?: string
  // null when Safe Browsing (DoH) is not configured.
  unsafe: boolean | null
}

// Parse an IPv4 literal given in any inet_aton-style encoding — dotted-decimal,
// octal (`0177`), hex (`0x7f`), a bare 32-bit integer (`2130706433`), or the
// short 1-3 part forms where the final part absorbs the low-order bytes — into
// its unsigned 32-bit value, or null when `s` is not an IPv4 literal. Alternate
// encodings are an SSRF bypass (`2130706433` and `0x7f.0.0.1` both == 127.0.0.1),
// so they must be canonicalized before range-checking.
function parseIPv4ToInt(s: string): number | null {
  const parts = s.split('.')
  if (parts.length === 0 || parts.length > 4) return null
  const nums: number[] = []
  for (const p of parts) {
    let n: number
    if (/^0x[0-9a-f]+$/u.test(p)) n = parseInt(p.slice(2), 16)
    else if (/^0[0-7]*$/u.test(p))
      n = parseInt(p, 8) // leading-zero octal incl. "0"
    else if (/^[1-9][0-9]*$/u.test(p)) n = Number(p)
    else return null
    if (!Number.isInteger(n) || n < 0) return null
    nums.push(n)
  }
  const last = nums.length - 1
  // Every part but the last is a single byte.
  for (let i = 0; i < last; i++) {
    if (nums[i] > 0xff) return null
  }
  // The final part fills the remaining bytes.
  if (nums[last] >= 2 ** (8 * (4 - last))) return null
  let value = nums[last]
  for (let i = 0; i < last; i++) {
    value += nums[i] * 2 ** (8 * (4 - 1 - i))
  }
  return value >>> 0
}

// Extract the embedded IPv4 from an IPv4-mapped IPv6 host (`::ffff:a.b.c.d` or
// the hex form `::ffff:a9fe:a9fe`), or null when `h` is not such an address.
function mappedIPv4ToInt(h: string): number | null {
  const m = h.match(/^::ffff:(.+)$/u)
  if (!m) return null
  const tail = m[1]
  if (tail.includes('.')) return parseIPv4ToInt(tail)
  const hx = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u)
  if (!hx) return null
  return ((parseInt(hx[1], 16) << 16) + parseInt(hx[2], 16)) >>> 0
}

function isBlockedIPv4(value: number): boolean {
  const a = value >>> 24
  const b = (value >>> 16) & 0xff
  if (a === 0 || a === 127 || a === 10) return true // unspecified, loopback, private
  if (a === 169 && b === 254) return true // link-local incl. 169.254.169.254 metadata
  if (a === 192 && b === 168) return true // private
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  return false
}

// SSRF guard. The deployed Worker also runs with the `global_fetch_strictly_public`
// compat flag (blocks private/internal/DNS-rebound targets at the platform
// level), but local dev / preview use Node fetch which does not — so validate
// here too. Literal-host checks can't catch a public name resolving to a private
// IP; the platform flag covers that case in production.
export function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  ) {
    return true
  }
  // Canonicalize any IPv4 encoding (dotted/octal/hex/integer) or an
  // IPv4-mapped IPv6 address to its 32-bit value, then range-check.
  const v4 = parseIPv4ToInt(h) ?? mappedIPv4ToInt(h)
  if (v4 !== null && isBlockedIPv4(v4)) return true
  // IPv6 unspecified / loopback / link-local / unique-local
  if (
    h === '::' ||
    h === '::1' ||
    h.startsWith('fe80:') ||
    h.startsWith('fc') ||
    h.startsWith('fd')
  ) {
    return true
  }
  return false
}

function validateFetchUrl(raw: string): URL | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password) return null // reject userinfo
  if (isBlockedHostname(u.hostname)) return null
  return u
}

async function fetchStatus(
  url: string,
  timeoutMs: number,
): Promise<{
  status: number | null
  ok: boolean
  duration: number
  error?: string
}> {
  const startedAt = Date.now()
  const valid = validateFetchUrl(url)
  if (!valid) return { status: null, ok: false, duration: 0, error: 'blocked' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    // `redirect: 'manual'` so we never auto-follow a 3xx into an internal host;
    // a redirect counts as reachable (ok) without chasing the Location.
    const res = await fetch(valid.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    })
    // Only the status matters — cancel the body so we never download it.
    await res.body?.cancel().catch(() => {})
    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 400,
      duration: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      status: null,
      ok: false,
      duration: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'fetch failed',
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function runHealthCheck(
  env: CloudflareEnv,
  targets: CheckTarget[],
  timeoutMs: number = TIMEOUT_MS,
): Promise<CheckResult[]> {
  const doh = getConfig(env).safeBrowsingDoh
  const queue = [...targets]
  const results: CheckResult[] = []

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const target = queue.shift()!
      const { status, ok, duration, error } = await fetchStatus(
        target.url,
        timeoutMs,
      )
      let unsafe: boolean | null = null
      if (doh) {
        try {
          unsafe = await safeBrowsingHost(doh, new URL(target.url).hostname)
        } catch {
          unsafe = null
        }
      }
      results.push({ ...target, status, ok, duration, error, unsafe })
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () =>
      worker(),
    ),
  )
  return results
}
