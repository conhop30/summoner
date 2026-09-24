import { create } from 'zustand'

export interface PlayingTheme {
  championId: string
  name: string
  src: string
}

interface ThemeStore {
  // The champion theme currently playing, or null. While set, background music stands down.
  playing: PlayingTheme | null
  play: (theme: PlayingTheme) => void
  // Pass a championId to stop only if that champion's theme is the one playing
  // (so leaving a page never cuts off a theme started somewhere else).
  stop: (championId?: string) => void
}

export const useChampionTheme = create<ThemeStore>((set, get) => ({
  playing: null,
  play: theme => set({ playing: theme }),
  stop: championId => {
    const current = get().playing
    if (!current) return
    if (championId === undefined || current.championId === championId) set({ playing: null })
  },
}))
