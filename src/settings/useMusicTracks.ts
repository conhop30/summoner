import { useEffect } from 'react'
import { create } from 'zustand'
import { useSettings } from './useSettings'
import type { MusicTrack } from './types'

interface BuiltInStore {
  builtIn: MusicTrack[]
  loaded: boolean
  load: () => void
}

// Built-in songs are fixed for the life of the app, so fetch them once.
const useBuiltIn = create<BuiltInStore>((set, get) => ({
  builtIn: [],
  loaded: false,
  load: () => {
    if (get().loaded) return
    set({ loaded: true })
    window.summoner.music.listBuiltIn().then(builtIn => set({ builtIn }))
  },
}))

// Every selectable track (built-in first, then the user's own) and which one is active.
// An unset or deleted selection falls back to the first available track.
export function useMusicTracks() {
  const { builtIn, load } = useBuiltIn()
  const { settings } = useSettings()
  useEffect(load, [load])

  const tracks = [...builtIn, ...settings.music_custom_tracks]
  const current = tracks.find(t => t.id === settings.music_track) ?? tracks[0]
  return { tracks, current, builtInIds: new Set(builtIn.map(t => t.id)) }
}
