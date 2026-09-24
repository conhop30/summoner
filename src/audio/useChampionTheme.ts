import { create } from 'zustand'

export interface PlayingTheme {
  championId: string
  name: string
  src: string
}

interface ThemeStore {
  // The champion theme currently loaded (playing OR paused), or null. While one is loaded,
  // background music stands down — pausing a theme doesn't hand the sound back to it.
  playing: PlayingTheme | null
  paused: boolean
  // Live position, written by ThemePlayer, read by the editor's progress bar.
  time: number
  duration: number
  // A seek waiting for the audio element (set by the progress bar, consumed by ThemePlayer).
  seekRequest: number | null

  // Start a theme, or resume it if it's the one already loaded (paused).
  play: (theme: PlayingTheme) => void
  pause: () => void
  seek: (seconds: number) => void
  setProgress: (time: number, duration: number) => void
  // Pass a championId to stop only if that champion's theme is the one loaded
  // (so leaving a page never cuts off a theme started somewhere else).
  stop: (championId?: string) => void
}

const IDLE = { playing: null, paused: false, time: 0, duration: 0, seekRequest: null }

export const useChampionTheme = create<ThemeStore>((set, get) => ({
  ...IDLE,
  play: theme => {
    const current = get().playing
    if (current && current.src === theme.src) set({ paused: false })
    else set({ ...IDLE, playing: theme })
  },
  pause: () => set({ paused: true }),
  seek: seconds => set({ seekRequest: seconds, time: seconds }),
  setProgress: (time, duration) => set({ time, duration }),
  stop: championId => {
    const current = get().playing
    if (!current) return
    if (championId === undefined || current.championId === championId) set({ ...IDLE })
  },
}))
