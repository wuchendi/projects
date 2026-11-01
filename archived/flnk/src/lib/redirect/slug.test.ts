import { describe, expect, it } from 'vitest'
import { validateSlug } from '@/lib/redirect/slug'

describe('validateSlug', () => {
  it('returns null for valid slugs', () => {
    expect(validateSlug('hello')).toBeNull()
    expect(validateSlug('my-cool-link')).toBeNull()
    expect(validateSlug('AbC-123')).toBeNull()
  })

  it('rejects empty input', () => {
    expect(validateSlug('')).toBe('empty')
  })

  it('rejects slugs over the length cap', () => {
    expect(validateSlug('a'.repeat(2049))).toBe('too_long')
  })

  it('rejects malformed slugs', () => {
    expect(validateSlug('has space')).toBe('format')
    expect(validateSlug('-leading')).toBe('format')
    expect(validateSlug('under_score')).toBe('format')
    // dots are not in the slug grammar → rejected by the format check
    expect(validateSlug('file.txt')).toBe('format')
  })

  it('rejects reserved slugs', () => {
    expect(validateSlug('dashboard')).toBe('reserved')
    expect(validateSlug('api')).toBe('reserved')
  })
})
