import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { initializeSchema } from '../db/schema'
import { createChampion, getChampion, updateChampion, upsertChampionRecord } from './crud'
import { actionFor, championToRecord, classify, recordToChampion } from './exchange'
import type { ChampionRecord } from '../interchange/types'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  initializeSchema(db)
})

const later = () => new Promise(resolve => setTimeout(resolve, 5))

describe('concept_updated_at', () => {
  it('starts equal to the creation time', () => {
    const c = createChampion(db, 'Kai')
    expect(c.metadata.concept_updated_at).toBe(c.metadata.created_at)
    expect(getChampion(db, c.metadata.id)!.metadata.concept_updated_at).toBe(c.metadata.created_at)
  })

  it('moves when identity, abilities or tags change', async () => {
    const c = createChampion(db, 'Kai')
    const stamp = c.metadata.concept_updated_at

    await later()
    const renamed = updateChampion(db, c.metadata.id, { identity: { title: 'The Void' } })!
    expect(renamed.metadata.concept_updated_at).not.toBe(stamp)
    expect(renamed.metadata.concept_updated_at).toBe(renamed.metadata.updated_at)

    await later()
    const edited = updateChampion(db, c.metadata.id, { abilities: { q: { max_rank: 5, name: 'Bolt' } } as never })!
    expect(edited.metadata.concept_updated_at).not.toBe(renamed.metadata.concept_updated_at)

    await later()
    const tagged = updateChampion(db, c.metadata.id, { tags: ['void'] })!
    expect(tagged.metadata.concept_updated_at).not.toBe(edited.metadata.concept_updated_at)
  })

  it('stays put when only stats, builds, ability numbers, the favorite flag or theme audio change', async () => {
    const c = createChampion(db, 'Kai')
    const stamp = c.metadata.concept_updated_at

    await later()
    const statted = updateChampion(db, c.metadata.id, { base_stats: { health: 700 } })!
    const starred = updateChampion(db, c.metadata.id, { is_favorite: true })!
    const scored = updateChampion(db, c.metadata.id, { identity: { theme_audio: { name: 'a.mp3', src: 'app-asset://a' } } })!
    const untouched = updateChampion(db, c.metadata.id, { identity: { name: 'Kai' } })!
    const numbers = updateChampion(db, c.metadata.id, { abilities: { q: { max_rank: 5, cooldown: [9, 9, 9, 9, 9], cost: [10, 10, 10, 10, 10], effects: [{ type: 'heal' }] } } as never })!
    for (const result of [statted, starred, scored, untouched, numbers]) expect(result.metadata.concept_updated_at).toBe(stamp)
    // ...while the record itself did save.
    expect(getChampion(db, c.metadata.id)!.base_stats.health).toBe(700)
    expect(getChampion(db, c.metadata.id)!.metadata.updated_at).not.toBe(c.metadata.updated_at)
  })
})

describe('block ids', () => {
  it('are filled in when a champion with id-less blocks is saved, and stay the same on the next save', () => {
    const c = createChampion(db, 'Gnar')
    const first = updateChampion(db, c.metadata.id, { abilities: { q: { max_rank: 5, blocks: [{ kind: 'alternate_form', name: 'Mega Boulder Toss' }] } } as never })!
    const id = getChampion(db, c.metadata.id)!.abilities.q.blocks![0].id
    expect(id).toBeTruthy()
    expect(first.abilities.q.blocks![0].id ?? id).toBe(id)
    const second = updateChampion(db, c.metadata.id, { abilities: { q: { ...getChampion(db, c.metadata.id)!.abilities.q, name: 'Boulder Toss' } } as never })!
    expect(getChampion(db, c.metadata.id)!.abilities.q.blocks![0].id).toBe(id)
    expect(second.abilities.q.name).toBe('Boulder Toss')
  })

  it('survive a full backup and restore, numbers and text matched by id', () => {
    const c = createChampion(db, 'Jayce')
    updateChampion(db, c.metadata.id, { abilities: { q: { max_rank: 5, name: 'Shock Blast', blocks: [
      { id: 'blk-hammer-1', kind: 'alternate_form', name: 'To the Skies', description: 'Leap.', cooldown: [16, 14, 12, 10, 8], effects: [{ type: 'dash' }] },
      { id: 'blk-recast-1', kind: 'recast', name: 'Recall', recast: { max_recasts: 2, recast_window: 4, recast_extends_on: 'within 4s' } },
    ] } } as never })
    const record = championToRecord(getChampion(db, c.metadata.id)!, 'full', () => undefined)!
    expect(record.abilities.q.blocks).toEqual([
      { id: 'blk-hammer-1', kind: 'alternate_form', name: 'To the Skies', description: 'Leap.' },
      { id: 'blk-recast-1', kind: 'recast', name: 'Recall', condition: 'within 4s' },
    ])
    expect(record.desktop?.abilities.q.blocks?.[0]).toMatchObject({ id: 'blk-hammer-1', cooldown: [16, 14, 12, 10, 8] })
    const fresh = new Database(':memory:')
    initializeSchema(fresh)
    upsertChampionRecord(fresh, recordToChampion(JSON.parse(JSON.stringify(record)), null, { icons: {} }))
    expect(getChampion(fresh, c.metadata.id)!.abilities.q.blocks).toEqual(getChampion(db, c.metadata.id)!.abilities.q.blocks)
  })
})

describe('importing into a real database', () => {
  // A record as a phone would send it: story and abilities, no stats.
  function mobileRecord(id: string, over: Partial<ChampionRecord> = {}): ChampionRecord {
    return {
      id, created_at: '2026-01-01T00:00:00.000Z', concept_updated_at: '2999-01-01T00:00:00.000Z', tags: ['phone'],
      identity: { name: 'Phone Champion', lore: 'Made on a train.' },
      abilities: { passive: {}, q: { name: 'Tap', description: 'Tap the screen.' }, w: {}, e: {}, r: {} },
      ...over,
    }
  }

  it('adds a champion the desktop has never seen, with default stats', () => {
    const record = mobileRecord('aaaaaaaa-0000-4000-8000-000000000001')
    expect(classify(getChampion(db, record.id) ?? undefined, record)).toBe('new')
    upsertChampionRecord(db, recordToChampion(record, null, { icons: {} }))
    const saved = getChampion(db, record.id)!
    expect(saved.identity.name).toBe('Phone Champion')
    expect(saved.abilities.q.name).toBe('Tap')
    expect(saved.abilities.q.max_rank).toBe(5)
    expect(saved.abilities.r.max_rank).toBe(3)
    expect(saved.base_stats.attack_range).toEqual([0])
    expect(saved.builds).toHaveLength(1)
    // Importing the same file again is a no-op.
    expect(classify(saved, record)).toBe('unchanged')
  })

  it('updates an existing champion without touching its stats, builds, ability numbers, audio or favorite', () => {
    const c = createChampion(db, 'Kai', { base_stats: { health: 640, attack_speed: 0.7 } })
    updateChampion(db, c.metadata.id, {
      is_favorite: true,
      identity: { theme_audio: { name: 't.mp3', src: 'app-asset://t' } },
      abilities: { q: { max_rank: 5, name: 'Old Q', cooldown: [8, 7, 6, 5, 4], effects: [{ type: 'damage', base: [60, 90, 120, 150, 180] }], journal: { tabs: [{ id: 'tab-1', name: 'n', content: 'scrapped', created_at: '2026-01-01T00:00:00.000Z' }] } } } as never,
    })
    const before = getChampion(db, c.metadata.id)!

    const record = mobileRecord(c.metadata.id)
    expect(classify(before, record)).toBe('update')
    upsertChampionRecord(db, recordToChampion(record, before, { icons: {} }))

    const after = getChampion(db, c.metadata.id)!
    expect(after.identity.name).toBe('Phone Champion')
    expect(after.identity.lore).toBe('Made on a train.')
    expect(after.abilities.q.name).toBe('Tap')
    expect(after.abilities.q.description).toBe('Tap the screen.')
    expect(after.abilities.q.cooldown).toEqual([8, 7, 6, 5, 4])
    expect(after.abilities.q.effects).toEqual(before.abilities.q.effects)
    expect(after.abilities.q.journal).toBeUndefined() // notes are concept: this file had none, so they are cleared
    expect(after.base_stats).toEqual(before.base_stats)
    expect(after.builds).toEqual(before.builds)
    expect(after.active_build_id).toBe(before.active_build_id)
    expect(after.identity.theme_audio).toEqual({ name: 't.mp3', src: 'app-asset://t' })
    expect(after.metadata.is_favorite).toBe(true)
    expect(after.metadata.concept_updated_at).toBe(record.concept_updated_at)
    expect(classify(after, record)).toBe('unchanged')
  })

  it('offers a choice when the desktop copy is newer, and each choice does what it says', () => {
    const c = createChampion(db, 'Kai')
    const local = getChampion(db, c.metadata.id)!
    const old = mobileRecord(c.metadata.id, { concept_updated_at: '2000-01-01T00:00:00.000Z' })
    expect(classify(local, old)).toBe('local-newer')

    // keep mine: nothing to write
    expect(actionFor('local-newer', 'keep-mine')).toBe('skip')
    expect(getChampion(db, c.metadata.id)!.identity.name).toBe('Kai')

    // keep both: a second champion appears, the first is untouched
    const copy = recordToChampion(old, local, { icons: {} }, { asCopy: true })
    upsertChampionRecord(db, copy)
    expect(getChampion(db, c.metadata.id)!.identity.name).toBe('Kai')
    expect(getChampion(db, copy.metadata.id)!.identity.name).toBe('Phone Champion (imported)')

    // take theirs: the champion becomes the file's version
    upsertChampionRecord(db, recordToChampion(old, local, { icons: {} }))
    expect(getChampion(db, c.metadata.id)!.identity.name).toBe('Phone Champion')
  })

  it('exports and re-imports a champion losslessly, stats included, for a full backup', () => {
    const c = createChampion(db, 'Kai', { base_stats: { health: 640, health_regen: 8.5, attack_speed: 0.658, attack_range: [175, 550] } })
    const record = championToRecord(getChampion(db, c.metadata.id)!, 'full', () => undefined)!
    const fresh = new Database(':memory:')
    initializeSchema(fresh)
    upsertChampionRecord(fresh, recordToChampion(JSON.parse(JSON.stringify(record)), null, { icons: {} }))
    const restored = getChampion(fresh, c.metadata.id)!
    expect(restored.base_stats).toMatchObject({ health: 640, health_regen: 8.5, attack_speed: 0.658, attack_range: [175, 550] })
    expect(restored.builds).toEqual(getChampion(db, c.metadata.id)!.builds)
    expect(restored.identity.name).toBe('Kai')
  })
})
