// Central registry of KV key builders. These strings address live KV entries —
// the produced format must stay byte-identical (`link:{domain}:{slug}`,
// `visits:{id}`, `pwfail:{ip}:{slug}`) or existing entries are orphaned. Change
// a format only with a coordinated migration.

// Per-domain link cache key. Multi-domain links are namespaced by host so the
// same slug can point to different destinations per domain.
export function linkKey(domain: string, slug: string): string {
  return `link:${domain}:${slug}`
}

// Visit-counter key for a link's click-limit gate.
export function visitsKey(id: string): string {
  return `visits:${id}`
}

// Password brute-force failure-counter key, per client IP + slug.
export function pwfailKey(ip: string, slug: string): string {
  return `pwfail:${ip}:${slug}`
}
