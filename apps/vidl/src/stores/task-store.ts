import { logger } from '@cdlab/utils'
import { createIndexedDBStorage } from '@cdlab/zustand-idb'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SegmentBackend } from '@/lib/storage/segment-store'

/**
 * queued      — waiting for a free slot
 * downloading — segments are being fetched
 * paused      — stopped by the user or restored after a reload; staged data kept
 * error       — gave up after repeated failures; staged data kept, can retry
 * ready       — every segment is staged, waiting for the user to save
 * saved       — the file was handed to the browser; staged data is garbage
 */
export type TaskStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'error'
  | 'ready'
  | 'saved'

export interface TaskRecord {
  id: string
  /** Source URL as entered; base for relative AES key URIs. */
  url: string
  /** Media playlist URL, used to refresh expired segment URLs. */
  playlistUrl: string
  title: string
  customFileName: string
  isGetMP4: boolean
  /** Save through StreamSaver (one segment in memory) instead of a Blob. */
  saveAsStream: boolean
  /** 1-based inclusive segment range. */
  startSegment: number
  endSegment: number
  m3u8Content: string
  tsUrlList: string[]
  aes: { method: string; uri: string; iv: string } | null
  durationSecond: number
  backend: SegmentBackend
  status: TaskStatus
  /** Queue position: lower runs first. */
  order: number
  createdAt: number
}

interface TaskState {
  tasks: Record<string, TaskRecord>
  upsertTask: (task: TaskRecord) => void
  patchTask: (id: string, patch: Partial<TaskRecord>) => void
  removeTask: (id: string) => void
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set) => ({
      tasks: {},

      upsertTask: (task) =>
        set((state) => ({ tasks: { ...state.tasks, [task.id]: task } })),

      patchTask: (id, patch) =>
        set((state) => {
          const task = state.tasks[id]
          if (!task) return state
          return { tasks: { ...state.tasks, [id]: { ...task, ...patch } } }
        }),

      removeTask: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.tasks
          return { tasks: rest }
        }),
    }),
    {
      name: 'vidl-tasks',
      storage: createIndexedDBStorage('vidl', 'stores'),
      // IndexedDB is browser-only: hydrate on the client instead of during SSR.
      skipHydration: true,
      partialize: (state) => ({ tasks: state.tasks }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) logger.error('Failed to rehydrate task store:', error)
      },
    },
  ),
)

let hydration: Promise<void> | undefined

/**
 * Hydrate once and resolve when the persisted tasks are loaded. Writing before
 * hydration finishes would be overwritten by the persisted row, so every
 * writer awaits this first.
 */
export function ensureTasksHydrated(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  hydration ??= Promise.resolve(useTaskStore.persist.rehydrate()).catch(
    (error) => {
      logger.error('Task store hydration failed:', error)
    },
  )
  return hydration
}
