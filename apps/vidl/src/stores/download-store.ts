import type { StateCreator } from 'zustand'
import { create } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type {
  AESDecryptor,
  DownloadState,
  FinishItem,
  RangeDownload,
  VariantStream,
} from '@/lib'

export interface AesConf {
  method: string
  uri: string
  iv: string | Uint8Array
  key: ArrayBuffer | null
  decryptor: AESDecryptor | null
}

interface DownloadStoreState {
  // Input
  url: string
  title: string
  customFileName: string

  // Parse state
  isParsing: boolean
  isLoadingVariant: boolean
  tsUrlList: string[]
  variants: VariantStream[]
  isDirectVideo: boolean
  estimatedSize: number | null
  m3u8Content: string
  playlistUrl: string

  // Download state
  downloadState: DownloadState
  finishList: FinishItem[]
  rangeDownload: RangeDownload
  aesConf: AesConf
  isStreamSupported: boolean

  // Flags for progress card
  hasMediaData: boolean
  /** Every segment is staged; waiting for the user to save (stream formats). */
  isReadyToSave: boolean
  /** Staging/persistence id of the current download; '' when none. */
  taskId: string
}

interface DownloadStoreActions {
  setUrl: (url: string) => void
  setTitle: (title: string) => void
  setCustomFileName: (name: string) => void
  setIsParsing: (v: boolean) => void
  setIsLoadingVariant: (v: boolean) => void
  setTsUrlList: (list: string[]) => void
  setVariants: (v: VariantStream[]) => void
  updateVariantSelection: (selectedUrl: string) => void
  setIsDirectVideo: (v: boolean) => void
  setEstimatedSize: (size: number | null) => void
  setM3u8Content: (content: string) => void
  setPlaylistUrl: (url: string) => void
  setDownloadState: (patch: Partial<DownloadState>) => void
  setFinishList: (list: FinishItem[]) => void
  updateFinishItem: (index: number, status: FinishItem['status']) => void
  setRangeDownload: (range: RangeDownload) => void
  setAesConf: (conf: AesConf) => void
  setIsStreamSupported: (v: boolean) => void
  setHasMediaData: (v: boolean) => void
  setIsReadyToSave: (v: boolean) => void
  setTaskId: (id: string) => void
  resetAll: () => void
}

export type DownloadStore = DownloadStoreState & DownloadStoreActions

const INITIAL_DOWNLOAD_STATE: DownloadState = {
  isDownloading: false,
  isPaused: false,
  isGetMP4: false,
  downloadIndex: 0,
}

const INITIAL_AES_CONF: AesConf = {
  method: '',
  uri: '',
  iv: '',
  key: null,
  decryptor: null,
}

const INITIAL_STATE: DownloadStoreState = {
  url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  title: '',
  customFileName: '',
  isParsing: false,
  isLoadingVariant: false,
  tsUrlList: [],
  variants: [],
  isDirectVideo: false,
  estimatedSize: null,
  m3u8Content: '',
  playlistUrl: '',
  downloadState: INITIAL_DOWNLOAD_STATE,
  finishList: [],
  rangeDownload: { startSegment: '', endSegment: '' },
  aesConf: INITIAL_AES_CONF,
  isStreamSupported: false,
  hasMediaData: false,
  isReadyToSave: false,
  taskId: '',
}

const initializer: StateCreator<DownloadStore> = (set) => ({
  ...INITIAL_STATE,

  setUrl: (url) => set({ url }),
  setTitle: (title) => set({ title }),
  setCustomFileName: (customFileName) => set({ customFileName }),
  setIsParsing: (isParsing) => set({ isParsing }),
  setIsLoadingVariant: (isLoadingVariant) => set({ isLoadingVariant }),
  setTsUrlList: (tsUrlList) => set({ tsUrlList }),
  setVariants: (variants) => set({ variants }),
  updateVariantSelection: (selectedUrl) =>
    set((s) => ({
      variants: s.variants.map((v) => ({
        ...v,
        selected: v.url === selectedUrl,
      })),
    })),
  setIsDirectVideo: (isDirectVideo) => set({ isDirectVideo }),
  setEstimatedSize: (estimatedSize) => set({ estimatedSize }),
  setM3u8Content: (m3u8Content) => set({ m3u8Content }),
  setPlaylistUrl: (playlistUrl) => set({ playlistUrl }),
  setDownloadState: (patch) =>
    set((s) => ({ downloadState: { ...s.downloadState, ...patch } })),
  setFinishList: (finishList) => set({ finishList }),
  updateFinishItem: (index, status) =>
    set((s) => {
      const list = [...s.finishList]
      if (list[index]) list[index] = { ...list[index], status }
      return { finishList: list }
    }),
  setRangeDownload: (rangeDownload) => set({ rangeDownload }),
  setAesConf: (aesConf) => set({ aesConf }),
  setIsStreamSupported: (isStreamSupported) => set({ isStreamSupported }),
  setHasMediaData: (hasMediaData) => set({ hasMediaData }),
  setIsReadyToSave: (isReadyToSave) => set({ isReadyToSave }),
  setTaskId: (taskId) => set({ taskId }),
  resetAll: () =>
    set((s) => ({
      ...INITIAL_STATE,
      url: s.url,
      isStreamSupported: s.isStreamSupported,
    })),
})

/** One view-state store per download task. */
export const createDownloadStore = () =>
  createStore<DownloadStore>()(initializer)

/** The composer's draft: parse results before they become a queued task. */
export const useDownloadStore = create<DownloadStore>()(initializer)

// ---- Derived selectors ----
export const selectFinishNum = (s: DownloadStore) =>
  s.finishList.filter((i) => i.status === 'finish').length

export const selectErrorNum = (s: DownloadStore) =>
  s.finishList.filter((i) => i.status === 'error').length

export const selectTargetSegment = (s: DownloadStore) => {
  const start = Math.max(parseInt(s.rangeDownload.startSegment) || 1, 1)
  const end = Math.max(
    parseInt(s.rangeDownload.endSegment) || s.tsUrlList.length,
    1,
  )
  const validStart = Math.min(start, s.tsUrlList.length)
  const validEnd = Math.min(end, s.tsUrlList.length)
  return Math.max(validStart, validEnd) - Math.min(validStart, validEnd) + 1
}

export const selectIsParsed = (s: DownloadStore) => s.tsUrlList.length > 0
