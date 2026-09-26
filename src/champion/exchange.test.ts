import { describe, expect, it } from 'vitest'
import type { Abilities, Champion, Effect } from './types'
import type { ChampionRecord, ImageRef } from '../interchange/types'
import { FORMAT, VERSION } from '../interchange/types'
import { parseInterchange } from '../interchange/sanitize'
import { defaultAbilities, defaultBaseStats } from './utils'
import { defaultBuilds } from '../item/buildLogic'
import {
  actionFor, championToRecord, classify, conceptSnapshot, recordToChampion, type ImageOf,
} from './exchange'

const PNG: ImageRef = {
  mime: 'image/png',
  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
}
const T1 = '2026-09-01T10:00:00.000Z'
const T2 = '2026-09-10T10:00:00.000Z'
const T3 = '2026-09-20T10:00:00.000Z'

function champion(overrides: Partial<Champion> = {}): Champion {
  const builds = defaultBuilds()
  return {
    identity: { name: 'Nyxara', title: 'The Lantern', class: ['Mage'] },
    base_stats: { ...defaultBaseStats(), health: 600, attack_speed: 0.65 } as Champion['base_stats'],
    abilities: defaultAbilities() as Abilities,
    builds,
    active_build_id: builds[0].id,
    metadata: { id: '11111111-aaaa-4bbb-8ccc-222222222222', created_at: T1, updated_at: T2, concept_updated_at: T2, version: '1.0', is_favorite: true, tags: ['fox'] },
    ...overrides,
  }
}

// Serves an image for any path that ends in .png, like the main process would from disk.
const imageOf: ImageOf = path => (path.endsWith('.png') ? PNG : undefined)

const toRecord = (c: Champion, scope: 'concept' | 'full' = 'concept') => championToRecord(c, scope, imageOf)!

describe('conceptSnapshot', () => {
  it('ignores theme audio and key order, but notices identity, ability and tag changes', () => {
    const base = champion()
    const withAudio = champion({ identity: { ...base.identity, theme_audio: { name: 'a.mp3', src: 'app-asset://x' } } })
    const reordered = champion({ identity: { class: ['Mage'], title: 'The Lantern', name: 'Nyxara' } })
    expect(conceptSnapshot(withAudio)).toBe(conceptSnapshot(base))
    expect(conceptSnapshot(reordered)).toBe(conceptSnapshot(base))

    const renamed = champion({ identity: { ...base.identity, name: 'Other' } })
    const edited = champion({ abilities: { ...base.abilities, q: { ...base.abilities.q, name: 'Bolt' } } })
    const described = champion({ abilities: { ...base.abilities, w: { ...base.abilities.w, description: 'Slows.' } } })
    const iconed = champion({ abilities: { ...base.abilities, e: { ...base.abilities.e, icon_path: 'app-asset://x/e.png' } } })
    const tagged = champion({ metadata: { ...base.metadata, tags: ['fox', 'mage'] } })
    for (const changed of [renamed, edited, described, iconed, tagged]) expect(conceptSnapshot(changed)).not.toBe(conceptSnapshot(base))
  })

  it('moves when a journal note or a block\'s kind, name, description or recast condition changes', () => {
    const withBlock = champion()
    withBlock.abilities.q = { ...withBlock.abilities.q, blocks: [{ id: 'blk-1', kind: 'recast', name: 'Recall', recast: { max_recasts: 1, recast_window: 3, recast_extends_on: 'after a hit' } }] }
    const noted = champion({ abilities: { ...withBlock.abilities, w: { ...withBlock.abilities.w, journal: { tabs: [{ id: 'tab-1', name: 'n', content: 'idea', created_at: T1 }] } } } })
    const renamed = champion({ abilities: { ...withBlock.abilities, q: { ...withBlock.abilities.q, blocks: [{ ...withBlock.abilities.q.blocks![0], name: 'Return' }] } } })
    const reworded = champion({ abilities: { ...withBlock.abilities, q: { ...withBlock.abilities.q, blocks: [{ ...withBlock.abilities.q.blocks![0], recast: { max_recasts: 1, recast_window: 3, recast_extends_on: 'after a kill' } }] } } })
    for (const changed of [champion(), noted, renamed, reworded]) expect(conceptSnapshot(changed)).not.toBe(conceptSnapshot(withBlock))
  })

  it('does not move when only stats, builds, ability or block numbers, or the favorite flag change', () => {
    const base = champion()
    base.abilities.q = { ...base.abilities.q, blocks: [{ id: 'blk-1', kind: 'recast', name: 'Recall', cooldown: [3, 3, 3, 3, 3], recast: { max_recasts: 1, recast_window: 3, recast_extends_on: 'after a hit' } }] }
    const statted = champion({ base_stats: { ...base.base_stats, health: 999 }, abilities: base.abilities })
    const starred = champion({ metadata: { ...base.metadata, is_favorite: false }, abilities: base.abilities })
    const tuned = champion({ abilities: { ...base.abilities, q: { ...base.abilities.q, cooldown: [9, 8, 7, 6, 5], cost: [1, 2, 3, 4, 5], effects: [{ type: 'stun' }], max_rank: 4, blocks: [{ ...base.abilities.q.blocks![0], cooldown: [1, 1, 1, 1, 1], effects: [{ type: 'heal' }], recast: { max_recasts: 5, recast_window: 9, recast_extends_on: 'after a hit' } }] } } })
    for (const same of [statted, starred, tuned]) expect(conceptSnapshot(same)).toBe(conceptSnapshot(champion({ abilities: base.abilities })))
  })
})

describe('championToRecord', () => {
  it('carries the concept and leaves desktop-only data out of a concept export', () => {
    const c = champion({ identity: { name: 'Nyxara', image_path: 'app-asset://x/splash.png', theme_audio: { name: 'a.mp3', src: 'app-asset://x/a.mp3' } } })
    const record = toRecord(c)
    expect(record.identity.name).toBe('Nyxara')
    expect(record.identity.splash).toEqual(PNG)
    expect(record.desktop).toBeUndefined()
    const text = JSON.stringify(record)
    expect(text).not.toContain('app-asset')
    expect(text).not.toContain('theme_audio')
    expect(text).not.toContain('image_path')
  })

  it('adds stats, builds and ability numbers only for a full export', () => {
    const c = champion()
    c.abilities.q = { ...c.abilities.q, name: 'Bolt', cooldown: [8, 7, 6, 5, 4], effects: [{ type: 'damage' }] }
    const record = toRecord(c, 'full')
    expect(record.desktop?.base_stats.health).toBe(600)
    expect(record.desktop?.builds).toHaveLength(1)
    expect(record.desktop?.abilities.q.cooldown).toEqual([8, 7, 6, 5, 4])
    expect(record.desktop?.abilities.q).not.toHaveProperty('name')
    expect(record.abilities.q).toEqual({ name: 'Bolt' })
    // A concept export has the name but none of the numbers.
    const concept = toRecord(c)
    expect(concept.abilities.q).toEqual({ name: 'Bolt' })
    expect(JSON.stringify(concept)).not.toContain('cooldown')
    expect(JSON.stringify(concept)).not.toContain('effects')
  })

  it('embeds ability icons and skips images it cannot read', () => {
    const abilities = defaultAbilities() as Abilities
    abilities.q = { ...abilities.q, icon_path: 'app-asset://x/q.png' }
    abilities.w = { ...abilities.w, icon_path: 'app-asset://x/gone.jpg' }
    const record = toRecord(champion({ abilities }))
    expect(record.abilities.q.icon).toEqual(PNG)
    expect(record.abilities.w.icon).toBeUndefined()
  })

  it('writes the champion stamp, not the last-saved time', () => {
    const c = champion()
    c.metadata.updated_at = T3 // a stats edit moved updated_at, not the concept
    expect(toRecord(c).concept_updated_at).toBe(T2)
  })

  it('produces a record the parser accepts unchanged', () => {
    const c = champion({ identity: { name: 'Nyxara', lore: 'Story', image_path: 'app-asset://x/s.png', image_position: { x: 40, y: 10 } } })
    const record = toRecord(c, 'full')
    const file = { format: FORMAT, version: VERSION, scope: 'full', exported_at: T3, champions: [record] }
    const parsed = parseInterchange(JSON.parse(JSON.stringify(file)))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.file.warnings).toEqual([])
      expect(parsed.file.records[0]).toEqual(record)
    }
  })
})

describe('classify and actionFor', () => {
  const record = (stamp: string) => ({ ...toRecord(champion()), concept_updated_at: stamp }) as ChampionRecord

  it('classifies by the concept stamp', () => {
    const local = champion() // concept stamp T2
    expect(classify(undefined, record(T2))).toBe('new')
    expect(classify(local, record(T2))).toBe('unchanged')
    expect(classify(local, record(T3))).toBe('update')
    expect(classify(local, record(T1))).toBe('local-newer')
  })

  it('falls back to updated_at for a champion saved before the concept stamp existed', () => {
    const old = champion()
    delete old.metadata.concept_updated_at
    expect(classify(old, record(T2))).toBe('unchanged')
  })

  it('applies what is safe automatically and asks only about newer-here champions', () => {
    expect(actionFor('new', 'keep-mine')).toBe('apply')
    expect(actionFor('update', 'keep-mine')).toBe('apply')
    expect(actionFor('unchanged', 'take-theirs')).toBe('skip')
    expect(actionFor('local-newer', 'keep-mine')).toBe('skip')
    expect(actionFor('local-newer', 'take-theirs')).toBe('apply')
    expect(actionFor('local-newer', 'keep-both')).toBe('copy')
  })
})

describe('recordToChampion: updating, never overwriting', () => {
  const noAssets = { icons: {} }

  it('keeps stats, builds, ability numbers, theme audio and favorite when a concept record updates a champion', () => {
    const local = champion({ identity: { name: 'Nyxara', theme_audio: { name: 'a.mp3', src: 'app-asset://x/a.mp3' } } })
    local.base_stats.health = 777
    local.abilities.q = {
      ...local.abilities.q, name: 'Old Q', icon_path: 'app-asset://x/oldq.png', cooldown: [8, 7, 6, 5, 4], max_rank: 4,
      journal: { tabs: [{ id: 'tab-1', name: 'n', content: 'c', created_at: T1 }] },
      blocks: [
        { id: 'blk-form-1', kind: 'alternate_form', name: 'Old form', description: 'Old.', cooldown: [9, 9, 9, 9], effects: [{ type: 'damage', base: [1, 2, 3, 4] }] },
        { id: 'blk-recast', kind: 'recast', name: 'Recall', recast: { max_recasts: 3, recast_window: 5, recast_extends_on: 'old condition' } },
        { id: 'blk-gone', kind: 'passive', name: 'Removed on the phone', cooldown: [1, 1, 1, 1] },
      ],
    }
    const record: ChampionRecord = {
      ...toRecord(champion()), concept_updated_at: T3, tags: ['fox', 'edited'],
      identity: { name: 'Nyxara, Renamed', lore: 'New lore' },
      abilities: {
        ...toRecord(champion()).abilities,
        q: {
          name: 'New Q', description: 'Fresh text.',
          journal: { tabs: [{ id: 'tab-9', name: 'Phone note', content: 'from the bus', created_at: T3 }] },
          blocks: [
            { id: 'blk-new-1', kind: 'passive', name: 'Added on the phone' },
            { id: 'blk-recast', kind: 'recast', name: 'Recall', condition: 'new condition' },
            { id: 'blk-form-1', kind: 'alternate_form', name: 'Renamed form', description: 'New.' },
          ],
        },
      },
    }
    const merged = recordToChampion(record, local, noAssets)
    expect(merged.abilities.q.name).toBe('New Q')
    expect(merged.abilities.q.description).toBe('Fresh text.')
    expect(merged.abilities.q.icon_path).toBeUndefined() // the file has no icon, so it is removed
    expect(merged.abilities.q.cooldown).toEqual([8, 7, 6, 5, 4])
    expect(merged.abilities.q.max_rank).toBe(4)
    // Blocks and notes are concept: the file's set, order and text win, and the phone's deletion sticks...
    expect(merged.abilities.q.journal?.tabs[0].name).toBe('Phone note')
    expect(merged.abilities.q.blocks?.map(b => b.id)).toEqual(['blk-new-1', 'blk-recast', 'blk-form-1'])
    expect(merged.abilities.q.blocks?.[2]).toMatchObject({ name: 'Renamed form', description: 'New.' })
    // ...while each block keeps its own numbers, matched by id.
    expect(merged.abilities.q.blocks?.[2]).toMatchObject({ cooldown: [9, 9, 9, 9], effects: [{ type: 'damage', base: [1, 2, 3, 4] }] })
    expect(merged.abilities.q.blocks?.[1].recast).toEqual({ max_recasts: 3, recast_window: 5, recast_extends_on: 'new condition' })
    expect(merged.abilities.q.blocks?.[0].cooldown).toBeUndefined() // a block born on the phone has no numbers yet
    expect(merged.identity.name).toBe('Nyxara, Renamed')
    expect(merged.identity.lore).toBe('New lore')
    expect(merged.metadata.tags).toEqual(['fox', 'edited'])
    expect(merged.base_stats.health).toBe(777)
    expect(merged.builds).toEqual(local.builds)
    expect(merged.active_build_id).toBe(local.active_build_id)
    expect(merged.identity.theme_audio).toEqual(local.identity.theme_audio)
    expect(merged.metadata.is_favorite).toBe(true)
    expect(merged.metadata.id).toBe(local.metadata.id)
    expect(merged.metadata.created_at).toBe(local.metadata.created_at)
  })

  it('carries the incoming concept stamp, so importing the same file again changes nothing', () => {
    const local = champion()
    const record = { ...toRecord(champion()), concept_updated_at: T3 } as ChampionRecord
    const merged = recordToChampion(record, local, noAssets)
    expect(merged.metadata.concept_updated_at).toBe(T3)
    expect(classify(merged, record)).toBe('unchanged')
  })

  it('points image_path and icon_path at the newly written files, and drops images the file lacks', () => {
    const local = champion({ identity: { name: 'Nyxara', image_path: 'app-asset://old/splash.png' } })
    const withImages = recordToChampion(toRecord(champion()), local, { splash: 'app-asset://new/s.jpg', icons: { q: 'app-asset://new/q.png' } })
    expect(withImages.identity.image_path).toBe('app-asset://new/s.jpg')
    expect(withImages.abilities.q.icon_path).toBe('app-asset://new/q.png')
    const withoutImages = recordToChampion(toRecord(champion()), local, noAssets)
    expect(withoutImages.identity.image_path).toBeUndefined()
  })

  it('builds a new champion with default stats and builds when the id is unknown', () => {
    const merged = recordToChampion(toRecord(champion()), null, noAssets)
    expect(merged.base_stats).toMatchObject({ attack_range: [0], crit_damage_multiplier: 1.75 })
    expect(merged.builds).toHaveLength(1)
    expect(merged.active_build_id).toBe(merged.builds[0].id)
    expect(merged.metadata.is_favorite).toBe(false)
    expect(merged.metadata.id).toBe(champion().metadata.id)
  })

  it('a full record does replace stats, builds and ability numbers', () => {
    const record = { ...toRecord(champion(), 'full'), concept_updated_at: T3 } as ChampionRecord
    record.desktop!.base_stats = { ...record.desktop!.base_stats, health: 640 }
    record.desktop!.abilities.q = { max_rank: 5, cooldown: [5, 5, 5, 5, 5] }
    const local = champion()
    local.base_stats.health = 500
    local.abilities.q = { ...local.abilities.q, cooldown: [9, 9, 9, 9, 9] }
    const merged = recordToChampion(record, local, noAssets)
    expect(merged.base_stats.health).toBe(640)
    expect(merged.abilities.q.cooldown).toEqual([5, 5, 5, 5, 5])
  })

  it('"keep both" makes a separate copy with its own id and name, leaving the original alone', () => {
    const local = champion()
    const copy = recordToChampion(toRecord(champion()), local, noAssets, { asCopy: true })
    expect(copy.metadata.id).not.toBe(local.metadata.id)
    expect(copy.identity.name).toBe('Nyxara (imported)')
    expect(copy.metadata.is_favorite).toBe(false)
    expect(local.identity.name).toBe('Nyxara')
  })
})

describe('the mobile round trip', () => {
  it('desktop → mobile edit → desktop changes the story and leaves the numbers alone', () => {
    // Desktop side: a champion with stats, exported for mobile.
    const desktop = champion()
    desktop.base_stats.health = 615
    desktop.abilities.q = { ...desktop.abilities.q, cooldown: [8, 7, 6, 5, 4], cost: [50, 55, 60, 65, 70], effects: [{ type: 'damage', base: [1, 2, 3, 4, 5] }] }
    const exported = JSON.parse(JSON.stringify(toRecord(desktop))) as ChampionRecord
    expect(exported.desktop).toBeUndefined()

    // Mobile side: parses with the desktop section dropped, edits an ability, stamps it newer.
    const parsed = parseInterchange({ format: FORMAT, version: VERSION, scope: 'concept', exported_at: T3, champions: [exported] }, { includeDesktop: false })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const edited: ChampionRecord = JSON.parse(JSON.stringify(parsed.file.records[0]))
    edited.abilities.q = { ...edited.abilities.q, name: 'Lantern Bolt', description: 'Written on the bus.' }
    edited.concept_updated_at = T3

    // Back on the desktop: it is an update, and stats survive.
    expect(classify(desktop, edited)).toBe('update')
    const merged = recordToChampion(edited, desktop, { icons: {} })
    expect(merged.abilities.q.name).toBe('Lantern Bolt')
    expect(merged.abilities.q.description).toBe('Written on the bus.')
    expect(merged.abilities.q.cooldown).toEqual([8, 7, 6, 5, 4])
    expect(merged.abilities.q.effects).toEqual(desktop.abilities.q.effects)
    expect(merged.base_stats.health).toBe(615)
    expect(merged.builds).toEqual(desktop.builds)
  })
})

describe('description tokens in files', () => {
  const dmg: Effect = { type: 'damage', damage_type: 'Magic', base: [40, 65, 90, 115, 140], ratios: [{ stat: 'ap', values: [0.45, 0.45, 0.45, 0.45, 0.45] }] }
  function tokened(): Champion {
    const c = champion()
    c.abilities.q = {
      ...c.abilities.q, name: 'Bolt', description: 'Deals {Damage} magic damage.', effects: [dmg],
      blocks: [{ id: 'blk-tok-01', kind: 'alternate_form', name: 'Form', description: 'Also deals {Hit}.', effects: [{ type: 'damage', name: 'Hit', base: [5, 5, 5, 5, 5] }] }],
    }
    return c
  }
  const RESOLVED = 'Deals 40/65/90/115/140 (+45% AP) magic damage.'

  it('sends the phone the numbers, not the tokens, for abilities and blocks', () => {
    const concept = toRecord(tokened(), 'concept')
    expect(concept.abilities.q.description).toBe(RESOLVED)
    expect(concept.abilities.q.blocks![0].description).toBe('Also deals 5 physical damage.')
    expect(JSON.stringify(concept)).not.toContain('{Damage}')
    expect(JSON.stringify(concept)).not.toContain('{Hit}')
  })

  it('leaves the change snapshot on the tokens as written, so renaming one counts as an edit', () => {
    const a = tokened()
    const b = tokened()
    b.abilities.q = { ...b.abilities.q, description: 'Deals {Damage} magic damage!' }
    expect(conceptSnapshot(a)).toContain('{Damage}')
    expect(conceptSnapshot(a)).not.toBe(conceptSnapshot(b))
  })

  it('a full file carries the template, and another desktop puts the tokens back', () => {
    const full = toRecord(tokened(), 'full')
    expect(full.abilities.q.description).toBe(RESOLVED)
    expect(full.desktop!.abilities.q.template).toBe('Deals {Damage} magic damage.')
    const onAnotherMachine = recordToChampion(JSON.parse(JSON.stringify(full)), null, { icons: {} })
    expect(onAnotherMachine.abilities.q.description).toBe('Deals {Damage} magic damage.')
    expect(onAnotherMachine.abilities.q.blocks![0].description).toBe('Also deals {Hit}.')
    expect(JSON.stringify(onAnotherMachine)).not.toContain('template')
  })

  it('does not adopt a template whose text no longer matches the file', () => {
    const full = JSON.parse(JSON.stringify(toRecord(tokened(), 'full'))) as ChampionRecord
    full.abilities.q.description = 'Someone rewrote this.'
    const imported = recordToChampion(full, null, { icons: {} })
    expect(imported.abilities.q.description).toBe('Someone rewrote this.')
  })

  it('a phone round trip that did not touch the text keeps the tokens', () => {
    const desktop = tokened()
    const edited: ChampionRecord = JSON.parse(JSON.stringify(toRecord(desktop)))
    edited.abilities.q = { ...edited.abilities.q, name: 'Renamed on the bus' }
    edited.concept_updated_at = T3
    const merged = recordToChampion(edited, desktop, { icons: {} })
    expect(merged.abilities.q.name).toBe('Renamed on the bus')
    expect(merged.abilities.q.description).toBe('Deals {Damage} magic damage.')
    expect(merged.abilities.q.blocks![0].description).toBe('Also deals {Hit}.')
  })

  it('a phone edit of the text replaces the tokens, as the newer text should', () => {
    const desktop = tokened()
    const edited: ChampionRecord = JSON.parse(JSON.stringify(toRecord(desktop)))
    edited.abilities.q = { ...edited.abilities.q, description: 'Now it just hurts.' }
    edited.abilities.q.blocks = [{ ...edited.abilities.q.blocks![0], description: 'And this.' }]
    edited.concept_updated_at = T3
    const merged = recordToChampion(edited, desktop, { icons: {} })
    expect(merged.abilities.q.description).toBe('Now it just hurts.')
    expect(merged.abilities.q.blocks![0].description).toBe('And this.')
    expect(merged.abilities.q.effects).toEqual(desktop.abilities.q.effects)
  })

  it('keeps an effect\'s name through a full round trip', () => {
    const full = toRecord(tokened(), 'full')
    const back = recordToChampion(JSON.parse(JSON.stringify(full)), null, { icons: {} })
    expect(back.abilities.q.blocks![0].effects![0].name).toBe('Hit')
  })
})

describe('stat changes in files', () => {
  const shred: Effect = { type: 'stat_change', stat: 'armor', direction: 'lower', target: 'enemy', unit: 'percent', base: [20, 25, 30, 35, 40], duration: [4, 4, 4, 4, 4] }

  it('keeps every part of a stat change through a full round trip, with its duration token', () => {
    const c = champion()
    c.abilities.q = { ...c.abilities.q, name: 'Rend', description: 'Lowers armor by {Armor} for {Armor duration}.', effects: [shred] }
    const full = toRecord(c, 'full')
    const back = recordToChampion(JSON.parse(JSON.stringify(full)), null, { icons: {} })
    expect(back.abilities.q.effects).toEqual([shred])
    expect(back.abilities.q.description).toBe('Lowers armor by {Armor} for {Armor duration}.')
  })

  it('shows the phone the numbers, not the tokens', () => {
    const c = champion()
    c.abilities.q = { ...c.abilities.q, name: 'Rend', description: 'Lowers armor by {Armor} for {Armor duration}.', effects: [shred] }
    const concept = toRecord(c, 'concept')
    expect(concept.abilities.q?.description).toBe('Lowers armor by 20/25/30/35/40% for 4 s.')
  })
})
