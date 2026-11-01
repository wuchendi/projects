import type { Locale } from 'date-fns'
import { format } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import type { LinkConfig } from '@/database/schema'
import type { LogEvent } from '@/lib/platform/api'

const DATE_LOCALES: Record<string, Locale> = { en: enUS, zh: zhCN }

// Map an app locale code to a date-fns locale, defaulting to English.
export function dateLocale(locale: string): Locale {
  return DATE_LOCALES[locale] ?? enUS
}

// True for loopback / dev hosts that should never be rendered as a public
// `https://…` short link (single-domain deploys store the request host as the
// link's domain, which in local dev is `localhost` / `flnk.localhost`).
function isLocalHost(domain: string): boolean {
  const host = domain.replace(/:\d+$/u, '').toLowerCase()
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1'
  )
}

// Full short URL for a link. Uses the link's explicit domain for real
// multi-domain links, but falls back to the current browser origin (correct
// scheme + port) when there is no domain or the stored domain is a local/dev
// host — otherwise dev links render as the unreachable `https://localhost/<slug>`.
export function buildShortUrl(slug: string, domain: string): string {
  if (domain && !isLocalHost(domain)) return `https://${domain}/${slug}`
  if (typeof window !== 'undefined') return `${window.location.origin}/${slug}`
  return `/${slug}`
}

// Public URL for a launchpad's `/m/<slug>` page. Single-domain deploy, so the
// current browser origin is the host (falls back to a relative path on the
// server).
export function buildLaunchpadUrl(slug: string): string {
  if (typeof window !== 'undefined')
    return `${window.location.origin}/m/${slug}`
  return `/m/${slug}`
}

export function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  return format(new Date(value), 'PP', { locale: dateLocale(locale) })
}

// Locale-aware thousands grouping for counts.
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

// Stable dedup key for a realtime log event.
export const eventKey = (e: LogEvent) =>
  `${e.timestamp}-${e.slug}-${e.city}-${e.browser}-${e.os}`

// AE returns UTC "YYYY-MM-DD HH:MM:SS"; render as local time.
export function localTime(ts: string, locale: string): string {
  const d = new Date(`${ts.replace(' ', 'T')}Z`)
  return Number.isNaN(d.getTime())
    ? ts
    : format(d, 'HH:mm', { locale: dateLocale(locale) })
}

// Short human summary of the advanced routing a link carries, for the table.
export function configBadges(config: LinkConfig): string[] {
  const out: string[] = []
  if (config.passwordHash) out.push('password')
  if (config.geo && Object.keys(config.geo).length) out.push('geo')
  if (config.apple || config.google) out.push('device')
  if (config.unsafe) out.push('unsafe')
  if (config.cloaking) out.push('cloaking')
  return out
}
