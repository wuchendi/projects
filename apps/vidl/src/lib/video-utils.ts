import { downloadFile } from '@cdlab/utils'

// ============================================================
// Shared Types
// ============================================================

export interface FinishItem {
  title: string
  status: '' | 'downloading' | 'finish' | 'error'
}

export interface VariantStream {
  url: string
  bandwidth: number
  resolution: string
  name: string
  selected?: boolean
}

export interface RangeDownload {
  startSegment: string
  endSegment: string
}

export interface DownloadState {
  isDownloading: boolean
  isPaused: boolean
  isGetMP4: boolean
  downloadIndex: number
}

// ============================================================
// Constants
// ============================================================

export const FETCH_TIMEOUT_MS = 30_000
export const MAX_SEGMENT_RETRIES = 3
export const RETRY_BASE_DELAY_MS = 1_000

export const VIDEO_MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  flv: 'video/x-flv',
  wmv: 'video/x-ms-wmv',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  ts: 'video/MP2T',
}

export const isDirectVideoUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return Object.keys(VIDEO_MIME_MAP).some((ext) =>
      pathname.endsWith(`.${ext}`),
    )
  } catch {
    return false
  }
}

export const getFileExtension = (url: string): string => {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.split('.').pop()?.toLowerCase()
    return ext || 'mp4'
  } catch {
    return 'mp4'
  }
}

export const fetchData = async (
  url: string,
  type?: 'file' | 'text',
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<any> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    timeoutMs ?? FETCH_TIMEOUT_MS,
  )

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return type === 'file'
      ? await response.arrayBuffer()
      : await response.text()
  } finally {
    clearTimeout(timeoutId)
  }
}

export const applyURL = (targetURL: string, baseURL?: string) => {
  baseURL =
    baseURL || (typeof window !== 'undefined' ? window.location.href : '')
  if (targetURL.indexOf('http') === 0) {
    if (window.location.href.indexOf('https') === 0) {
      return targetURL.replace('http://', 'https://')
    }
    return targetURL
  }
  if (targetURL[0] === '/') {
    const domain = baseURL.split('/')
    return `${domain[0]}//${domain[2]}${targetURL}`
  }
  const domain = baseURL.split('/')
  domain.pop()
  return `${domain.join('/')}/${targetURL}`
}

export const estimateFileSize = async (
  urlList: string[],
  startSegment: number,
  endSegment: number,
): Promise<number | null> => {
  const start = Math.max(startSegment - 1, 0)
  const end = Math.min(endSegment, urlList.length)
  const sliced = urlList.slice(start, end)
  const total = sliced.length
  if (total === 0) return null

  const sampleIndices = [0, Math.floor(total / 2), total - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  )

  const sizes: number[] = []
  for (const idx of sampleIndices) {
    try {
      const res = await fetch(sliced[idx], { method: 'HEAD' })
      const len = res.headers.get('Content-Length')
      if (len) sizes.push(Number.parseInt(len, 10))
    } catch {
      // ignore failed samples
    }
  }

  if (sizes.length === 0) return null
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length
  return Math.round(avgSize * total)
}

export const triggerBrowserDownload = (
  fileDataList: BlobPart[],
  fileName: string,
  isMp4: boolean,
) => {
  const fileBlob = isMp4
    ? new Blob(fileDataList, { type: 'video/mp4' })
    : new Blob(fileDataList, { type: 'video/MP2T' })

  const extension = isMp4 ? '.mp4' : '.ts'
  downloadFile({ data: fileBlob, filename: fileName + extension })
}
