import { getConfig } from '@/lib/platform/env'
import { isReservedSlug } from '@/lib/redirect/reserve-slug'

// Slug grammar: lowercase/uppercase alnum groups joined by single hyphens.
// No dots (those are treated as static assets).
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i

// Unambiguous alphabet for generated slugs (no 0/o/1/l/i to avoid confusion).
const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

// Generate a random slug of `length` chars from the unambiguous alphabet.
export function randomSlug(length: number): string {
  const n = Math.max(1, length)
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  let out = ''
  for (let i = 0; i < n; i++) {
    out += SLUG_ALPHABET[bytes[i]! % SLUG_ALPHABET.length]
  }
  return out
}

// Default slug length from config (SLUG_DEFAULT_LENGTH, default 6).
export function defaultSlug(env?: CloudflareEnv): string {
  return randomSlug(getConfig(env).slugDefaultLength)
}

export type SlugError = 'empty' | 'format' | 'reserved' | 'too_long'

// Validate a user-supplied slug. Returns null when valid, else an error code.
export function validateSlug(slug: string): SlugError | null {
  if (!slug) return 'empty'
  if (slug.length > 2048) return 'too_long'
  if (!SLUG_REGEX.test(slug)) return 'format'
  if (isReservedSlug(slug)) return 'reserved'
  return null
}
