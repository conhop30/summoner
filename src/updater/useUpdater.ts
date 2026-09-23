import { create } from 'zustand'
import type { UpdateState } from './types'

interface UpdaterStore {
  state: UpdateState
  currentVersion: string
  // "Later" hides the banner for this session; Settings still shows the update.
  dismissed: boolean
  dismiss: () => void
  init: () => () => void
}

export const useUpdater = create<UpdaterStore>((set) => ({
  state: { status: 'idle' },
  currentVersion: '',
  dismissed: false,
  dismiss: () => set({ dismissed: true }),
  init: () => {
    window.summoner.updater.getVersion().then(currentVersion => set({ currentVersion }))
    window.summoner.updater.getState().then(state => set({ state }))
    return window.summoner.updater.onState(state => set({ state }))
  },
}))
