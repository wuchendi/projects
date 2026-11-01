import type { Link } from '@/database/schema'
import type { Locale } from '@/i18n/config'
import { defaultLocale, localeCookieName, locales } from '@/i18n/config'
import { getConfig } from '@/lib/platform/env'

// Resolve the UI locale for server-rendered interstitials (password / unsafe
// pages) from the `NEXT_LOCALE` cookie first, then `Accept-Language`, matching
// the dashboard's locale selection. Falls back to the default locale.
export function resolveRedirectLocale(request: Request): Locale {
  const match = (tag: string): Locale | undefined =>
    locales.find(
      (l) => tag === l || tag.startsWith(`${l}-`) || tag.startsWith(l),
    )

  const cookie = request.headers.get('cookie') ?? ''
  const cookieMatch = cookie.match(
    new RegExp(`(?:^|; )${localeCookieName}=([^;]+)`),
  )
  if (cookieMatch?.[1]) {
    const hit = match(decodeURIComponent(cookieMatch[1]).toLowerCase())
    if (hit) return hit
  }

  const accept = (request.headers.get('accept-language') ?? '').toLowerCase()
  for (const part of accept.split(',')) {
    const tag = part.split(';')[0]?.trim()
    if (tag) {
      const hit = match(tag)
      if (hit) return hit
    }
  }

  return defaultLocale
}

// iOS devices only — desktop macOS must NOT match, or a Mac visitor would be
// sent to a link's App Store URL. `crios` covers Chrome on iOS.
const APPLE_UA = /iphone|ipad|ipod|crios/i
const ANDROID_UA = /android/i

export function isAppleDevice(ua: string): boolean {
  return APPLE_UA.test(ua)
}

export function isAndroidDevice(ua: string): boolean {
  return ANDROID_UA.test(ua)
}

// Re-exported for existing importers; the list now lives in `@/lib/analytics/bots` as a
// union with the analytics bot patterns.
export { isSocialCrawler } from '@/lib/analytics/bots'

// Resolve the final destination for a link, applying geo + device routing and
// optional query-string forwarding. `country` comes from `request.cf.country`.
export function resolveDestination(
  link: Link,
  opts: {
    ua: string
    country: string | undefined
    search: string
    env: CloudflareEnv
  },
): string {
  const { config } = link
  let dest = link.url

  if (config.geo && opts.country && config.geo[opts.country]) {
    dest = config.geo[opts.country]
  }
  if (config.apple && isAppleDevice(opts.ua)) {
    dest = config.apple
  }
  if (config.google && isAndroidDevice(opts.ua)) {
    dest = config.google
  }

  const withQuery =
    config.redirectWithQuery ?? getConfig(opts.env).redirectWithQuery
  if (withQuery && opts.search) {
    try {
      const target = new URL(dest)
      const incoming = new URLSearchParams(opts.search)
      // Drop the scan marker — it's an analytics signal, not part of the
      // destination.
      incoming.delete('qr')
      incoming.forEach((value, key) => {
        if (!target.searchParams.has(key))
          target.searchParams.append(key, value)
      })
      dest = target.toString()
    } catch {
      // dest isn't a parseable absolute URL — leave it untouched.
    }
  }

  return dest
}
