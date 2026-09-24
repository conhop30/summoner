import { describe, it, expect } from 'vitest'
import type { Database } from 'better-sqlite3'
import { DEFAULT_SETTINGS } from './types'
import { getSettings, updateSettings, withDefaults } from './crud'

// A stand-in for the one table the settings code touches, so it can be tested without SQLite.
function fakeDb(initial?: string) {
  let stored = initial
  const db = {
    prepare: (sql: string) => sql.trim().startsWith('SELECT')
      ? { get: () => (stored === undefined ? undefined : { value: stored }) }
      : { run: (args: { value: string }) => { stored = args.value } },
  }
  return { db: db as unknown as Database, read: () => stored }
}

describe('withDefaults', () => {
  it('fills in everything for an empty blob', () => {
    expect(withDefaults({})).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps what was stored', () => {
    expect(withDefaults({ theme: 'light', music_enabled: true }).theme).toBe('light')
  })

  it('lets a theme inherit the music volume when settings predate theme_volume', () => {
    expect(withDefaults({ music_volume: 0.2 }).theme_volume).toBe(0.2)
    expect(withDefaults({ music_volume: 0.01 }).theme_volume).toBe(0.01)
  })

  it('keeps an explicit theme volume, including zero', () => {
    expect(withDefaults({ music_volume: 0.2, theme_volume: 0.9 }).theme_volume).toBe(0.9)
    expect(withDefaults({ music_volume: 0.2, theme_volume: 0 }).theme_volume).toBe(0)
  })

  it('uses the default when neither volume was stored', () => {
    expect(withDefaults({ theme: 'dark' }).theme_volume).toBe(DEFAULT_SETTINGS.theme_volume)
  })
})

describe('getSettings', () => {
  it('returns the defaults before anything is saved', () => {
    expect(getSettings(fakeDb().db)).toEqual(DEFAULT_SETTINGS)
  })

  it('returns the defaults rather than throwing on a corrupt value', () => {
    expect(getSettings(fakeDb('{not json').db)).toEqual(DEFAULT_SETTINGS)
  })

  it('merges a partial saved blob over the defaults', () => {
    const s = getSettings(fakeDb(JSON.stringify({ music_enabled: true, music_volume: 0.3 })).db)
    expect(s.music_enabled).toBe(true)
    expect(s.window_frameless).toBe(DEFAULT_SETTINGS.window_frameless)
    expect(s.theme_volume).toBe(0.3)
  })
})

describe('updateSettings', () => {
  it('saves a change and returns the merged settings', () => {
    const { db, read } = fakeDb()
    const next = updateSettings(db, { theme_volume: 0.8 })
    expect(next.theme_volume).toBe(0.8)
    expect(JSON.parse(read()!).theme_volume).toBe(0.8)
  })

  it('keeps earlier changes when making a later one', () => {
    const { db } = fakeDb()
    updateSettings(db, { music_enabled: true })
    const next = updateSettings(db, { theme_volume: 0.1 })
    expect(next.music_enabled).toBe(true)
    expect(next.theme_volume).toBe(0.1)
  })
})
