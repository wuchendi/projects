import type { DownloadStore } from '@/stores/download-store'
import type { TaskRecord } from '@/stores/task-store'
import type { SegmentBackend } from './storage/segment-store'
import { applyURL } from './video-utils'

export interface TaskOptions {
  isGetMP4: boolean
  /** Save through StreamSaver (one segment in memory) instead of a Blob. */
  saveAsStream: boolean
}

/**
 * Snapshot a parsed download (any store holding parse results) into a queued
 * task record: normalised segment range, total duration for MP4 transmuxing and
 * the AES key reference.
 */
export function buildTaskRecord(
  s: DownloadStore,
  { isGetMP4, saveAsStream }: TaskOptions,
  extra: { id: string; backend: SegmentBackend; order: number },
): TaskRecord {
  const total = s.tsUrlList.length
  let startSeg = Math.max(parseInt(s.rangeDownload.startSegment) || 1, 1)
  let endSeg = Math.max(parseInt(s.rangeDownload.endSegment) || total, 1)
  startSeg = Math.min(startSeg, total)
  endSeg = Math.min(endSeg, total)
  const startSegment = Math.min(startSeg, endSeg)
  const endSegment = Math.max(startSeg, endSeg)

  const m3u8Str = s.m3u8Content

  let durationSecond = 0
  if (isGetMP4) {
    let infoIndex = 0
    m3u8Str.split('\n').forEach((item) => {
      if (item.toUpperCase().indexOf('#EXTINF:') > -1) {
        infoIndex++
        if (startSegment <= infoIndex && infoIndex <= endSegment) {
          durationSecond += parseFloat(item.split('#EXTINF:')[1])
        }
      }
    })
  }

  let aes: TaskRecord['aes'] = null
  if (m3u8Str.indexOf('#EXT-X-KEY') > -1) {
    const method = (m3u8Str.match(/(.*METHOD=([^,\s]+))/) || ['', '', ''])[2]
    const uri = (m3u8Str.match(/(.*URI="([^"]+))"/) || ['', '', ''])[2]
    const iv = (m3u8Str.match(/(.*IV=([^,\s]+))/) || ['', '', ''])[2]
    aes = { method, uri: applyURL(uri, s.url), iv }
  }

  const title = new URL(s.url).searchParams.get('title') || s.title

  return {
    ...extra,
    url: s.url,
    playlistUrl: s.playlistUrl,
    title,
    customFileName: s.customFileName,
    isGetMP4,
    saveAsStream,
    startSegment,
    endSegment,
    m3u8Content: m3u8Str,
    tsUrlList: s.tsUrlList,
    aes,
    durationSecond,
    status: 'queued',
    createdAt: Date.now(),
  }
}
