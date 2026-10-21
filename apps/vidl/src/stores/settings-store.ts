import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DownloadSettings {
  /** Tasks downloading at once; each uses `concurrency` connections. */
  maxTasks: number
  concurrency: number
  timeoutMs: number
  maxRetries: number
  retryBaseDelayMs: number
}

export const DEFAULT_SETTINGS: DownloadSettings = {
  maxTasks: 2,
  concurrency: 6,
  timeoutMs: 30_000,
  maxRetries: 3,
  retryBaseDelayMs: 1_000,
}

interface SettingsState extends DownloadSettings {
  setSettings: (next: Partial<DownloadSettings>) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setSettings: (next) => set(next),
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'vidl-download-settings',
      partialize: ({
        maxTasks,
        concurrency,
        timeoutMs,
        maxRetries,
        retryBaseDelayMs,
      }) => ({
        maxTasks,
        concurrency,
        timeoutMs,
        maxRetries,
        retryBaseDelayMs,
      }),
    },
  ),
)
