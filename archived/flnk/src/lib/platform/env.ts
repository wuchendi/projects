import { getCloudflareContext } from '@opennextjs/cloudflare'
import * as z from 'zod'
import { logger } from '@/lib/platform/logger'

// Resolved, typed view of the env flags wired in wrangler.jsonc. Reading goes
// through here so defaults live in one place and every call site is consistent.
export interface FlnkConfig {
  redirectStatusCode: number
  linkCacheTtl: number
  // Negative-cache TTL (seconds) for resolved-to-nothing slugs. Blocks cache
  // penetration from repeated lookups of non-existent slugs. 0 disables it;
  // any positive value is floored to KV's 60s minimum.
  negativeCacheTtl: number
  // Per-IP rate limiting on the /[slug] resolve path (Cloudflare native
  // Rate Limiting binding). Default true; set false to disable enforcement
  // without redeploying code. Always fails open when the binding is absent.
  resolveRateLimitEnabled: boolean
  redirectWithQuery: boolean
  homeURL: string
  notFoundRedirect: string
  caseSensitive: boolean
  slugDefaultLength: number
  listQueryLimit: number
  dataset: string
  disableBotAccessLog: boolean
  aiModel: string
  aiPrompt: string
  aiOgPrompt: string
  // Analytics Engine SQL API credentials (required only for the stats endpoints).
  cfAccountId: string
  cfApiToken: string
  // DoH endpoint for Safe Browsing checks (empty = disabled). A filtering
  // resolver (e.g. https://family.cloudflare-dns.com/dns-query) returns
  // 0.0.0.0 for blocked hosts.
  safeBrowsingDoh: string
  // Sign-in email allow-list (comma-separated, case-insensitive; normalized to
  // lowercase here). Empty = any Google/GitHub account may sign in.
  allowedEmails: string[]
  // Secret pepper for the daily visitor-IP HMAC (never a generated key). Empty
  // = fall back to a key derived from BETTER_AUTH_SECRET; never a public salt.
  analyticsIpSalt: string
}

// Env vars wired in wrangler.jsonc that aren't part of the generated
// CloudflareEnv type — declared here so their reads are typed instead of going
// through an untyped loose cast.
interface ExtraEnv {
  RESOLVE_RATE_LIMIT_ENABLED?: string
  AI_OG_PROMPT?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_API_TOKEN?: string
  SAFE_BROWSING_DOH?: string
  ALLOWED_EMAILS?: string
  ANALYTICS_IP_SALT?: string
}

// Merged env view: generated bindings/vars plus the extra vars above. Binding
// types (DB, KV, …) are preserved so consumers like db.ts read them typed.
export type ResolvedEnv = CloudflareEnv & ExtraEnv

// Zod shape mirroring FlnkConfig — the parsed config is validated once so a
// malformed construction fails loudly rather than flowing through as garbage.
const configSchema = z.object({
  redirectStatusCode: z.number(),
  linkCacheTtl: z.number(),
  negativeCacheTtl: z.number(),
  resolveRateLimitEnabled: z.boolean(),
  redirectWithQuery: z.boolean(),
  homeURL: z.string(),
  notFoundRedirect: z.string(),
  caseSensitive: z.boolean(),
  slugDefaultLength: z.number(),
  listQueryLimit: z.number(),
  dataset: z.string(),
  disableBotAccessLog: z.boolean(),
  aiModel: z.string(),
  aiPrompt: z.string(),
  aiOgPrompt: z.string(),
  cfAccountId: z.string(),
  cfApiToken: z.string(),
  safeBrowsingDoh: z.string(),
  allowedEmails: z.array(z.string()),
  analyticsIpSalt: z.string(),
})

function num(key: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) {
    logger.warn(
      `Invalid number for ${key}="${value}", using fallback ${fallback}`,
    )
    return fallback
  }
  return n
}

function bool(
  key: string,
  value: string | undefined,
  fallback = false,
): boolean {
  if (value === undefined || value === '') return fallback
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  logger.warn(
    `Invalid boolean for ${key}="${value}", using fallback ${fallback}`,
  )
  return fallback
}

// Resolve raw env with three-tier precedence: explicit `env` arg (cron/worker
// scheduled path), then the fetch-time Cloudflare context, then process.env
// (dev / build / Node test). Higher tiers win per key, so a partially-injected
// env still falls back for anything it omits.
export function resolveRawEnv(env?: CloudflareEnv): ResolvedEnv {
  const merged: Record<string, unknown> = {
    ...(process.env as Record<string, unknown>),
  }
  try {
    Object.assign(
      merged,
      getCloudflareContext().env as unknown as Record<string, unknown>,
    )
  } catch {
    // No Cloudflare context (dev / build / Node test) — process.env only.
  }
  if (env) Object.assign(merged, env as unknown as Record<string, unknown>)
  return merged as unknown as ResolvedEnv
}

let cachedConfig: FlnkConfig | undefined

// Parsed once per isolate and memoized — env is stable for the isolate's
// lifetime, so re-parsing on every hot-path call is wasted work.
export function getConfig(env?: CloudflareEnv): FlnkConfig {
  if (cachedConfig) return cachedConfig

  const raw = resolveRawEnv(env)

  const parsed: FlnkConfig = {
    redirectStatusCode: num(
      'REDIRECT_STATUS_CODE',
      raw.REDIRECT_STATUS_CODE,
      308,
    ),
    linkCacheTtl: num('LINK_CACHE_TTL', raw.LINK_CACHE_TTL, 60),
    negativeCacheTtl: num('NEGATIVE_CACHE_TTL', raw.NEGATIVE_CACHE_TTL, 60),
    resolveRateLimitEnabled: bool(
      'RESOLVE_RATE_LIMIT_ENABLED',
      raw.RESOLVE_RATE_LIMIT_ENABLED,
      true,
    ),
    redirectWithQuery: bool('REDIRECT_WITH_QUERY', raw.REDIRECT_WITH_QUERY),
    homeURL: raw.HOME_URL ?? '',
    notFoundRedirect: raw.NOT_FOUND_REDIRECT ?? '',
    caseSensitive: bool('CASE_SENSITIVE', raw.CASE_SENSITIVE),
    slugDefaultLength: num('SLUG_DEFAULT_LENGTH', raw.SLUG_DEFAULT_LENGTH, 6),
    listQueryLimit: num('LIST_QUERY_LIMIT', raw.LIST_QUERY_LIMIT, 500),
    dataset: raw.DATASET ?? 'flnk_analytics',
    disableBotAccessLog: bool(
      'DISABLE_BOT_ACCESS_LOG',
      raw.DISABLE_BOT_ACCESS_LOG,
    ),
    aiModel: raw.AI_MODEL ?? '@cf/meta/llama-3.1-8b-instruct',
    aiPrompt: raw.AI_PROMPT ?? '',
    aiOgPrompt: raw.AI_OG_PROMPT ?? '',
    cfAccountId: raw.CLOUDFLARE_ACCOUNT_ID ?? '',
    cfApiToken: raw.CLOUDFLARE_API_TOKEN ?? '',
    safeBrowsingDoh: raw.SAFE_BROWSING_DOH ?? '',
    allowedEmails: (raw.ALLOWED_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    analyticsIpSalt: raw.ANALYTICS_IP_SALT ?? '',
  }

  cachedConfig = configSchema.parse(parsed)
  return cachedConfig
}
