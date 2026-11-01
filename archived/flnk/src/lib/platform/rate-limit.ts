import { pwfailKey } from '@/lib/data/cache-keys'
import { logger } from '@/lib/platform/logger'

// Brute-force gate for password-protected links: a KV fixed-window failure
// counter keyed by client IP + slug. KV floors expirationTtl at 60s.
const MAX_FAILURES = 5
const WINDOW_TTL_SECONDS = 600

// Sentinel for requests without a `cf-connecting-ip` header (local dev,
// non-Cloudflare proxies). Rate limiting fails open for it — a shared bucket
// would let unrelated clients exhaust each other's attempts.
const UNKNOWN_IP = 'unknown'

function failureKey(ip: string, slug: string): string {
  return pwfailKey(ip, slug)
}

export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') || UNKNOWN_IP
}

// True when this IP has exhausted its failed attempts for the slug. KV errors
// fail open (log + allow) — availability over strictness.
export async function passwordAttemptsExceeded(
  env: CloudflareEnv,
  ip: string,
  slug: string,
): Promise<boolean> {
  if (ip === UNKNOWN_IP) return false
  try {
    const raw = await env.KV.get(failureKey(ip, slug))
    return Number(raw ?? 0) >= MAX_FAILURES
  } catch (error) {
    logger.warn('KV read error', error instanceof Error ? error.message : error)
    return false
  }
}

// Increment the failure counter; each write refreshes the window TTL. The
// counter is never reset on success — the window simply expires.
export async function recordPasswordFailure(
  env: CloudflareEnv,
  ip: string,
  slug: string,
): Promise<void> {
  if (ip === UNKNOWN_IP) return
  const key = failureKey(ip, slug)
  try {
    const raw = await env.KV.get(key)
    const count = Number(raw ?? 0) + 1
    await env.KV.put(key, String(count), { expirationTtl: WINDOW_TTL_SECONDS })
  } catch (error) {
    logger.warn(
      'KV write error',
      error instanceof Error ? error.message : error,
    )
  }
}

// Generic per-user/IP KV fixed-window limiter, sharing the same approach as the
// password gate above. Combined check-and-increment: reads the current window
// counter for `namespace`+`identity`, returns true (reject) when it is already
// at `limit`, otherwise increments it and refreshes the window TTL. KV errors
// and the UNKNOWN_IP sentinel fail open (allow) — availability over strictness.
export async function checkRateLimit(
  env: CloudflareEnv,
  namespace: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (identity === UNKNOWN_IP) return false
  const key = `ratelimit:${namespace}:${identity}`
  try {
    const raw = await env.KV.get(key)
    const count = Number(raw ?? 0)
    if (count >= limit) return true
    await env.KV.put(key, String(count + 1), { expirationTtl: windowSeconds })
    return false
  } catch (error) {
    logger.warn(
      'KV rate-limit error',
      error instanceof Error ? error.message : error,
    )
    return false
  }
}
