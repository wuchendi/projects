import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LaunchpadView = 'list' | 'grid'

interface LaunchpadsViewState {
  // Layout preference for the launchpads list.
  view: LaunchpadView
  setView: (v: LaunchpadView) => void
}

export const useLaunchpadsViewStore = create<LaunchpadsViewState>()(
  persist(
    (set) => ({
      view: 'grid',
      setView: (view) => set({ view }),
    }),
    {
      name: 'flnk-launchpads-view',
      partialize: (s) => ({ view: s.view }),
    },
  ),
)
