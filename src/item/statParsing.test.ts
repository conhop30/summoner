import { describe, it, expect } from 'vitest'
import type { Item } from './types'
import {
  structuredStatsFor, descriptionStatsFor, allStatsFor, compareStatLabels, CHAMP_KEY_BY_LABEL,
} from './statParsing'

function item(extra: Partial<Item>): Item {
  return {
    id: '1', ddragon_version: '16.1.1', name: 'Test', purchasable: true, tags: [], stats: {}, maps: {},
    synced_at: '2026-01-01T00:00:00.000Z', ...extra,
  }
}

const desc = (lines: string) => `<mainText><stats>${lines}</stats><br><li>Passive text</mainText>`

describe('structuredStatsFor', () => {
  it('translates Data Dragon stat keys into labelled stats', () => {
    expect(structuredStatsFor(item({ stats: { FlatHPPoolMod: 300, PercentAttackSpeedMod: 0.25 } }))).toEqual([
      { label: 'Health', value: 300, isPercent: false },
      { label: 'Attack Speed', value: 0.25, isPercent: true },
    ])
  })

  it('skips zero values and keys it does not know', () => {
    expect(structuredStatsFor(item({ stats: { FlatHPPoolMod: 0, SomethingNew: 5 } }))).toEqual([])
  })
})

describe('descriptionStatsFor', () => {
  it('reads flat and percent stats out of the description block', () => {
    const stats = descriptionStatsFor(item({
      description: desc('<attention>65</attention> Attack Damage<br><attention>20%</attention> Attack Speed<br><attention>8</attention> Ability Haste'),
    }))
    expect(stats).toEqual([
      { label: 'Attack Damage', value: 65, isPercent: false },
      { label: 'Attack Speed', value: 0.2, isPercent: true },
      { label: 'Ability Haste', value: 8, isPercent: false },
    ])
  })

  it('drops a leading "Base" from the label', () => {
    const stats = descriptionStatsFor(item({ description: desc('<attention>100%</attention> Base Mana Regen') }))
    expect(stats).toEqual([{ label: 'Mana Regen', value: 1, isPercent: true }])
  })

  it('handles decimals', () => {
    const stats = descriptionStatsFor(item({ description: desc('<attention>2.5</attention> Health Regen') }))
    expect(stats[0].value).toBe(2.5)
  })

  it('returns nothing when there is no stats block or no description', () => {
    expect(descriptionStatsFor(item({ description: '<mainText>Just passive</mainText>' }))).toEqual([])
    expect(descriptionStatsFor(item({}))).toEqual([])
  })
})

describe('allStatsFor', () => {
  it('prefers the structured value and adds text-only stats after it, with no duplicates', () => {
    const merged = allStatsFor(item({
      stats: { FlatPhysicalDamageMod: 55 },
      description: desc('<attention>50</attention> Attack Damage<br><attention>10</attention> Ability Haste'),
    }))
    expect(merged).toEqual([
      { label: 'Attack Damage', value: 55, isPercent: false },
      { label: 'Ability Haste', value: 10, isPercent: false },
    ])
  })
})

describe('compareStatLabels', () => {
  it('orders the common stats by importance', () => {
    expect(['Armor', 'Health', 'Attack Speed'].sort(compareStatLabels)).toEqual(['Health', 'Armor', 'Attack Speed'])
  })

  it('puts unlisted stats after the listed ones, alphabetically', () => {
    expect(['Zeal Thing', 'Health', 'Aftershock Thing'].sort(compareStatLabels)).toEqual(['Health', 'Aftershock Thing', 'Zeal Thing'])
  })
})

describe('CHAMP_KEY_BY_LABEL', () => {
  it('only maps onto stat keys the champion model actually has', () => {
    const championKeys = new Set(['health', 'health_regen', 'resource', 'resource_regen', 'armor', 'magic_resistance', 'attack_damage', 'attack_speed', 'movement_speed'])
    for (const key of Object.values(CHAMP_KEY_BY_LABEL)) expect(championKeys.has(key)).toBe(true)
  })
})
