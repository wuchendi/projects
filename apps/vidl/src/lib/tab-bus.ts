/**
 * Tiny same-origin message bus between tabs (BroadcastChannel). Tabs use it to
 * announce task changes, publish download progress and send each other commands.
 */

export type TaskCommand = 'pause' | 'resume' | 'cancel' | 'release'

export interface TaskProgress {
  id: string
  finished: number
  errors: number
}

export type TabMessage =
  | { type: 'changed' }
  | { type: 'hello' }
  | { type: 'progress'; items: TaskProgress[] }
  | { type: 'cmd'; id: string; action: TaskCommand }

const CHANNEL = 'vidl-tabs'

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  channel ??= new BroadcastChannel(CHANNEL)
  return channel
}

/** False where BroadcastChannel is missing (old Safari): tabs stay independent. */
export const isTabBusAvailable = () => typeof BroadcastChannel !== 'undefined'

export function postTab(message: TabMessage) {
  getChannel()?.postMessage(message)
}

/** Listen to messages from OTHER tabs (a tab never receives its own). */
export function onTab(listener: (message: TabMessage) => void): () => void {
  const bc = getChannel()
  const handler = (event: MessageEvent<TabMessage>) => listener(event.data)
  bc?.addEventListener('message', handler)
  return () => bc?.removeEventListener('message', handler)
}
