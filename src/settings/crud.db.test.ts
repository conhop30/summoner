import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { initializeSchema } from '../db/schema'
import { DEFAULT_SETTINGS } from './types'
import { getSettings, updateSettings } from './crud'
import { getAllChampionCatalog, getChampionCatalogSyncStatus } from '../championCatalog/crud'

function freshDb() {
  const db = new Database(':memory:')
  initializeSchema(db)
  return db
}

describe('settings in a real database', () => {
  it('starts from the defaults', () => {
    expect(getSettings(freshDb())).toEqual(DEFAULT_SETTINGS)
  })

  it('persists changes across reads', () => {
    const db = freshDb()
    updateSettings(db, { theme_volume: 0.25, music_enabled: true })
    expect(getSettings(db)).toMatchObject({ theme_volume: 0.25, music_enabled: true })
  })

  it('lets a settings blob saved by an older release inherit its music volume for themes', () => {
    const db = freshDb()
    db.prepare(`INSERT INTO schema_meta (key, value) VALUES ('app_settings', ?)`)
      .run(JSON.stringify({ theme: 'light', music_volume: 0.07 }))
    const s = getSettings(db)
    expect(s.theme).toBe('light')
    expect(s.theme_volume).toBe(0.07)
  })
})

describe('the synced champion roster', () => {
  it('reads back what a sync stored, with the portrait URL built from its version', () => {
    const db = freshDb()
    db.prepare(`
      INSERT INTO ddragon_champions (id, ddragon_version, key, name, title, tags, partype, stats, image_full, synced_at)
      VALUES ('Rakan', '16.1.1', '497', 'Rakan', 'The Charmer', '["Support"]', 'Mana', '{"attackrange":300}', 'Rakan.png', 't')
    `).run()
    const [rakan] = getAllChampionCatalog(db)
    expect(rakan).toMatchObject({ id: 'Rakan', name: 'Rakan', tags: ['Support'], stats: { attackrange: 300 } })
    expect(rakan.image_url).toBe('https://ddragon.leagueoflegends.com/cdn/16.1.1/img/champion/Rakan.png')
  })

  it('reports no sync before one has happened', () => {
    expect(getChampionCatalogSyncStatus(freshDb())).toEqual({ version: null, synced_at: null })
  })
})
