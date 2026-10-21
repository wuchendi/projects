import type { VariantStream } from './video-utils'
import { applyURL } from './video-utils'

export const isMasterPlaylist = (m3u8Str: string): boolean =>
  m3u8Str.includes('#EXT-X-STREAM-INF')

export const parseMasterPlaylistContent = (
  m3u8Str: string,
  baseURL: string,
): VariantStream[] => {
  const lines = m3u8Str.split('\n')
  const variants: VariantStream[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue

    const bandwidth = parseInt((line.match(/BANDWIDTH=(\d+)/) || ['', '0'])[1])
    const resolution = (line.match(/RESOLUTION=([^\s,]+)/) || ['', ''])[1]
    const name = (line.match(/NAME="([^"]*)"/) || ['', ''])[1]

    const nextLine = lines[i + 1]?.trim()
    if (nextLine && !nextLine.startsWith('#')) {
      variants.push({
        url: applyURL(nextLine, baseURL),
        bandwidth,
        resolution,
        name: name || resolution || `${Math.round(bandwidth / 1000)}kbps`,
      })
    }
  }

  return variants.sort((a, b) => b.bandwidth - a.bandwidth)
}

/** Raw (untrimmed) media-playlist lines that reference a segment. */
export const segmentLines = (m3u8Str: string): string[] =>
  m3u8Str.split('\n').filter((line) => /^[^#]/.test(line) && line.trim())
