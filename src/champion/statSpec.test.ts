import { describe, it, expect } from 'vitest'
import type { BaseStats } from './types'
import {
  STAT_SPECS, statSpecFor, normalizeStat, normalizeBaseStats, parseStatInput,
  formatStat, formatGrowth, statAtLevel, inputStep,
} from './statSpec'

const WHOLE: (keyof BaseStats)[] = ['health', 'resource', 'attack_damage', 'armor', 'magic_resistance', 'movement_speed']
const DECIMAL: (keyof BaseStats)[] = ['health_regen', 'resource_regen', 'attack_speed']

describe('which stats are whole numbers and which are decimals', () => {
  it.each(WHOLE)('%s is a whole number', key => {
    expect(statSpecFor(key)?.spec.kind).toBe('int')
    expect(statSpecFor(key)?.spec.decimals).toBe(0)
  })

  it.each(DECIMAL)('%s is a decimal', key => {
    expect(statSpecFor(key)?.spec.kind).toBe('float')
    expect(statSpecFor(key)?.spec.decimals).toBeGreaterThan(0)
  })

  it('has exactly one spec per stat, and every growth key points back to its stat', () => {
    const values = STAT_SPECS.map(s => s.valueKey)
    expect(new Set(values).size).toBe(values.length)
    for (const s of STAT_SPECS) {
      if (s.growthKey) expect(statSpecFor(s.growthKey)).toEqual({ spec: s, role: 'growth' })
    }
  })

  it('only attack speed grows by a percentage of its base', () => {
    expect(STAT_SPECS.filter(s => s.growthUnit === 'percent').map(s => s.valueKey)).toEqual(['attack_speed'])
  })
})

describe('normalizeStat', () => {
  it('rounds whole-number stats', () => {
    expect(normalizeStat('attack_damage', 64.7)).toBe(65)
    expect(normalizeStat('attack_damage', 64.4)).toBe(64)
    expect(normalizeStat('resource', 325.6)).toBe(326) // Data Dragon has fractional mana pools
  })

  it('trims decimal stats to their precision instead of rounding them away', () => {
    expect(normalizeStat('attack_speed', 0.6789)).toBe(0.679)
    expect(normalizeStat('health_regen', 8.5)).toBe(8.5)
    expect(normalizeStat('resource_regen', 1.6123)).toBe(1.61)
  })

  it('keeps growth to two decimals even for whole-number stats', () => {
    expect(normalizeStat('armor_growth', 4.777)).toBe(4.78)
    expect(normalizeStat('health_growth', 104)).toBe(104)
    expect(normalizeStat('attack_speed_growth', 2.5)).toBe(2.5)
  })

  it('passes non-finite numbers and unknown keys through untouched', () => {
    expect(normalizeStat('health', NaN)).toBeNaN()
    expect(normalizeStat('nope' as keyof BaseStats, 1.234)).toBe(1.234)
  })
})

describe('normalizeBaseStats', () => {
  it('normalizes every number, including the attack range array', () => {
    expect(normalizeBaseStats({ health: 610.4, attack_speed: 0.6789, attack_range: [550.4] }))
      .toEqual({ health: 610, attack_speed: 0.679, attack_range: [550] })
  })

  it('leaves missing stats missing', () => {
    expect(normalizeBaseStats({})).toEqual({})
  })
})

describe('parseStatInput', () => {
  it('treats blank or unreadable text as "not set"', () => {
    expect(parseStatInput('health', '')).toBeUndefined()
    expect(parseStatInput('health', '   ')).toBeUndefined()
    expect(parseStatInput('health', 'abc')).toBeUndefined()
  })

  it('applies each stat\'s own rules to what was typed', () => {
    expect(parseStatInput('attack_damage', '64.7')).toBe(65)
    expect(parseStatInput('attack_speed', '0.6789')).toBe(0.679)
    expect(parseStatInput('health_regen', '8.55')).toBe(8.55)
  })

  it('accepts zero', () => {
    expect(parseStatInput('armor', '0')).toBe(0)
  })
})

describe('formatting', () => {
  it('shows values without trailing zeros', () => {
    expect(formatStat('health', 610)).toBe('610')
    expect(formatStat('attack_speed', 0.658)).toBe('0.658')
    expect(formatStat('attack_speed', 0.7)).toBe('0.7')
    expect(formatStat('health_regen', 8.5)).toBe('8.5')
  })

  it('never shows a whole-number stat with decimals, or a decimal stat as a whole number', () => {
    expect(formatStat('resource', 325.6)).toBe('326')
    expect(formatStat('attack_speed', 0.658)).not.toBe('1')
  })

  it('labels growth with its unit', () => {
    expect(formatGrowth('attack_speed', 2)).toBe('+2%')
    expect(formatGrowth('health', 104)).toBe('+104')
    expect(formatGrowth('armor', 4.7)).toBe('+4.7')
    expect(formatGrowth('health_regen', 0.55)).toBe('+0.55')
  })
})

describe('statAtLevel', () => {
  it('level 1 is the base value', () => {
    expect(statAtLevel('health', 610, 104, 1)).toBe(610)
    expect(statAtLevel('attack_speed', 0.658, 2, 1)).toBe(0.658)
  })

  it('adds flat growth once per level gained', () => {
    expect(statAtLevel('health', 610, 104, 18)).toBe(2378)
    expect(statAtLevel('armor', 38, 4.7, 11)).toBe(85)
  })

  it('treats attack speed growth as a percentage of base (regression: it used to be added as points)', () => {
    // 0.658 base with +2%/level: 0.658 * (1 + 0.02 * 17) = 0.882 at level 18, not 0.658 + 2 * 17 = 34.658.
    expect(statAtLevel('attack_speed', 0.658, 2, 18)).toBe(0.882)
    expect(statAtLevel('attack_speed', 0.658, 2, 18)).toBeLessThan(2)
  })

  it('keeps decimal results decimal', () => {
    expect(statAtLevel('health_regen', 8.5, 0.55, 18)).toBe(17.85)
  })

  it('never goes below the base for levels under 1', () => {
    expect(statAtLevel('health', 610, 104, 0)).toBe(610)
    expect(statAtLevel('health', 610, 104, -3)).toBe(610)
  })
})

describe('inputStep', () => {
  it('gives whole-number stats a step of 1 and finer steps to decimals and growth', () => {
    expect(inputStep('armor')).toBe(1)
    expect(inputStep('attack_speed')).toBe(0.01)
    expect(inputStep('health_regen')).toBe(0.1)
    expect(inputStep('armor_growth')).toBe(0.1)
  })
})
