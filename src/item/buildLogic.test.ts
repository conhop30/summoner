import { describe, it, expect } from 'vitest'
import type { BuildEntry } from '../champion/types'
import type { Item } from './types'
import {
  MAX_BUILD_SLOTS, MAX_BUILDS, maxStackFor, addToBuild, removeOneFromBuild, resolveBuild,
  buildGoldTotal, aggregateBuildStats, createNamedBuild, defaultBuilds, getActiveBuild,
  addNamedBuild, renameNamedBuild, deleteNamedBuild, updateBuildItems,
} from './buildLogic'

function item(id: string, extra: Partial<Item> = {}): Item {
  return {
    id, ddragon_version: '16.1.1', name: `Item ${id}`, purchasable: true, tags: [], stats: {}, maps: {},
    synced_at: '2026-01-01T00:00:00.000Z', ...extra,
  }
}

const sword = item('1001', { gold_total: 1000, stats: { FlatPhysicalDamageMod: 10 } })
const potion = item('2003', { stacks: 5, gold_total: 50 })
const controlWard = item('2055', { stacks: 2, gold_total: 75 })

describe('maxStackFor', () => {
  it('is 1 unless the item stacks', () => {
    expect(maxStackFor(item('1'))).toBe(1)
    expect(maxStackFor(item('1', { stacks: 1 }))).toBe(1)
    expect(maxStackFor(potion)).toBe(5)
  })
})

describe('addToBuild', () => {
  it('adds a new item as a single copy', () => {
    expect(addToBuild([], sword)).toEqual([{ item_id: '1001', count: 1 }])
  })

  it('does not mutate the build it was given', () => {
    const build: BuildEntry[] = [{ item_id: '2003', count: 1 }]
    addToBuild(build, potion)
    expect(build).toEqual([{ item_id: '2003', count: 1 }])
  })

  it('non-stacking items take a slot each', () => {
    const twice = addToBuild(addToBuild([], sword), sword)
    expect(twice).toEqual([{ item_id: '1001', count: 1 }, { item_id: '1001', count: 1 }])
  })

  it('stacks consumables into one slot, then spills into the next once it is full', () => {
    let build: BuildEntry[] = []
    for (let i = 0; i < 5; i++) build = addToBuild(build, potion)
    expect(build).toEqual([{ item_id: '2003', count: 5 }])
    build = addToBuild(build, potion)
    expect(build).toEqual([{ item_id: '2003', count: 5 }, { item_id: '2003', count: 1 }])
  })

  it('hard-caps the Control Ward at its stack size with no overflow slot', () => {
    let build: BuildEntry[] = []
    for (let i = 0; i < 4; i++) build = addToBuild(build, controlWard)
    expect(build).toEqual([{ item_id: '2055', count: 2 }])
  })

  it('refuses a new item once every slot is taken', () => {
    let build: BuildEntry[] = []
    for (let i = 0; i < MAX_BUILD_SLOTS; i++) build = addToBuild(build, item(String(i)))
    expect(build).toHaveLength(MAX_BUILD_SLOTS)
    expect(addToBuild(build, sword)).toBe(build)
  })

  it('still stacks onto an existing slot when the build is full', () => {
    let build: BuildEntry[] = [{ item_id: '2003', count: 1 }]
    for (let i = 0; i < MAX_BUILD_SLOTS - 1; i++) build = addToBuild(build, item(`x${i}`))
    expect(build).toHaveLength(MAX_BUILD_SLOTS)
    expect(addToBuild(build, potion)[0]).toEqual({ item_id: '2003', count: 2 })
  })
})

describe('removeOneFromBuild', () => {
  it('takes one off a stack', () => {
    expect(removeOneFromBuild([{ item_id: '2003', count: 3 }], '2003')).toEqual([{ item_id: '2003', count: 2 }])
  })

  it('removes the slot when its last copy goes', () => {
    expect(removeOneFromBuild([{ item_id: '1001', count: 1 }], '1001')).toEqual([])
  })

  it('takes from the last slot that holds the item', () => {
    const build: BuildEntry[] = [{ item_id: '2003', count: 5 }, { item_id: '2003', count: 2 }]
    expect(removeOneFromBuild(build, '2003')).toEqual([{ item_id: '2003', count: 5 }, { item_id: '2003', count: 1 }])
  })

  it('does nothing for an item that is not in the build', () => {
    const build: BuildEntry[] = [{ item_id: '1001', count: 1 }]
    expect(removeOneFromBuild(build, '9999')).toBe(build)
  })
})

describe('resolveBuild and buildGoldTotal', () => {
  const catalog = [sword, potion]

  it('pairs entries with their catalog items and drops ones the catalog no longer has', () => {
    const resolved = resolveBuild([{ item_id: '1001', count: 1 }, { item_id: 'gone', count: 1 }], catalog)
    expect(resolved.map(r => r.item.id)).toEqual(['1001'])
  })

  it('totals gold by count', () => {
    const resolved = resolveBuild([{ item_id: '1001', count: 1 }, { item_id: '2003', count: 4 }], catalog)
    expect(buildGoldTotal(resolved)).toBe(1000 + 4 * 50)
  })

  it('treats an item with no price as free', () => {
    expect(buildGoldTotal(resolveBuild([{ item_id: '1', count: 3 }], [item('1')]))).toBe(0)
  })
})

describe('aggregateBuildStats', () => {
  it('sums a stat across items, multiplying by count', () => {
    const blade = item('1038', { stats: { FlatPhysicalDamageMod: 40 } })
    const totals = aggregateBuildStats(resolveBuild(
      [{ item_id: '1001', count: 2 }, { item_id: '1038', count: 1 }], [sword, blade],
    ))
    expect(totals.get('Attack Damage')?.value).toBe(10 * 2 + 40)
  })

  it('keeps percent stats flagged as percent', () => {
    const rageblade = item('3', { stats: { PercentAttackSpeedMod: 0.25 } })
    const totals = aggregateBuildStats(resolveBuild([{ item_id: '3', count: 2 }], [rageblade]))
    expect(totals.get('Attack Speed')).toEqual({ label: 'Attack Speed', value: 0.5, isPercent: true })
  })

  it('is empty for an empty build', () => {
    expect(aggregateBuildStats([]).size).toBe(0)
  })
})

describe('named builds', () => {
  it('starts with a single build called "Build 1"', () => {
    const builds = defaultBuilds()
    expect(builds).toHaveLength(1)
    expect(builds[0]).toMatchObject({ name: 'Build 1', items: [] })
  })

  it('gives every build a unique id', () => {
    expect(createNamedBuild('a').id).not.toBe(createNamedBuild('a').id)
  })

  it('adds builds up to the limit and no further', () => {
    let builds = defaultBuilds()
    for (let i = 0; i < MAX_BUILDS + 3; i++) builds = addNamedBuild(builds)
    expect(builds).toHaveLength(MAX_BUILDS)
    expect(builds.map(b => b.name)).toEqual(['Build 1', 'Build 2', 'Build 3', 'Build 4'])
  })

  it('renames one build and leaves the rest', () => {
    const builds = addNamedBuild(defaultBuilds())
    const renamed = renameNamedBuild(builds, builds[1].id, 'Late game')
    expect(renamed.map(b => b.name)).toEqual(['Build 1', 'Late game'])
  })

  it('deletes a build, but never the last one', () => {
    const builds = addNamedBuild(defaultBuilds())
    const one = deleteNamedBuild(builds, builds[0].id)
    expect(one).toHaveLength(1)
    expect(deleteNamedBuild(one, one[0].id)).toBe(one)
  })

  it('updates only the targeted build\'s items', () => {
    const builds = addNamedBuild(defaultBuilds())
    const updated = updateBuildItems(builds, builds[1].id, [{ item_id: '1001', count: 1 }])
    expect(updated[0].items).toEqual([])
    expect(updated[1].items).toEqual([{ item_id: '1001', count: 1 }])
  })

  it('falls back to the first build when the active id is stale', () => {
    const builds = addNamedBuild(defaultBuilds())
    expect(getActiveBuild(builds, builds[1].id)).toBe(builds[1])
    expect(getActiveBuild(builds, 'deleted')).toBe(builds[0])
  })
})
