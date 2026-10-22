import type { TaskRecord } from './task-store'

export interface TaskRows {
  tasks: Record<string, TaskRecord>
  /** id -> deletion time, so a stale copy in another tab cannot resurrect it. */
  tombstones: Record<string, number>
}

const TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Merge two views of the persisted task rows (e.g. this tab's memory and what
 * another tab wrote). Per task the newer `updatedAt` wins; a tombstone newer
 * than a record deletes it. `keepLocal` marks tasks this tab is driving, whose
 * local copy always wins.
 */
export function mergeRows(
  local: TaskRows,
  remote: TaskRows | null | undefined,
  keepLocal: (id: string) => boolean = () => false,
  now = Date.now(),
): TaskRows {
  const tombstones: Record<string, number> = {}
  for (const source of [remote?.tombstones, local.tombstones]) {
    for (const [id, at] of Object.entries(source ?? {})) {
      if (now - at < TOMBSTONE_TTL_MS) {
        tombstones[id] = Math.max(tombstones[id] ?? 0, at)
      }
    }
  }

  const tasks: Record<string, TaskRecord> = {}
  const ids = new Set([
    ...Object.keys(local.tasks),
    ...Object.keys(remote?.tasks ?? {}),
  ])
  for (const id of ids) {
    const mine = local.tasks[id]
    const theirs = remote?.tasks[id]
    if (keepLocal(id)) {
      if (mine) tasks[id] = mine
      continue
    }
    const pick =
      mine && theirs
        ? mine.updatedAt >= theirs.updatedAt
          ? mine
          : theirs
        : (mine ?? theirs)
    if (!pick || (tombstones[id] ?? 0) >= pick.updatedAt) continue
    tasks[id] = pick
  }
  return { tasks, tombstones }
}

export function sameRows(a: TaskRows, b: TaskRows | null | undefined): boolean {
  if (!b) return false
  const idsA = Object.keys(a.tasks)
  if (idsA.length !== Object.keys(b.tasks).length) return false
  for (const id of idsA) {
    if (a.tasks[id].updatedAt !== b.tasks[id]?.updatedAt) return false
  }
  const tombA = Object.keys(a.tombstones)
  if (tombA.length !== Object.keys(b.tombstones).length) return false
  return tombA.every((id) => a.tombstones[id] === b.tombstones[id])
}
