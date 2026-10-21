import { logger } from '@cdlab/utils'
import type { StoreApi } from 'zustand'
import { create } from 'zustand'
import type { DownloadStore } from '@/stores/download-store'
import { createDownloadStore } from '@/stores/download-store'
import { useSettingsStore } from '@/stores/settings-store'
import type { TaskRecord, TaskStatus } from '@/stores/task-store'
import { ensureTasksHydrated, useTaskStore } from '@/stores/task-store'
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

/** Reactive view of manager state the task list needs. */
export const useQueueUi = create<{
  ready: boolean
  /** Task ids another tab is already driving. */
  lockedElsewhere: Record<string, boolean>
}>()(() => ({ ready: false, lockedElsewhere: {} }))

/**
 * Owns one engine + view-state store per task and decides which queued tasks
 * download. Task status in `useTaskStore` is the single source of truth, so any
 * status change (engine completion, a click) re-runs the scheduler.
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
      if (task.status === 'saved') store.removeTask(task.id)
    }
    await this.sweepOrphans()

    const tasks = Object.values(useTaskStore.getState().tasks).sort(
      (a, b) => a.order - b.order,
    )
    for (const task of tasks) {
      // Nothing resumes by itself after a reload; the user clicks Resume.
      const status: TaskStatus =
        task.status === 'queued' || task.status === 'downloading'
          ? 'paused'
          : task.status
      if (status !== task.status) {
        useTaskStore.getState().patchTask(task.id, { status })
      }
      const runtime = this.createRuntime()
      this.runtimes.set(task.id, runtime)
      await runtime.engine.load({ ...task, status }, { restored: true })
      if (status !== 'ready' && !(await runtime.engine.acquireLock())) {
        useQueueUi.setState((ui) => ({
          lockedElsewhere: { ...ui.lockedElsewhere, [task.id]: true },
        }))
      }
    }
    useQueueUi.setState({ ready: true })

    useTaskStore.subscribe(() => this.schedule())
    useSettingsStore.subscribe(() => this.schedule())
    this.tick ??= setInterval(() => this.onTick(), TICK_MS)
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
    useTaskStore.getState().upsertTask(record)
    void runtime.engine.checkStorage(s.estimatedSize)
    void navigator.storage?.persist?.()
    return record.id
  }

  pause(id: string) {
    const task = useTaskStore.getState().tasks[id]
    if (!task) return
    if (task.status === 'downloading') this.runtimes.get(id)?.engine.pause()
    if (task.status === 'downloading' || task.status === 'queued') {
      this.setStatus(id, 'paused')
    }
  }

  /** Paused/errored tasks re-enter the queue and start when a slot is free. */
  resume(id: string) {
    const task = useTaskStore.getState().tasks[id]
    if (!task || useQueueUi.getState().lockedElsewhere[id]) return
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
    this.runtimes.delete(id)
    if (runtime) await runtime.engine.discard()
    else useTaskStore.getState().removeTask(id)
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
      (a, b) => a.order - b.order,
    )
  }

  private setStatus(id: string, status: TaskStatus) {
    useTaskStore.getState().patchTask(id, { status })
  }

  /** Start queued tasks while there are free slots. Safe to call re-entrantly. */
  private schedule() {
    const { maxTasks } = useSettingsStore.getState()
    while (true) {
      const tasks = this.sorted()
      const running = tasks.filter((t) => t.status === 'downloading').length
      if (running >= maxTasks) return
      const next = tasks.find((t) => t.status === 'queued')
      if (!next) return
      this.setStatus(next.id, 'downloading')
      const runtime = this.runtimes.get(next.id)
      if (!runtime) {
        this.setStatus(next.id, 'error')
        continue
      }
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
  }
}

export const taskManager = new TaskManager()
