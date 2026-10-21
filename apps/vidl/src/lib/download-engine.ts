import { downloadFile, logger } from '@cdlab/utils'
import { format } from 'date-fns'
import type { AesConf, DownloadStore } from '@/stores/download-store'
import type { DownloadSettings } from '@/stores/settings-store'
import type { TaskRecord } from '@/stores/task-store'
import { useTaskStore } from '@/stores/task-store'
import { AESDecryptor } from './aes-decryptor'
import {
  isMasterPlaylist,
  parseMasterPlaylistContent,
  segmentLines,
} from './m3u8-parser'
import type { SegmentStore } from './storage/segment-store'
import { getSegmentStore } from './storage/segment-store'
import type { FinishItem, VariantStream } from './video-utils'
import {
  applyURL,
  estimateFileSize,
  fetchData,
  getFileExtension,
  isDirectVideoUrl,
  triggerBrowserDownload,
  VIDEO_MIME_MAP,
} from './video-utils'

export interface EngineNotifier {
  success: (msg: string) => void
  error: (msg: string) => void
  warning: (msg: string) => void
  info: (msg: string) => void
}

type StoreApi = {
  getState: () => DownloadStore
  setState: (
    partial:
      | Partial<DownloadStore>
      | ((state: DownloadStore) => Partial<DownloadStore>),
  ) => void
}

/** Segment-URL failures that usually mean a signed URL has expired. */
const EXPIRED_URL_RE = /HTTP (401|403|410)/
const EXPIRED_HITS_BEFORE_REFRESH = 6
const MAX_PLAYLIST_REFRESHES = 3
/** Retry rounds with no finished segment before a task gives up as `error`. */
const MAX_ERROR_ROUNDS = 3

/**
 * Hold a per-task Web Lock so two tabs never drive the same task. Resolves to
 * a release function, or null when another tab already holds the lock.
 */
function holdTaskLock(taskId: string): Promise<(() => void) | null> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return Promise.resolve(() => {})
  }
  return new Promise((resolve) => {
    navigator.locks
      .request(`vidl-task-${taskId}`, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null)
          return undefined
        }
        return new Promise<void>((release) => resolve(() => release()))
      })
      .catch(() => resolve(null))
  })
}

export class DownloadEngine {
  // Non-serializable internal state (class fields, NOT in store)
  private segments: SegmentStore | null = null
  private releaseLock: (() => void) | null = null
  private abortController: AbortController | null = null
  private downloadingTimestamps = new Map<number, number>()
  private beginTime = new Date()
  private durationSecond = 0
  private isRetrying = false
  private saveAsStream = false
  private wasResumed = false
  /** The in-flight worker pool; awaited so a paused task drains before it reruns. */
  private running: Promise<void> | null = null
  private errorRounds = 0
  private expiredHits = 0
  private playlistRefreshes = 0
  private isRefreshing = false
  private quotaNotified = false

  constructor(
    private store: StoreApi,
    private getSettings: () => DownloadSettings,
    private notify: EngineNotifier,
  ) {}

  // ============================================================
  // Parse
  // ============================================================

  async parseM3U8(targetUrl: string): Promise<void> {
    const s = this.store.getState()
    if (!targetUrl) {
      this.notify.error('enterUrl')
      return
    }

    s.setIsParsing(true)
    s.setTsUrlList([])
    s.setFinishList([])
    s.setVariants([])
    s.setEstimatedSize(null)
    s.setIsDirectVideo(false)
    s.setM3u8Content('')
    s.setHasMediaData(false)

    if (isDirectVideoUrl(targetUrl)) {
      s.setIsDirectVideo(true)
      s.setIsParsing(false)
      try {
        const res = await fetch(targetUrl, { method: 'HEAD' })
        const len = res.headers.get('Content-Length')
        if (len) s.setEstimatedSize(Number.parseInt(len, 10))
      } catch {
        // ignore
      }
      this.notify.success(
        `directVideoDetected:${getFileExtension(targetUrl).toUpperCase()}`,
      )
      return
    }

    if (targetUrl.toLowerCase().indexOf('m3u8') === -1) {
      this.notify.error('invalidUrl')
      s.setIsParsing(false)
      return
    }

    try {
      const m3u8Str: string = await fetchData(targetUrl)

      if (isMasterPlaylist(m3u8Str)) {
        const parsedVariants = parseMasterPlaylistContent(m3u8Str, targetUrl)
        if (parsedVariants.length > 0) {
          s.setVariants(parsedVariants)
          this.notify.info(`variantsDetected:${parsedVariants.length}`)
          await this.selectVariant(parsedVariants[0])
          return
        }
      }

      this.parseMediaPlaylist(m3u8Str, targetUrl)
    } catch (error) {
      this.notify.error((error as any).message || 'invalidLink')
      logger.error('Parse m3u8 failed:', (error as any).message)
    } finally {
      s.setIsParsing(false)
    }
  }

  async selectVariant(variant: VariantStream): Promise<void> {
    const s = this.store.getState()
    s.setIsLoadingVariant(true)
    s.updateVariantSelection(variant.url)

    try {
      const m3u8Str: string = await fetchData(variant.url)

      if (isMasterPlaylist(m3u8Str)) {
        const parsedVariants = parseMasterPlaylistContent(m3u8Str, variant.url)
        if (parsedVariants.length > 0) {
          s.setVariants(parsedVariants)
          this.notify.info('continueSelect')
          return
        }
      }

      this.parseMediaPlaylist(m3u8Str, variant.url)
    } catch (error) {
      this.notify.error('variantFailed')
      logger.error('Parse variant failed:', (error as any).message)
    } finally {
      s.setIsLoadingVariant(false)
    }
  }

  private parseMediaPlaylist(m3u8Str: string, baseURL: string) {
    const s = this.store.getState()
    const newTsUrlList: string[] = []
    const newFinishList: FinishItem[] = []

    segmentLines(m3u8Str).forEach((item) => {
      newTsUrlList.push(applyURL(item, baseURL))
      newFinishList.push({ title: item, status: '' })
    })

    if (newTsUrlList.length === 0) {
      this.notify.error('emptyResource')
      return
    }

    s.setM3u8Content(m3u8Str)
    s.setPlaylistUrl(baseURL)
    s.setTsUrlList(newTsUrlList)
    s.setFinishList(newFinishList)
    s.setRangeDownload({
      startSegment: '1',
      endSegment: String(newTsUrlList.length),
    })

    this.notify.success(`success:${newTsUrlList.length}`)

    s.setEstimatedSize(null)
    void estimateFileSize(newTsUrlList, 1, newTsUrlList.length).then((size) => {
      if (size) s.setEstimatedSize(size)
    })
  }

  // ============================================================
  // Download
  // ============================================================

  /**
   * Load a persisted task into this engine's store: restore the view state
   * from the record and the segments that were fully staged.
   */
  async load(
    task: TaskRecord,
    { restored }: { restored: boolean },
  ): Promise<void> {
    this.segments = await getSegmentStore(task.backend)
    this.saveAsStream = task.saveAsStream
    this.wasResumed = restored
    this.durationSecond = task.durationSecond
    this.beginTime = new Date(task.createdAt)

    const s = this.store.getState()
    s.setUrl(task.url)
    s.setTitle(task.title)
    s.setCustomFileName(task.customFileName)
    s.setM3u8Content(task.m3u8Content)
    s.setPlaylistUrl(task.playlistUrl)
    s.setTsUrlList(task.tsUrlList)
    s.setRangeDownload({
      startSegment: String(task.startSegment),
      endSegment: String(task.endSegment),
    })
    s.setTaskId(task.id)
    await this.syncStaged(task)
    s.setIsReadyToSave(task.status === 'ready')
  }

  /** Rebuild the segment grid from what is really staged on disk. */
  private async syncStaged(task: TaskRecord): Promise<boolean> {
    const staged = new Set(await (this.segments as SegmentStore).list(task.id))
    const inRange = (i: number) =>
      i >= task.startSegment - 1 && i < task.endSegment
    const finishList: FinishItem[] = segmentLines(task.m3u8Content).map(
      (title, i) => ({
        title,
        status: staged.has(i) && inRange(i) ? 'finish' : '',
      }),
    )
    const s = this.store.getState()
    s.setFinishList(finishList)
    s.setHasMediaData(staged.size > 0)
    s.setDownloadState({
      isGetMP4: task.isGetMP4,
      downloadIndex: task.startSegment - 1,
    })
    return (
      finishList.filter((item) => item.status === 'finish').length ===
      task.endSegment - task.startSegment + 1
    )
  }

  /** Take the per-task Web Lock; false when another tab already holds it. */
  async acquireLock(): Promise<boolean> {
    if (this.releaseLock) return true
    const release = await holdTaskLock(this.store.getState().taskId)
    if (!release) return false
    this.releaseLock = release
    return true
  }

  /** Start or continue downloading the loaded task from its staged segments. */
  async run(): Promise<void> {
    const taskId = this.store.getState().taskId
    const task = useTaskStore.getState().tasks[taskId]
    if (!task) return

    // A paused pool may still be finishing in-flight segments.
    await this.running?.catch(() => {})

    if (!(await this.acquireLock())) {
      this.notify.info('taskInOtherTab')
      this.persistPatch({ status: 'paused' })
      return
    }

    this.abortController = new AbortController()
    this.expiredHits = 0
    this.playlistRefreshes = 0
    this.quotaNotified = false
    this.errorRounds = 0

    await this.syncStaged(task)
    this.store
      .getState()
      .setDownloadState({ isDownloading: true, isPaused: false })

    const aesConf: AesConf | null = task.aes
      ? {
          method: task.aes.method,
          uri: task.aes.uri,
          iv: task.aes.iv ? new TextEncoder().encode(task.aes.iv) : '',
          key: null,
          decryptor: null,
        }
      : null

    this.running = this.runDownload(
      task.startSegment,
      task.endSegment,
      task.isGetMP4,
      aesConf,
    )
    try {
      await this.running
    } finally {
      this.running = null
      const ds = this.store.getState().downloadState
      if (ds.isPaused) {
        this.store.getState().setDownloadState({ isDownloading: false })
      }
    }
  }

  /** Stop fetching; in-flight segments still finish and stay staged. */
  pause(): void {
    this.store.getState().setDownloadState({ isPaused: true })
  }

  private async runDownload(
    startSegment: number,
    endSegment: number,
    isGetMP4: boolean,
    aesConf: AesConf | null,
  ): Promise<void> {
    const s = this.store.getState()
    if (aesConf) {
      await this.getAES(
        aesConf,
        s.tsUrlList,
        s.finishList,
        startSegment,
        endSegment,
        isGetMP4,
      )
    } else {
      await this.downloadTS(
        s.tsUrlList,
        s.finishList,
        startSegment,
        endSegment,
        isGetMP4,
      )
    }

    // After the worker pool finishes, check completion
    await this.checkCompletion()
  }

  async directDownload(): Promise<void> {
    const s = this.store.getState()
    if (!s.url || s.downloadState.isDownloading) return

    this.abortController = new AbortController()
    const urlObj = new URL(s.url)
    const newTitle =
      urlObj.searchParams.get('title') ||
      s.title ||
      urlObj.pathname.split('/').pop()?.split('.')[0] ||
      format(new Date(), 'yyyyMMdd_HHmmss')
    s.setTitle(newTitle)
    s.setDownloadState({ isDownloading: true, isGetMP4: false })
    s.setFinishList([{ title: s.url, status: 'downloading' }])

    try {
      const file = await fetchData(s.url, 'file', this.abortController?.signal)
      if (!this.store.getState().downloadState.isDownloading) return

      const ext = getFileExtension(s.url)
      const blob = new Blob([file], {
        type: VIDEO_MIME_MAP[ext] || 'application/octet-stream',
      })
      const filename = `${this.store.getState().customFileName || newTitle}.${ext}`
      downloadFile({ data: blob, filename })

      s.setFinishList([{ title: s.url, status: 'finish' }])
      s.setDownloadState({ isDownloading: false })
      this.notify.success('directComplete')
    } catch {
      if (!this.store.getState().downloadState.isDownloading) return
      s.setFinishList([{ title: s.url, status: 'error' }])
      s.setDownloadState({ isDownloading: false })
      this.notify.error('directFailed')
    }
  }

  cancelDownload(): void {
    const s = this.store.getState()
    this.abortController?.abort()
    this.abortController = null
    this.isRetrying = false

    s.setDownloadState({
      isDownloading: false,
      isPaused: false,
      downloadIndex: 0,
    })
    this.downloadingTimestamps.clear()
    this.saveAsStream = false

    void this.discardTask()
    s.setTaskId('')
    s.setIsReadyToSave(false)

    s.setFinishList(
      s.finishList.map((item) => ({ ...item, status: '' as const })),
    )
    s.setHasMediaData(false)

    this.notify.info('cancelled')
  }

  /** Stop and delete the task's record and staged segments. */
  async discard(): Promise<void> {
    this.abortController?.abort()
    this.abortController = null
    this.store.getState().setDownloadState({
      isDownloading: false,
      isPaused: false,
    })
    await this.discardTask()
    this.store.getState().setTaskId('')
  }

  async retry(index: number): Promise<void> {
    const s = this.store.getState()
    if (s.finishList[index]?.status !== 'error') return

    const startSegment = parseInt(s.rangeDownload.startSegment)
    const isGetMP4 = s.downloadState.isGetMP4

    s.updateFinishItem(index, 'downloading')
    this.downloadingTimestamps.set(index, Date.now())

    try {
      const file = await fetchData(s.tsUrlList[index], 'file')
      this.downloadingTimestamps.delete(index)
      await this.dealTS(file, index, startSegment, isGetMP4)
    } catch {
      this.downloadingTimestamps.delete(index)
      s.updateFinishItem(index, 'error')
      return
    }
    await this.checkCompletion()
  }

  /** Save whatever is staged so far, even if the download is incomplete. */
  async forceDownload(): Promise<void> {
    const s = this.store.getState()
    const parts = await this.readStaged(false)
    if (parts.length) {
      triggerBrowserDownload(
        parts,
        this.fileBaseName(),
        s.downloadState.isGetMP4,
      )
      this.notify.success('forceDownloadSuccess')
    } else {
      this.notify.warning('noSegments')
    }
  }

  /** Hand the fully staged download to the browser as a file. */
  async saveTask(): Promise<void> {
    const s = this.store.getState()
    if (!s.taskId || !this.segments) return

    const isMp4 = s.downloadState.isGetMP4
    const name = `${this.fileBaseName()}.${isMp4 ? 'mp4' : 'ts'}`
    const indices = this.rangeIndices()

    try {
      if (this.saveAsStream) {
        // Create the writer first: StreamSaver wants this inside the click.
        const streamSaver = (window as any).streamSaver
        if (!streamSaver) {
          this.notify.error('streamSaverNotLoaded')
          return
        }
        const writer: WritableStreamDefaultWriter<Uint8Array> = streamSaver
          .createWriteStream(name)
          .getWriter()
        try {
          for (const index of indices) {
            const blob = await this.segments.get(s.taskId, index)
            await writer.write(new Uint8Array(await blob.arrayBuffer()))
          }
          await writer.close()
        } catch (error) {
          await writer.abort?.().catch(() => {})
          throw error
        }
        this.notify.success(`streamComplete:${indices.length}`)
      } else {
        const parts = await this.readStaged(true)
        triggerBrowserDownload(parts, this.fileBaseName(), isMp4)
        this.notify.success(`downloadComplete:${indices.length}`)
      }
    } catch (error) {
      logger.error('Save failed:', error)
      this.notify.error('saveFailed')
      // Keep the staged segments and the Save button so nothing is lost.
      this.store.getState().setIsReadyToSave(true)
      return
    }

    this.store.getState().setIsReadyToSave(false)
    this.persistPatch({ status: 'saved' })
  }

  retryAll(): void {
    const s = this.store.getState()
    const ds = s.downloadState

    if (!s.finishList.length || ds.isPaused) return
    if (!ds.isDownloading) return
    if (this.isRetrying) return

    const startSegment = parseInt(s.rangeDownload.startSegment)
    const endSegment = parseInt(s.rangeDownload.endSegment)
    const isGetMP4 = ds.isGetMP4
    let firstPendingIndex = endSegment
    const now = Date.now()
    let hasPending = false
    const settings = this.getSettings()

    const newFinishList = s.finishList.map((item, index) => {
      if (index < startSegment - 1 || index >= endSegment) return item

      if (item.status === 'error') {
        firstPendingIndex = Math.min(firstPendingIndex, index)
        hasPending = true
        return { ...item, status: '' as const }
      }
      if (item.status === '' && !this.downloadingTimestamps.has(index)) {
        firstPendingIndex = Math.min(firstPendingIndex, index)
        hasPending = true
      }
      if (item.status === 'downloading') {
        const startedAt = this.downloadingTimestamps.get(index)
        if (startedAt && now - startedAt > settings.timeoutMs + 5_000) {
          this.downloadingTimestamps.delete(index)
          firstPendingIndex = Math.min(firstPendingIndex, index)
          hasPending = true
          return { ...item, status: '' as const }
        }
      }
      return item
    })

    if (!hasPending) return

    if (s.finishList.some((item) => item.status === 'error')) {
      if (++this.errorRounds > MAX_ERROR_ROUNDS) {
        this.markStalled()
        return
      }
    }

    s.setFinishList(newFinishList)

    if (ds.downloadIndex >= endSegment) {
      this.isRetrying = true
      s.setDownloadState({ downloadIndex: firstPendingIndex })
      void this.downloadTS(
        s.tsUrlList,
        newFinishList,
        startSegment,
        endSegment,
        isGetMP4,
      )
        .then(() => this.checkCompletion())
        .finally(() => {
          this.isRetrying = false
        })
    }
  }

  resetState(): void {
    const s = this.store.getState()
    if (s.downloadState.isDownloading) return
    void this.discardTask()
    s.resetAll()
    this.downloadingTimestamps.clear()
    this.saveAsStream = false
  }

  onStreamSaverReady(): void {
    const streamSaver = (window as any).streamSaver
    if (streamSaver && !streamSaver.useBlobFallback) {
      streamSaver.middleTransporterUrl = `${window.location.origin}/static/mitm.html`
      this.store.getState().setIsStreamSupported(true)
    }
  }

  destroy(): void {
    const s = this.store.getState()
    s.aesConf.decryptor?.destroy()
    this.releaseTaskLock()
  }

  // ============================================================
  // Internal
  // ============================================================

  /** Repeated rounds with nothing finishing: free the slot, keep staged data. */
  private markStalled() {
    this.abortController?.abort()
    this.store
      .getState()
      .setDownloadState({ isDownloading: false, isPaused: false })
    this.persistPatch({ status: 'error' })
    this.notify.error('taskStalled')
  }

  private releaseTaskLock() {
    this.releaseLock?.()
    this.releaseLock = null
  }

  private persistPatch(patch: Partial<TaskRecord>) {
    const id = this.store.getState().taskId
    if (id) useTaskStore.getState().patchTask(id, patch)
  }

  /** Drop a task's record and staged segments (current task by default). */
  private async discardTask(id = this.store.getState().taskId): Promise<void> {
    if (!id) return
    this.releaseTaskLock()
    useTaskStore.getState().removeTask(id)
    try {
      await (this.segments ?? (await getSegmentStore())).removeTask(id)
    } catch (error) {
      logger.error('Failed to discard staged segments:', error)
    }
  }

  private fileBaseName(): string {
    const s = this.store.getState()
    return (
      s.customFileName || s.title || format(this.beginTime, 'yyyyMMdd_HHmmss')
    )
  }

  /** 0-based segment indices covered by the current range, ascending. */
  private rangeIndices(): number[] {
    const { startSegment, endSegment } = this.store.getState().rangeDownload
    const start = Math.max(parseInt(startSegment) || 1, 1)
    const end = Math.max(parseInt(endSegment) || start, start)
    return Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i)
  }

  /** Read staged segments in order; `complete` requires every one of them. */
  private async readStaged(complete: boolean): Promise<Blob[]> {
    const s = this.store.getState()
    if (!this.segments || !s.taskId) return []
    const have = new Set(await this.segments.list(s.taskId))
    const wanted = this.rangeIndices()
    const indices = wanted.filter((i) => have.has(i))
    if (complete && indices.length !== wanted.length) {
      throw new Error('Missing staged segments')
    }
    return Promise.all(
      indices.map((i) => (this.segments as SegmentStore).get(s.taskId, i)),
    )
  }

  async checkStorage(estimatedSize: number | null) {
    try {
      void navigator.storage?.persist?.()
      const estimate = await navigator.storage?.estimate?.()
      if (
        estimate?.quota &&
        estimatedSize &&
        estimate.quota - (estimate.usage ?? 0) < estimatedSize * 1.1
      ) {
        this.notify.warning('storageLow')
      }
    } catch {
      // storage estimate is best effort
    }
  }

  private async checkCompletion() {
    const s = this.store.getState()
    const ds = s.downloadState
    if (!ds.isDownloading) return

    const finishNum = s.finishList.filter((i) => i.status === 'finish').length
    if (finishNum !== this.getTargetSegment()) return

    // Synchronous from the check above, so concurrent callers cannot both save.
    s.setDownloadState({ isDownloading: false })
    this.releaseTaskLock()
    this.persistPatch({ status: 'ready' })

    // Stream saves after a reload need a click (no gesture to start from).
    if (this.saveAsStream && this.wasResumed) {
      s.setIsReadyToSave(true)
      this.notify.info('readyToSave')
      return
    }
    await this.saveTask()
  }

  private getTargetSegment(): number {
    const s = this.store.getState()
    const start = Math.max(parseInt(s.rangeDownload.startSegment) || 1, 1)
    const end = Math.max(
      parseInt(s.rangeDownload.endSegment) || s.tsUrlList.length,
      1,
    )
    const validStart = Math.min(start, s.tsUrlList.length)
    const validEnd = Math.min(end, s.tsUrlList.length)
    return Math.max(validStart, validEnd) - Math.min(validStart, validEnd) + 1
  }

  private aesDecrypt(data: ArrayBuffer, index: number): ArrayBuffer {
    const conf = this.store.getState().aesConf
    const iv =
      conf.iv ||
      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, index])
    const ivBuffer = iv instanceof Uint8Array ? iv.buffer : iv
    return conf.decryptor!.decrypt(data, 0, ivBuffer as ArrayBuffer, true)
  }

  private async conversionMp4(
    data: ArrayBuffer,
    index: number,
    startSegment: number,
    isGetMP4: boolean,
  ): Promise<ArrayBuffer> {
    if (!isGetMP4) return data

    try {
      // @ts-expect-error dynamic import
      const muxjs = await import('mux.js')
      return await new Promise<ArrayBuffer>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MP4 transmux timeout'))
        }, 10_000)

        const transmuxer = new muxjs.default.mp4.Transmuxer({
          keepOriginalTimestamps: true,
          duration: parseInt(String(this.durationSecond)),
        })

        transmuxer.on('data', (segment: any) => {
          clearTimeout(timeout)
          if (index === startSegment - 1) {
            const combined = new Uint8Array(
              segment.initSegment.byteLength + segment.data.byteLength,
            )
            combined.set(segment.initSegment, 0)
            combined.set(segment.data, segment.initSegment.byteLength)
            resolve(combined.buffer)
          } else {
            resolve(segment.data.buffer)
          }
        })

        transmuxer.on('done', () => {
          clearTimeout(timeout)
          // If data event never fired, resolve with raw data as fallback
          resolve(data)
        })

        transmuxer.push(new Uint8Array(data))
        transmuxer.flush()
      })
    } catch (error) {
      logger.error('MP4 conversion failed:', error)
      this.notify.error('mp4Failed')
      return data
    }
  }

  private async dealTS(
    file: ArrayBuffer,
    index: number,
    startSegment: number,
    isGetMP4: boolean,
  ) {
    const s = this.store.getState()
    const taskId = s.taskId
    const data = s.aesConf.uri ? this.aesDecrypt(file, index) : file
    const afterData = await this.conversionMp4(
      data,
      index,
      startSegment,
      isGetMP4,
    )

    // The task may have been cancelled/replaced while we were transmuxing.
    if (!this.segments || this.store.getState().taskId !== taskId) return
    await this.segments.put(taskId, index, afterData)
    s.setHasMediaData(true)
    this.errorRounds = 0

    // Update finish status
    s.updateFinishItem(index, 'finish')
    // Completion detection is handled by checkCompletion() after worker pool drains
  }

  /**
   * Segment URLs are often signed and expire. When several fetches in a row
   * fail with 401/403/410, re-read the media playlist and swap in fresh URLs,
   * but only when the segment count is unchanged (indices must stay valid).
   */
  private async refreshSegmentUrls(urlList: string[]) {
    const s = this.store.getState()
    if (
      this.isRefreshing ||
      !s.playlistUrl ||
      this.playlistRefreshes >= MAX_PLAYLIST_REFRESHES
    ) {
      return
    }
    this.isRefreshing = true
    this.playlistRefreshes++
    try {
      const text: string = await fetchData(
        s.playlistUrl,
        'text',
        this.abortController?.signal,
      )
      const fresh = segmentLines(text).map((line) =>
        applyURL(line, s.playlistUrl),
      )
      if (fresh.length !== urlList.length) {
        this.notify.error('playlistChanged')
        return
      }
      // Workers hold this array, so update it in place as well as the store.
      urlList.splice(0, urlList.length, ...fresh)
      s.setTsUrlList([...fresh])
      this.persistPatch({ tsUrlList: fresh })
      this.notify.info('urlsRefreshed')
    } catch {
      // The normal retry path will keep reporting failures.
    } finally {
      this.isRefreshing = false
    }
  }

  private async downloadTS(
    urlList: string[],
    finishItems: FinishItem[],
    startSegment: number,
    endSegment: number,
    isGetMP4: boolean,
  ) {
    const s = this.store.getState()
    let currentIndex = s.downloadState.downloadIndex

    const next = (): number | null => {
      if (currentIndex >= endSegment) return null
      const idx = currentIndex++
      this.store.getState().setDownloadState({ downloadIndex: currentIndex })
      return idx
    }

    const worker = async () => {
      while (true) {
        const ds = this.store.getState().downloadState
        if (ds.isPaused || !ds.isDownloading) return

        const index = next()
        if (index === null) return
        if (finishItems[index]?.status !== '') continue

        this.store.getState().updateFinishItem(index, 'downloading')
        this.downloadingTimestamps.set(index, Date.now())

        let success = false
        const { maxRetries, retryBaseDelayMs, timeoutMs } = this.getSettings()
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const currentDs = this.store.getState().downloadState
          if (currentDs.isPaused || !currentDs.isDownloading) return

          try {
            const file = await fetchData(
              urlList[index],
              'file',
              this.abortController?.signal,
              timeoutMs,
            )
            this.downloadingTimestamps.delete(index)
            if (!this.store.getState().downloadState.isDownloading) return
            await this.dealTS(file, index, startSegment, isGetMP4)
            this.expiredHits = 0
            success = true
            break
          } catch (error) {
            if (!this.store.getState().downloadState.isDownloading) return
            if (
              (error as DOMException)?.name === 'QuotaExceededError' &&
              !this.quotaNotified
            ) {
              this.quotaNotified = true
              this.notify.error('storageFull')
            }
            if (EXPIRED_URL_RE.test((error as Error)?.message ?? '')) {
              if (++this.expiredHits >= EXPIRED_HITS_BEFORE_REFRESH) {
                this.expiredHits = 0
                await this.refreshSegmentUrls(urlList)
              }
            }
            if (attempt < maxRetries - 1) {
              const delay = retryBaseDelayMs * Math.pow(2, attempt)
              await new Promise((resolve) => setTimeout(resolve, delay))
            }
          }
        }

        if (!success) {
          this.downloadingTimestamps.delete(index)
          if (!this.store.getState().downloadState.isDownloading) return
          this.store.getState().updateFinishItem(index, 'error')

          const errorNum = this.store
            .getState()
            .finishList.filter((i) => i.status === 'error').length
          if (errorNum % 5 === 0 && errorNum > 0) {
            this.notify.warning(`retryWarning:${errorNum}`)
          }
        }
      }
    }

    const pendingCount = finishItems.filter((item) => item.status === '').length
    const targetSegment = this.getTargetSegment()
    const concurrency = Math.min(
      this.getSettings().concurrency,
      pendingCount || targetSegment,
    )
    await Promise.all(Array.from({ length: concurrency }, () => worker()))
  }

  private async getAES(
    currentAesConf: AesConf,
    urlList: string[],
    finishItems: FinishItem[],
    startSegment: number,
    endSegment: number,
    isGetMP4: boolean,
  ) {
    try {
      const key = await fetchData(currentAesConf.uri, 'file')
      const decryptor = new AESDecryptor()
      decryptor.expandKey(key)

      const newAesConf: AesConf = { ...currentAesConf, key, decryptor }
      this.store.getState().setAesConf(newAesConf)

      await this.downloadTS(
        urlList,
        finishItems,
        startSegment,
        endSegment,
        isGetMP4,
      )
    } catch {
      this.notify.error('encryptedError')
      this.store.getState().setDownloadState({ isDownloading: false })
    }
  }
}
