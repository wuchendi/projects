import { logger } from '@cdlab/utils'
import type { StoreApi } from 'zustand'
import { create } from 'zustand'
import type { DownloadStore } from '@/stores/download-store'
import { createDownloadStore } from '@/stores/download-store'
import { useSettingsStore } from '@/stores/settings-store'
import { mergeRows, sameRows } from '@/stores/task-merge'
import type { TaskRecord, TaskStatus } from '@/stores/task-store'
import {
  ensureTasksHydrated,
  onTasksChangedElsewhere,
  readPersistedRows,
  useTaskStore,
} from '@/stores/task-store'
import type { EngineNotifier } from './download-engine'
import { DownloadEngine } from './download-engine'
import { getAllSegmentStores, getSegmentStore } from './storage/segment-store'
import type { TaskOptions } from './task-record'
import { buildTaskRecord } from './task-record'

export interface TaskRuntime {
  engine: DownloadEngine
  store: StoreApi<DownloadStore>
}

const TICK_MS = 2_000
/** A saved task's staged data is kept this long so the browser can finish reading it. */
const SAVED_GRACE_MS = 10 * 60 * 1000

/** Reactive view of manager state the task list needs. */
export const useQueueUi = create<{
  ready: boolean
  /** Bumped whenever this tab starts or stops driving a task. */
  runtimeVersion: number
}>()(() => ({ ready: false, runtimeVersion: 0 }))

/**
 * Owns one engine + view-state store per task this tab drives and decides which
 * queued tasks download. Task status in `useTaskStore` is the single source of
 * truth, so any status change (engine completion, a click, another tab's write)
 * re-runs the scheduler. Tasks without a runtime belong to another tab.
 */
class TaskManager {
  private runtimes = new Map<string, TaskRuntime>()
  private notify: EngineNotifier = {
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
  }
  private initPromise: Promise<void> | null = null
  private tick: ReturnType<typeof setInterval> | null = null
  private adopting = false

  setNotifier(notify: EngineNotifier) {
    this.notify = notify
  }

  getRuntime(id: string): TaskRuntime | undefined {
    return this.runtimes.get(id)
  }

  /** Load persisted tasks (restored paused), sweep leftovers, start the loop. */
  init(): Promise<void> {
    this.initPromise ??= this.doInit()
    return this.initPromise
  }

  private async doInit() {
    await ensureTasksHydrated()
    const store = useTaskStore.getState()

    for (const task of Object.values(store.tasks)) {
      if (
        task.status === 'saved' &&
        Date.now() - task.updatedAt > SAVED_GRACE_MS
      ) {
        store.removeTask(task.id)
      }
    }
    await this.sweepOrphans()

    for (const task of this.sorted()) await this.attach(task)

    useTaskStore.subscribe(() => this.schedule())
    useSettingsStore.subscribe(() => this.schedule())
    onTasksChangedElsewhere(() => void this.syncFromStorage())
    this.tick ??= setInterval(() => this.onTick(), TICK_MS)
    useQueueUi.setState({ ready: true })
    this.schedule()
  }

  private createRuntime(): TaskRuntime {
    const store = createDownloadStore()
    const stable: EngineNotifier = {
      success: (m) => this.notify.success(m),
      error: (m) => this.notify.error(m),
      warning: (m) => this.notify.warning(m),
      info: (m) => this.notify.info(m),
    }
    return {
      store,
      engine: new DownloadEngine(
        store,
        () => useSettingsStore.getState(),
        stable,
      ),
    }
  }

  /**
   * Start driving a persisted task in this tab. Nothing resumes by itself: an
   * unfinished task comes back paused. Returns false (and leaves the record
   * alone) when another tab holds the task.
   */
  private async attach(task: TaskRecord): Promise<boolean> {
    if (this.runtimes.has(task.id)) return true
    if (task.status === 'saved') return false

    const status: TaskStatus =
      task.status === 'queued' || task.status === 'downloading'
        ? 'paused'
        : task.status
    const runtime = this.createRuntime()
    await runtime.engine.load({ ...task, status }, { restored: true })
    // A ready task only needs saving, so it takes no lock.
    if (status !== 'ready' && !(await runtime.engine.acquireLock())) {
      return false
    }

    this.runtimes.set(task.id, runtime)
    if (status !== task.status) {
      useTaskStore.getState().patchTask(task.id, { status })
    }
    useQueueUi.setState((ui) => ({ runtimeVersion: ui.runtimeVersion + 1 }))
    return true
  }

  /** Remove staged segments nobody owns (no record, and no other tab running). */
  private async sweepOrphans() {
    const keep = new Set(Object.keys(useTaskStore.getState().tasks))
    for (const segments of await getAllSegmentStores()) {
      for (const id of await segments.listTasks()) {
        if (keep.has(id)) continue
        const held = await navigator.locks?.query()
        if (held?.held?.some((lock) => lock.name === `vidl-task-${id}`)) {
          continue
        }
        await segments.removeTask(id).catch(() => {})
      }
    }
  }

  // ============================================================
  // Multi-tab
  // ============================================================

  /** Pull in changes other tabs persisted; tasks this tab drives stay as is. */
  private async syncFromStorage() {
    const remote = await readPersistedRows()
    if (!remote) return
    const { tasks, tombstones } = useTaskStore.getState()
    const local = { tasks, tombstones }
    const merged = mergeRows(local, remote, (id) => this.runtimes.has(id))
    if (!sameRows(merged, local)) useTaskStore.setState(merged)
  }

  /** Take over tasks whose owning tab is gone (their lock is free). */
  private async adoptAbandoned() {
    const foreign = this.sorted().filter(
      (t) =>
        !this.runtimes.has(t.id) &&
        t.status !== 'saved' &&
        t.status !== 'ready',
    )
    if (foreign.length === 0 || this.adopting) return
    this.adopting = true
    try {
      const held = (await navigator.locks?.query())?.held ?? []
      for (const task of foreign) {
        if (held.some((lock) => lock.name === `vidl-task-${task.id}`)) continue
        await this.attach(task)
      }
    } finally {
      this.adopting = false
    }
  }

  // ============================================================
  // Queue actions
  // ============================================================

  /** Turn a parsed download into a queued task. Returns its id. */
  async enqueue(
    source: StoreApi<DownloadStore>,
    options: TaskOptions,
  ): Promise<string | null> {
    const s = source.getState()
    if (s.tsUrlList.length === 0) return null
    if (options.saveAsStream && !(window as any).streamSaver) {
      this.notify.error('streamSaverNotLoaded')
      return null
    }

    await this.init()
    const segments = await getSegmentStore()
    const tasks = Object.values(useTaskStore.getState().tasks)
    const order = tasks.reduce((max, t) => Math.max(max, t.order), 0) + 1
    const record = buildTaskRecord(s, options, {
      id: crypto.randomUUID(),
      backend: segments.backend,
      order,
    })

    const runtime = this.createRuntime()
    this.runtimes.set(record.id, runtime)
    await runtime.engine.load(record, { restored: false })
    await runtime.engine.acquireLock()
    runtime.store.getState().setEstimatedSize(s.estimatedSize)
    useQueueUi.setState((ui) => ({ runtimeVersion: ui.runtimeVersion + 1 }))
    useTaskStore.getState().upsertTask(record)
    void runtime.engine.checkStorage(s.estimatedSize)
    void navigator.storage?.persist?.()
    return record.id
  }

  pause(id: string) {
    const runtime = this.runtimes.get(id)
    const task = useTaskStore.getState().tasks[id]
    if (!runtime || !task) return
    if (task.status === 'downloading') runtime.engine.pause()
    if (task.status === 'downloading' || task.status === 'queued') {
      this.setStatus(id, 'paused')
    }
  }

  /** Paused/errored tasks re-enter the queue and start when a slot is free. */
  resume(id: string) {
    const task = useTaskStore.getState().tasks[id]
    if (!task || !this.runtimes.has(id)) return
    if (task.status === 'paused' || task.status === 'error') {
      this.setStatus(id, 'queued')
    }
  }

  pauseAll() {
    for (const task of this.sorted()) this.pause(task.id)
  }

  resumeAll() {
    for (const task of this.sorted()) this.resume(task.id)
  }

  async cancel(id: string) {
    const runtime = this.runtimes.get(id)
    if (!runtime) return
    this.runtimes.delete(id)
    useQueueUi.setState((ui) => ({ runtimeVersion: ui.runtimeVersion + 1 }))
    await runtime.engine.discard()
  }

  async clearFinished() {
    for (const task of this.sorted()) {
      if (task.status === 'saved') await this.cancel(task.id)
    }
  }

  save(id: string) {
    return this.runtimes.get(id)?.engine.saveTask()
  }

  retrySegment(id: string, index: number) {
    return this.runtimes.get(id)?.engine.retry(index)
  }

  forceDownload(id: string) {
    return this.runtimes.get(id)?.engine.forceDownload()
  }

  // ============================================================
  // Scheduler
  // ============================================================

  private sorted(): TaskRecord[] {
    return Object.values(useTaskStore.getState().tasks).sort(
      (a, b) => a.order - b.order || a.createdAt - b.createdAt,
    )
  }

  private setStatus(id: string, status: TaskStatus) {
    useTaskStore.getState().patchTask(id, { status })
  }

  /**
   * Start this tab's queued tasks while there are free slots. The slot count
   * covers every tab, so `maxTasks` is a global limit. Safe to call re-entrantly.
   */
  private schedule() {
    const { maxTasks } = useSettingsStore.getState()
    while (true) {
      const tasks = this.sorted()
      const running = tasks.filter((t) => t.status === 'downloading').length
      if (running >= maxTasks) return
      const next = tasks.find(
        (t) => t.status === 'queued' && this.runtimes.has(t.id),
      )
      if (!next) return
      const runtime = this.runtimes.get(next.id)
      if (!runtime) return
      this.setStatus(next.id, 'downloading')
      runtime.engine.run().catch((error) => {
        logger.error('Task run failed:', error)
        this.setStatus(next.id, 'error')
      })
    }
  }

  private onTick() {
    for (const task of this.sorted()) {
      if (task.status === 'downloading') {
        this.runtimes.get(task.id)?.engine.retryAll()
      }
    }
    void this.adoptAbandoned()
  }
}

export const taskManager = new TaskManager()
