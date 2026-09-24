import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { initializeSchema } from '../db/schema'
import type { Champion } from './types'
import { createChampion, getChampion, getAllChampions, updateChampion, upsertChampionRecord, deleteChampion } from './crud'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  initializeSchema(db)
})

describe('createChampion', () => {
  it('starts a champion from sensible defaults', () => {
    const c = createChampion(db, 'Poppy')
    expect(c.identity.name).toBe('Poppy')
    expect(c.base_stats).toMatchObject({ attack_range: [0], crit_damage_multiplier: 1.75 })
    expect(Object.keys(c.abilities).sort()).toEqual(['e', 'passive', 'q', 'r', 'w'])
    expect(c.abilities.r).toMatchObject({ max_rank: 3 })
    expect(c.builds).toHaveLength(1)
    expect(c.active_build_id).toBe(c.builds[0].id)
    expect(c.metadata).toMatchObject({ is_favorite: false, tags: [] })
    expect(c.metadata.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('keeps the identity, stats and builds it was given', () => {
    const c = createChampion(db, 'Poppy', {
      identity: { title: 'Keeper', class: ['Tank'] },
      base_stats: { health: 610, attack_speed: 0.658, attack_speed_growth: 2 },
    })
    expect(getChampion(db, c.metadata.id)).toEqual(c)
  })

  it('gives every champion its own id', () => {
    expect(createChampion(db, 'A').metadata.id).not.toBe(createChampion(db, 'A').metadata.id)
  })
})

describe('getChampion / getAllChampions', () => {
  it('returns null for an unknown id', () => {
    expect(getChampion(db, 'nope')).toBeNull()
  })

  it('round-trips everything, including decimals and arrays, exactly', () => {
    const c = createChampion(db, 'Kai', { base_stats: { health_regen: 8.5, attack_speed: 0.658, attack_range: [175, 550] } })
    const back = getChampion(db, c.metadata.id)!
    expect(back.base_stats.attack_speed).toBe(0.658)
    expect(back.base_stats.attack_range).toEqual([175, 550])
  })

  it('lists the most recently changed champion first', async () => {
    const a = createChampion(db, 'A')
    const b = createChampion(db, 'B')
    await new Promise(r => setTimeout(r, 5))
    updateChampion(db, a.metadata.id, { identity: { title: 'touched' } })
    expect(getAllChampions(db).map(c => c.identity.name)).toEqual(['A', 'B'])
    expect(b.metadata.id).not.toBe(a.metadata.id)
  })
})

describe('updateChampion', () => {
  it('changes only the fields it is given', () => {
    const c = createChampion(db, 'Poppy', { identity: { title: 'Keeper' }, base_stats: { health: 610 } })
    const updated = updateChampion(db, c.metadata.id, { identity: { lore: 'A hammer.' } })!
    expect(updated.identity).toMatchObject({ name: 'Poppy', title: 'Keeper', lore: 'A hammer.' })
    expect(updated.base_stats.health).toBe(610)
  })

  it('merges stats rather than replacing the set', () => {
    const c = createChampion(db, 'Poppy', { base_stats: { health: 610 } })
    const updated = updateChampion(db, c.metadata.id, { base_stats: { armor: 38 } })!
    expect(updated.base_stats).toMatchObject({ health: 610, armor: 38 })
  })

  it('persists the change and bumps updated_at', () => {
    const c = createChampion(db, 'Poppy')
    const updated = updateChampion(db, c.metadata.id, { is_favorite: true, tags: ['tank'] })!
    expect(getChampion(db, c.metadata.id)!.metadata).toMatchObject({ is_favorite: true, tags: ['tank'] })
    expect(updated.metadata.updated_at >= c.metadata.updated_at).toBe(true)
    expect(updated.metadata.created_at).toBe(c.metadata.created_at)
  })

  it('returns null for a champion that does not exist', () => {
    expect(updateChampion(db, 'nope', { identity: { title: 'x' } })).toBeNull()
  })

  it('points the active build at a real build when told a stale id', () => {
    const c = createChampion(db, 'Poppy')
    expect(updateChampion(db, c.metadata.id, { active_build_id: 'deleted' })!.active_build_id).toBe(c.builds[0].id)
  })
})

describe('deleteChampion', () => {
  it('removes the champion and reports whether it existed', () => {
    const c = createChampion(db, 'Poppy')
    expect(deleteChampion(db, c.metadata.id)).toBe(true)
    expect(getChampion(db, c.metadata.id)).toBeNull()
    expect(deleteChampion(db, c.metadata.id)).toBe(false)
  })
})

describe('upsertChampionRecord (import)', () => {
  it('writes a champion under its own id, and importing it twice does not duplicate it', () => {
    const original = createChampion(db, 'Poppy')
    const exported: Champion = JSON.parse(JSON.stringify(original))
    deleteChampion(db, original.metadata.id)

    upsertChampionRecord(db, exported)
    upsertChampionRecord(db, exported)

    expect(getAllChampions(db)).toHaveLength(1)
    expect(getChampion(db, original.metadata.id)).toEqual(original)
  })

  it('overwrites an existing champion with the imported version', () => {
    const c = createChampion(db, 'Poppy')
    upsertChampionRecord(db, { ...c, identity: { ...c.identity, title: 'Imported' } })
    expect(getChampion(db, c.metadata.id)!.identity.title).toBe('Imported')
  })
})

describe('older saved builds', () => {
  const insertLegacy = (buildItems: unknown, builds: unknown, activeId: string | null) => db.prepare(`
    INSERT INTO champions (id, version, created_at, updated_at, is_favorite, tags, identity, base_stats, abilities, build_items, builds, active_build_id)
    VALUES ('legacy', '1.0', 'x', 'x', 0, '[]', '{"name":"Legacy"}', '{"attack_range":[0]}', '{}', @bi, @b, @a)
  `).run({ bi: JSON.stringify(buildItems), b: JSON.stringify(builds), a: activeId })

  it('turns a flat list of item ids into a single build', () => {
    insertLegacy(['1001', '3006'], [], null)
    const c = getChampion(db, 'legacy')!
    expect(c.builds).toHaveLength(1)
    expect(c.builds[0].items).toEqual([{ item_id: '1001', count: 1 }, { item_id: '3006', count: 1 }])
    expect(c.active_build_id).toBe(c.builds[0].id)
  })

  it('keeps entries that already have counts', () => {
    insertLegacy([{ item_id: '2003', count: 3 }], [], null)
    expect(getChampion(db, 'legacy')!.builds[0].items).toEqual([{ item_id: '2003', count: 3 }])
  })

  it('gives a champion with no builds at all one empty build', () => {
    insertLegacy([], [], null)
    const c = getChampion(db, 'legacy')!
    expect(c.builds).toHaveLength(1)
    expect(c.builds[0].items).toEqual([])
  })

  it('repairs a build with a missing id or name and a stale active id', () => {
    insertLegacy([], [{ items: ['1001'] }], 'gone')
    const c = getChampion(db, 'legacy')!
    expect(c.builds[0].id).toBeTruthy()
    expect(c.builds[0].name).toBe('Build 1')
    expect(c.builds[0].items).toEqual([{ item_id: '1001', count: 1 }])
    expect(c.active_build_id).toBe(c.builds[0].id)
  })
})
