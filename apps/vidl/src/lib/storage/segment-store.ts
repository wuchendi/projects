/**
 * Durable staging area for finished (decrypted + transmuxed) segments.
 *
 * Primary backend is OPFS (file-backed, survives reloads, `File`s are not held
 * in RAM). When OPFS is missing or refuses writes, a dedicated IndexedDB
 * database is used instead. A file/row exists only after its write has fully
 * committed, so listing a task's segments is the source of truth for progress.
 */

export type SegmentBackend = 'opfs' | 'idb'

export interface SegmentStore {
  readonly backend: SegmentBackend
  put: (taskId: string, index: number, data: ArrayBuffer) => Promise<void>
  get: (taskId: string, index: number) => Promise<Blob>
  list: (taskId: string) => Promise<number[]>
  removeTask: (taskId: string) => Promise<void>
  listTasks: () => Promise<string[]>
}

const OPFS_DIR = 'vidl-segments'
const IDB_NAME = 'vidl-segments'
const IDB_STORE = 'segments'

// ============================================================
// OPFS
// ============================================================

async function opfsRoot(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(OPFS_DIR, { create: true })
}

function createOpfsStore(): SegmentStore {
  const taskDir = async (taskId: string, create: boolean) =>
    (await opfsRoot()).getDirectoryHandle(taskId, { create })

  return {
    backend: 'opfs',

    async put(taskId, index, data) {
      const dir = await taskDir(taskId, true)
      const handle = await dir.getFileHandle(String(index), { create: true })
      const writable = await handle.createWritable()
      try {
        await writable.write(data)
        await writable.close()
      } catch (error) {
        await writable.abort().catch(() => {})
        throw error
      }
    },

    async get(taskId, index) {
      const dir = await taskDir(taskId, false)
      const handle = await dir.getFileHandle(String(index))
      return handle.getFile()
    },

    async list(taskId) {
      let dir: FileSystemDirectoryHandle
      try {
        dir = await taskDir(taskId, false)
      } catch {
        return []
      }
      const indices: number[] = []
      for await (const [name, handle] of dir.entries()) {
        const index = Number(name)
        if (!Number.isInteger(index) || handle.kind !== 'file') continue
        // `put` creates the file before its contents are committed, so a
        // reload mid-write leaves an empty file that is not a finished segment.
        const file = await (handle as FileSystemFileHandle).getFile()
        if (file.size > 0) indices.push(index)
      }
      return indices.sort((a, b) => a - b)
    },

    async removeTask(taskId) {
      try {
        await (await opfsRoot()).removeEntry(taskId, { recursive: true })
      } catch (error) {
        if ((error as DOMException).name !== 'NotFoundError') throw error
      }
    },

    async listTasks() {
      const ids: string[] = []
      for await (const name of (await opfsRoot()).keys()) ids.push(name)
      return ids
    },
  }
}

/** Write, read back and delete a probe file to prove OPFS is really usable. */
async function opfsUsable(): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.storage?.getDirectory !== 'function'
  ) {
    return false
  }
  const store = createOpfsStore()
  const probe = '__probe__'
  try {
    await store.put(probe, 0, new Uint8Array([1]).buffer)
    await store.get(probe, 0)
    await store.removeTask(probe)
    return true
  } catch {
    await store.removeTask(probe).catch(() => {})
    return false
  }
}

// ============================================================
// IndexedDB fallback
// ============================================================

let idbPromise: Promise<IDBDatabase> | undefined

function openIdb(): Promise<IDBDatabase> {
  idbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IDB_STORE)
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        idbPromise = undefined
      }
      resolve(db)
    }
    request.onerror = () => {
      idbPromise = undefined
      reject(request.error)
    }
  })
  return idbPromise
}

async function idbRun<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openIdb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, mode)
    const request = run(tx.objectStore(IDB_STORE))
    // Resolve on commit, not on request success, so quota errors surface.
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

const idbKey = (taskId: string, index: number) => `${taskId}/${index}`
const idbRange = (taskId: string) =>
  IDBKeyRange.bound(`${taskId}/`, `${taskId}/￿`)

function createIdbStore(): SegmentStore {
  return {
    backend: 'idb',

    async put(taskId, index, data) {
      await idbRun('readwrite', (s) => s.put(data, idbKey(taskId, index)))
    },

    async get(taskId, index) {
      const data = await idbRun<ArrayBuffer | undefined>('readonly', (s) =>
        s.get(idbKey(taskId, index)),
      )
      if (!data) throw new Error(`Segment ${index} not found`)
      return new Blob([data])
    },

    async list(taskId) {
      const keys = await idbRun<IDBValidKey[]>('readonly', (s) =>
        s.getAllKeys(idbRange(taskId)),
      )
      return keys
        .map((key) => Number(String(key).slice(taskId.length + 1)))
        .filter(Number.isInteger)
        .sort((a, b) => a - b)
    },

    async removeTask(taskId) {
      await idbRun('readwrite', (s) => s.delete(idbRange(taskId)))
    },

    async listTasks() {
      const keys = await idbRun<IDBValidKey[]>('readonly', (s) =>
        s.getAllKeys(),
      )
      return [...new Set(keys.map((key) => String(key).split('/')[0]))]
    },
  }
}

// ============================================================
// Selection
// ============================================================

let opfsOk: Promise<boolean> | undefined

/**
 * Resolve a store. `preferred` pins a task to the backend it was created on so
 * a resumed task reads from where its segments actually are.
 */
export async function getSegmentStore(
  preferred?: SegmentBackend,
): Promise<SegmentStore> {
  if (preferred === 'idb') return createIdbStore()
  if (preferred === 'opfs') return createOpfsStore()
  opfsOk ??= opfsUsable()
  return (await opfsOk) ? createOpfsStore() : createIdbStore()
}

/** Every backend that may hold segments, for orphan sweeping. */
export async function getAllSegmentStores(): Promise<SegmentStore[]> {
  const stores: SegmentStore[] = [createIdbStore()]
  opfsOk ??= opfsUsable()
  if (await opfsOk) stores.unshift(createOpfsStore())
  return stores
}
