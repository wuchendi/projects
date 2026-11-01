// Regional-indicator flag emoji from an ISO alpha-2 code ('US' → '🇺🇸').
export function flagEmoji(code: string): string | undefined {
  if (!/^[a-z]{2}$/i.test(code)) return undefined
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

// Human country name for an alpha-2 code, localized; falls back to the code
// (also covers non-country values like 'Unknown').
export function regionName(code: string, locale: string): string {
  if (!/^[a-z]{2}$/i.test(code)) return code
  try {
    return (
      new Intl.DisplayNames([locale], { type: 'region' }).of(
        code.toUpperCase(),
      ) ?? code
    )
  } catch {
    return code
  }
}
