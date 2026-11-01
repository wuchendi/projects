import { UAParser } from 'ua-parser-js'
import { isBot } from '@/lib/analytics/bots'
import { getConfig } from '@/lib/platform/env'
import { logger } from '@/lib/platform/logger'

interface AccessLog {
  slug: string
  url: string
  ua: string
  ip: string
  referer: string
  country: string
  region: string
  city: string
  timezone: string
  language: string
  os: string
  browser: string
  browserType: string
  device: string
  deviceType: string
  colo: string
  domain: string
  // 'qr' when the visit came from a styled QR (URL carries `?qr=1`), else
  // 'link' for a plain click.
  source: string
  // Entity kind for the data point: 'link' for a short-link redirect,
  // 'launchpad' for a `/m/<slug>` page view, 'launchpad_block' for a launchpad
  // block/button click. Append-only blob19 — legacy points lack it (read as '').
  type: string
  // Owner key that scopes the data point: both link points (link.ownerId) and
  // launchpad points (launchpad.ownerId) now carry the owner USER.ID — the two
  // entity families share a single unified owner key.
  // Append-only blob20 (last free AE slot) — legacy points lack it (read as '').
  owner: string
  latitude: number
  longitude: number
}

// Build the access-log record from the incoming request + Cloudflare metadata.
export function extractAccessLog(
  request: Request,
  slug: string,
  url: string,
  cf: IncomingRequestCfProperties | undefined,
  type = 'link',
  ownerKey = '',
): AccessLog {
  const ua = request.headers.get('user-agent') || ''
  const uaResult = new UAParser(ua).getResult()
  const props = cf ?? ({} as Partial<IncomingRequestCfProperties>)

  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0'

  const referer = request.headers.get('referer') || ''
  let refererHostname = 'direct'
  if (referer) {
    try {
      refererHostname = new URL(referer).hostname
    } catch {
      // keep 'direct' for unparseable referrers
    }
  }

  const language =
    (request.headers.get('accept-language') || '')
      .split(',')[0]
      ?.split('-')[0] || 'en'

  const source =
    new URL(request.url).searchParams.get('qr') === '1' ? 'qr' : 'link'

  return {
    slug,
    url,
    ua,
    ip,
    referer: refererHostname,
    country: props.country || 'Unknown',
    region: props.region || 'Unknown',
    city: props.city || 'Unknown',
    timezone: props.timezone || 'UTC',
    language,
    os: uaResult.os?.name || 'Unknown',
    browser: uaResult.browser?.name || 'Unknown',
    browserType: uaResult.browser?.type || 'browser',
    device: uaResult.device?.model || 'Unknown',
    deviceType: uaResult.device?.type || 'desktop',
    colo: props.colo || 'Unknown',
    domain: new URL(request.url).hostname,
    source,
    type,
    owner: ownerKey,
    latitude: Number(props.latitude) || 0,
    longitude: Number(props.longitude) || 0,
  }
}

// Resolve the secret pepper for the visitor-IP HMAC. Prefer the dedicated
// ANALYTICS_IP_SALT secret; when it is unset, derive a namespaced key from the
// (still secret) BETTER_AUTH_SECRET and warn — never key the hash off a public
// value, or the daily digest becomes an offline-recoverable IP.
function ipHashKeyMaterial(env: CloudflareEnv): string {
  const salt = getConfig(env).analyticsIpSalt
  if (salt) return salt
  logger.warn(
    'ANALYTICS_IP_SALT not set — deriving visitor-IP hash key from BETTER_AUTH_SECRET',
  )
  return `flnk:analytics-ip:v1:${env.BETTER_AUTH_SECRET ?? ''}`
}

// Daily-rotating visitor fingerprint: the raw IP never leaves the request —
// only hex(HMAC-SHA-256(`${ip}:${YYYY-MM-DD}`)) keyed by a secret pepper,
// truncated to 32 chars, is stored. Uniqueness holds within a UTC day, but
// without the pepper the digest cannot be reversed to an IP from public data.
async function anonymizeIp(env: CloudflareEnv, ip: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ipHashKeyMaterial(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${ip}:${day}`),
  )
  return Array.from(new Uint8Array(sig))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

// Write a single access-log data point to Analytics Engine. Failures never
// affect the redirect — they are logged and swallowed.
export async function writeAccessLog(
  env: CloudflareEnv,
  data: AccessLog,
): Promise<void> {
  if (!env.ANALYTICS) {
    logger.warn('Analytics Engine not configured — skipping access log')
    return
  }
  if (getConfig(env).disableBotAccessLog && isBot(data.ua)) {
    logger.debug('Bot traffic excluded from access log', data.ua)
    return
  }

  try {
    const visitorId = await anonymizeIp(env, data.ip)
    env.ANALYTICS.writeDataPoint({
      indexes: [data.owner],
      blobs: [
        data.slug,
        data.url,
        data.ua,
        visitorId,
        data.referer,
        data.country,
        data.region,
        data.city,
        data.timezone,
        data.language,
        data.os,
        data.browser,
        data.browserType,
        data.device,
        data.deviceType,
        data.colo,
        data.domain,
        data.source,
        data.type,
        data.owner,
      ],
      doubles: [data.latitude, data.longitude],
    })
  } catch (error) {
    logger.error(
      'Failed to write access log',
      error instanceof Error ? error.message : error,
    )
  }
}
