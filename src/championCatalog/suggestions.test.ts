import { describe, it, expect } from 'vitest'
import type { ChampionCatalogEntry, ChampionCatalogStats } from './types'
import { mapDDragonStats, computeClassAverages, getPresetsByClass } from './suggestions'

function entry(name: string, tags: string[], stats: ChampionCatalogStats): ChampionCatalogEntry {
  return { id: name, ddragon_version: '16.1.1', key: '1', name, tags, stats, synced_at: '2026-01-01T00:00:00.000Z' }
}

describe('mapDDragonStats', () => {
  it('maps Data Dragon\'s names onto ours', () => {
    const mapped = mapDDragonStats({
      hp: 610, hpperlevel: 104, hpregen: 8.5, hpregenperlevel: 0.55,
      mp: 300, mpperlevel: 40, mpregen: 1.6, mpregenperlevel: 0.4,
      attackdamage: 64, attackdamageperlevel: 3.5, attackspeed: 0.658, attackspeedperlevel: 2,
      armor: 38, armorperlevel: 4.7, spellblock: 32, spellblockperlevel: 2.05,
      movespeed: 345, attackrange: 175,
    })
    expect(mapped).toEqual({
      health: 610, health_growth: 104, health_regen: 8.5, health_regen_growth: 0.55,
      resource: 300, resource_growth: 40, resource_regen: 1.6, resource_regen_growth: 0.4,
      attack_damage: 64, attack_damage_growth: 3.5, attack_speed: 0.658, attack_speed_growth: 2,
      armor: 38, armor_growth: 4.7, magic_resistance: 32, magic_resistance_growth: 2.05,
      movement_speed: 345, attack_range: [175],
    })
  })

  it('only maps what Data Dragon provides', () => {
    expect(mapDDragonStats({ hp: 500 })).toEqual({ health: 500 })
    expect(mapDDragonStats({})).toEqual({})
  })

  it('coerces fractional values to what each stat allows', () => {
    const mapped = mapDDragonStats({ mp: 325.6, attackspeed: 0.6789, hpregen: 8.555 })
    expect(mapped.resource).toBe(326)
    expect(mapped.attack_speed).toBe(0.679)
    expect(Number.isInteger(mapped.resource)).toBe(true)
  })
})

describe('computeClassAverages', () => {
  const catalog = [
    entry('Braum', ['Tank', 'Support'], { hp: 610, hpregen: 8.5, armor: 47, attackspeed: 0.644 }),
    entry('Leona', ['Tank', 'Support'], { hp: 646, hpregen: 8.5, armor: 47, attackspeed: 0.625 }),
    entry('Ornn', ['Tank'], { hp: 660, hpregen: 9, armor: 33 }),
  ]

  it('groups by class tag, counting a multi-tag champion under each', () => {
    const result = computeClassAverages(catalog)
    expect(result.map(r => [r.tag, r.sampleSize])).toEqual([['Support', 2], ['Tank', 3]])
  })

  it('averages whole-number stats to whole numbers', () => {
    const tank = computeClassAverages(catalog).find(r => r.tag === 'Tank')!
    expect(tank.stats.health).toBe(639) // (610 + 646 + 660) / 3 = 638.67
    expect(Number.isInteger(tank.stats.armor)).toBe(true)
  })

  it('keeps decimals on decimal stats instead of rounding them to whole numbers', () => {
    const tank = computeClassAverages(catalog).find(r => r.tag === 'Tank')!
    expect(tank.stats.health_regen).toBe(8.67) // (8.5 + 8.5 + 9) / 3
    const support = computeClassAverages(catalog).find(r => r.tag === 'Support')!
    expect(support.stats.attack_speed).toBe(0.635) // (0.644 + 0.625) / 2
  })

  it('averages a stat over only the champions that have it', () => {
    const tank = computeClassAverages(catalog).find(r => r.tag === 'Tank')!
    expect(tank.stats.attack_speed).toBe(0.635) // Ornn has none
  })

  it('returns nothing for an empty roster', () => {
    expect(computeClassAverages([])).toEqual([])
  })

  it('sorts by tag name', () => {
    const tags = computeClassAverages([entry('A', ['Mage'], {}), entry('B', ['Assassin'], {})]).map(r => r.tag)
    expect(tags).toEqual(['Assassin', 'Mage'])
  })
})

describe('getPresetsByClass', () => {
  const catalog = [
    entry('Thresh', ['Support', 'Tank'], { hp: 560 }),
    entry('Braum', ['Tank', 'Support'], { hp: 610 }),
    entry('Zed', ['Assassin'], { hp: 654 }),
  ]

  it('lists every champion under each of its tags, alphabetically', () => {
    const groups = getPresetsByClass(catalog)
    expect(groups.map(g => g.tag)).toEqual(['Assassin', 'Support', 'Tank'])
    expect(groups.find(g => g.tag === 'Tank')!.champions.map(c => c.championName)).toEqual(['Braum', 'Thresh'])
    expect(groups.find(g => g.tag === 'Support')!.champions.map(c => c.championName)).toEqual(['Braum', 'Thresh'])
  })

  it('carries the champion\'s mapped stats', () => {
    const zed = getPresetsByClass(catalog).find(g => g.tag === 'Assassin')!.champions[0]
    expect(zed).toMatchObject({ championId: 'Zed', championName: 'Zed', stats: { health: 654 } })
  })
})
