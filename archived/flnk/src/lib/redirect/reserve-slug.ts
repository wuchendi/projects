// Slugs that must never be treated as short links — they belong to the app
// itself (dashboard, API, Next internals, static assets). The redirect engine
// checks this before any DB lookup so these paths fall through to Next routing.
const RESERVED = new Set([
  'dashboard',
  'api',
  'm',
  '_next',
  '_vercel',
  'assets',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  'opengraph-image',
  'twitter-image',
  'apple-icon',
  'icon',
])

export function isReservedSlug(slug: string): boolean {
  if (!slug) return true
  if (RESERVED.has(slug.toLowerCase())) return true
  // Anything that looks like a file (has an extension) is a static asset.
  if (slug.includes('.')) return true
  return false
}
