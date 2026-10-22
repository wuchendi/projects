import { logger } from '@cdlab/utils'
import { createIndexedDBStorage } from '@cdlab/zustand-idb'
import { create } from 'zustand'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { persist } from 'zustand/middleware'
import type { SegmentBackend } from '@/lib/storage/segment-store'
import type { TaskRows } from './task-merge'
import { mergeRows, sameRows } from './task-merge'

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
  /** Last change; the newer copy wins when tabs merge their rows. */
  updatedAt: number
}

interface TaskState extends TaskRows {
  upsertTask: (task: TaskRecord) => void
  patchTask: (id: string, patch: Partial<TaskRecord>) => void
  removeTask: (id: string) => void
}

const ROW_NAME = 'vidl-tasks'
const WRITE_LOCK = 'vidl-tasks-write'
const CHANNEL = 'vidl-tasks'

const indexedDb = createIndexedDBStorage<TaskRows>('vidl', 'stores')

let channel: BroadcastChannel | null = null
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  channel ??= new BroadcastChannel(CHANNEL)
  return channel
}

/** Run `fn` exclusively across tabs so read-merge-write cannot interleave. */
function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) return fn()
  return navigator.locks.request(WRITE_LOCK, fn)
}

export async function readPersistedRows(): Promise<TaskRows | null> {
  const stored = await indexedDb.getItem(ROW_NAME)
  return stored?.state ?? null
}

/**
 * Wraps the IndexedDB storage so a write merges with what other tabs already
 * saved instead of replacing it, then tells them to re-read.
 */
const mergingStorage: PersistStorage<TaskRows, Promise<void>> = {
  getItem: (name) => indexedDb.getItem(name),
  removeItem: (name) => indexedDb.removeItem(name),
  setItem: (name, value: StorageValue<TaskRows>) =>
    withWriteLock(async () => {
      const stored = await indexedDb.getItem(name)
      const merged = mergeRows(value.state, stored?.state)
      if (sameRows(merged, stored?.state)) return
      await indexedDb.setItem(name, { ...value, state: merged })
      getChannel()?.postMessage('changed')
    }),
}

/** Call `listener` when another tab changed the persisted task rows. */
export function onTasksChangedElsewhere(listener: () => void): () => void {
  const bc = getChannel()
  bc?.addEventListener('message', listener)
  return () => bc?.removeEventListener('message', listener)
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set) => ({
      tasks: {},
      tombstones: {},

      upsertTask: (task) =>
        set((state) => ({
          tasks: {
            ...state.tasks,
            [task.id]: { ...task, updatedAt: Date.now() },
          },
        })),

      patchTask: (id, patch) =>
        set((state) => {
          const task = state.tasks[id]
          if (!task) return state
          return {
            tasks: {
              ...state.tasks,
              [id]: { ...task, ...patch, updatedAt: Date.now() },
            },
          }
        }),

      removeTask: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.tasks
          return {
            tasks: rest,
            tombstones: { ...state.tombstones, [id]: Date.now() },
          }
        }),
    }),
    {
      name: ROW_NAME,
      storage: mergingStorage,
      // IndexedDB is browser-only: hydrate on the client instead of during SSR.
      skipHydration: true,
      partialize: (state) => ({
        tasks: state.tasks,
        tombstones: state.tombstones,
      }),
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
