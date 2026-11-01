// CSV generation with formula-injection guarding and a UTF-8 BOM for Excel.
export function escapeCsvCell(value: unknown): string {
  let text = String(value ?? '')
  // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR leading char).
  const first = text.charCodeAt(0)
  if (
    text.length > 0 &&
    (text[0] === '=' ||
      text[0] === '+' ||
      text[0] === '-' ||
      text[0] === '@' ||
      first === 9 ||
      first === 13)
  ) {
    text = `'${text}`
  }
  if (
    text.includes('"') ||
    text.includes(',') ||
    text.includes('\n') ||
    text.includes('\r')
  ) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function generateCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ]
  return `\uFEFF${lines.join('\n')}\n`
}
