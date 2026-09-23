import { create } from 'zustand'
import type { AppSettings, ThemeMode } from './types'
import { DEFAULT_SETTINGS } from './types'

interface SettingsStore {
  settings: AppSettings
  loaded: boolean
  update: (partial: Partial<AppSettings>) => Promise<void>
  // For main-process handlers that persist settings themselves and return the result.
  apply: (next: AppSettings) => void
}

function isEffectivelyLight(theme: ThemeMode): boolean {
  if (theme === 'light') return true
  if (theme === 'dark') return false
  return !window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(theme: ThemeMode) {
  if (isEffectivelyLight(theme)) {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export const useSettings = create<SettingsStore>((set, get) => {
  window.summoner.settings.getAll().then(settings => {
    applyTheme(settings.theme)
    set({ settings, loaded: true })
  })

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (get().settings.theme === 'system') applyTheme('system')
  })

  return {
    settings: DEFAULT_SETTINGS,
    loaded: false,
    update: async (partial) => {
      const next = await window.summoner.settings.update(partial)
      if (partial.theme) applyTheme(next.theme)
      set({ settings: next })
    },
    apply: (next) => set({ settings: next }),
  }
})
