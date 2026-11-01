import { describe, expect, it } from 'vitest'
import { escapeCsvCell } from '@/lib/format/csv'

describe('escapeCsvCell', () => {
  it('neutralizes formula-injection prefixes with a leading quote', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1")
    expect(escapeCsvCell('+cmd')).toBe("'+cmd")
    expect(escapeCsvCell('-2')).toBe("'-2")
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(escapeCsvCell('\tstart')).toBe("'\tstart")
    // CR both triggers the leading-quote guard and forces quote-wrapping.
    expect(escapeCsvCell('\rstart')).toBe('"\'\rstart"')
  })

  it('leaves normal cells unchanged', () => {
    expect(escapeCsvCell('hello')).toBe('hello')
    expect(escapeCsvCell('123')).toBe('123')
    expect(escapeCsvCell(42)).toBe('42')
  })

  it('renders null/undefined as empty', () => {
    expect(escapeCsvCell(null)).toBe('')
    expect(escapeCsvCell(undefined)).toBe('')
  })

  it('quotes and doubles embedded quotes/commas/newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"')
  })
})
