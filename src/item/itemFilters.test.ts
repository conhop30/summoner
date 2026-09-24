import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Item } from './types'
import { sortValue, hasStatFor, compareItems, categoryOf, dedupeByName, timeAgo } from './itemFilters'

function item(extra: Partial<Item>): Item {
  return {
    id: '1', ddragon_version: '16.1.1', name: 'Test', purchasable: true, tags: [], stats: {}, maps: {},
    synced_at: '2026-01-01T00:00:00.000Z', ...extra,
  }
}

describe('sortValue and hasStatFor', () => {
  it('reads the matching stat, treating a missing one as 0', () => {
    const armor = item({ stats: { FlatArmorMod: 40 } })
    expect(sortValue(armor, 'armor')).toBe(40)
    expect(sortValue(armor, 'health')).toBe(0)
    expect(sortValue(item({ name: 'Zeal' }), 'name')).toBe('zeal')
  })

  it('hides items that lack the stat being sorted on, but never for cost or name', () => {
    const plain = item({})
    expect(hasStatFor(plain, 'armor')).toBe(false)
    expect(hasStatFor(item({ stats: { FlatArmorMod: 1 } }), 'armor')).toBe(true)
    expect(hasStatFor(plain, 'cost')).toBe(true)
    expect(hasStatFor(plain, 'name')).toBe(true)
  })
})

describe('compareItems', () => {
  const cheap = item({ id: 'a', name: 'Alpha', gold_total: 500, stats: { FlatArmorMod: 10 } })
  const pricey = item({ id: 'b', name: 'Beta', gold_total: 900, stats: { FlatArmorMod: 90 } })
  const cheapMore = item({ id: 'c', name: 'Gamma', gold_total: 500, stats: { FlatArmorMod: 30 } })

  it('sorts by cost and by name in their natural direction', () => {
    expect([pricey, cheap].sort((x, y) => compareItems(x, y, 'cost', 'asc'))[0]).toBe(cheap)
    expect([pricey, cheap].sort((x, y) => compareItems(x, y, 'name', 'asc'))[0]).toBe(cheap)
    expect([cheap, pricey].sort((x, y) => compareItems(x, y, 'name', 'desc'))[0]).toBe(pricey)
  })

  it('lets cost dominate a stat sort — the stat only breaks ties between equally priced items', () => {
    const sorted = [pricey, cheap, cheapMore].sort((x, y) => compareItems(x, y, 'armor', 'desc'))
    expect(sorted.map(i => i.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('categoryOf', () => {
  it('uses tags first: trinkets, consumables, boots', () => {
    expect(categoryOf(item({ tags: ['Trinket'], depth: 3 }))).toBe('trinkets')
    expect(categoryOf(item({ tags: ['Consumable'] }))).toBe('consumables')
    expect(categoryOf(item({ tags: ['Boots'], depth: 2 }))).toBe('boots')
  })

  it('then by build depth', () => {
    expect(categoryOf(item({ depth: 3 }))).toBe('legendary')
    expect(categoryOf(item({ depth: 2 }))).toBe('epic')
    expect(categoryOf(item({ depth: 1 }))).toBe('basic')
  })

  it('falls back to price when a reworked item comes back without a depth', () => {
    expect(categoryOf(item({ gold_total: 2500 }))).toBe('legendary')
    expect(categoryOf(item({ gold_total: 1000 }))).toBe('epic')
    expect(categoryOf(item({ gold_total: 300 }))).toBe('basic')
    expect(categoryOf(item({}))).toBe('basic')
  })
})

describe('dedupeByName', () => {
  it('keeps the lowest numeric id of items sharing a name (the Summoner\'s Rift one)', () => {
    const list = [item({ id: '223078', name: 'Kraken' }), item({ id: '6672', name: 'Kraken' }), item({ id: '1', name: 'Other' })]
    expect(dedupeByName(list).map(i => i.id).sort()).toEqual(['1', '6672'])
  })

  it('compares ids as numbers, not text', () => {
    const list = [item({ id: '900', name: 'X' }), item({ id: '1000', name: 'X' })]
    expect(dedupeByName(list)[0].id).toBe('900')
  })
})

describe('timeAgo', () => {
  afterEach(() => vi.useRealTimers())

  it('describes how long ago something happened', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
    expect(timeAgo('2026-06-01T11:59:40Z')).toBe('just now')
    expect(timeAgo('2026-06-01T11:15:00Z')).toBe('45m ago')
    expect(timeAgo('2026-06-01T07:00:00Z')).toBe('5h ago')
    expect(timeAgo('2026-05-29T12:00:00Z')).toBe('3d ago')
  })
})
