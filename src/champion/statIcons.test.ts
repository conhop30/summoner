import { describe, it, expect } from 'vitest'
import { STAT_ICON_LABELS, iconForBaseStat, iconForStat } from './statIcons'
import { OUTCOMES, applyOutcome, outcomeById, tagIcon, tagLabel } from './outcomes'
import { RATIO_STATS } from './ratios'

describe('which icon a stat gets', () => {
  it('has a label for every icon, and an icon for the stats a person sees icons for', () => {
    expect(Object.keys(STAT_ICON_LABELS).sort()).toEqual(['ad', 'ap', 'armor', 'as', 'crit', 'heal', 'health', 'health_regen', 'lethality', 'mr', 'ms', 'range', 'resource', 'resource_regen', 'shield'])
    expect(iconForStat('ad')).toBe('ad')
    expect(iconForStat('magic_resist')).toBe('mr')
    expect(iconForStat('lethality')).toBe('lethality')
    expect(iconForStat('move_speed')).toBe('ms')
  })

  it('gives nothing for a stat that has no icon', () => {
    expect(iconForStat('ability_haste')).toBeUndefined()
    expect(iconForStat(undefined)).toBeUndefined()
    for (const stat of RATIO_STATS) expect(() => iconForStat(stat.id)).not.toThrow()
  })
})

describe('what an effect is called in a sentence', () => {
  const as = (id: string) => applyOutcome({ type: '' }, outcomeById(id)!)

  it('reads as the outcome, lower case', () => {
    expect(tagLabel(as('magic'))).toBe('magic damage')
    expect(tagLabel(as('armor_shred'))).toBe('armor shred')
    expect(tagLabel(as('heal'))).toBe('healing')
    expect(tagLabel(as('airborne'))).toBe('airborne')
    expect(tagLabel({ type: 'sleep' })).toBe('sleep')
  })

  it('names the stat for a change to some other one, and gives that stat\'s icon', () => {
    const other = { ...as('stat_up'), stat: 'lethality' }
    expect(tagLabel(other)).toBe('lethality')
    expect(tagIcon(other)).toBe('lethality')
  })

  it('gives every outcome that has a stat behind it an icon', () => {
    for (const id of ['physical', 'magic', 'heal', 'shield', 'armor', 'magic_resist', 'attack_speed', 'move_speed', 'armor_shred', 'magic_resist_shred', 'slow']) {
      expect(OUTCOMES.find(o => o.id === id)!.icon, id).toBeTruthy()
    }
  })
})

describe('the icons on the base stats', () => {
  it('cover every base stat, and are the same ones the descriptions use', () => {
    for (const field of ['health', 'health_regen', 'resource', 'resource_regen', 'attack_damage', 'attack_speed', 'armor', 'magic_resistance', 'movement_speed', 'crit_damage_multiplier', 'attack_range']) {
      expect(iconForBaseStat(field), field).toBeTruthy()
    }
    expect(iconForBaseStat('attack_damage')).toBe(iconForStat('ad'))
    expect(iconForBaseStat('magic_resistance')).toBe(iconForStat('magic_resist'))
    expect(iconForBaseStat('movement_speed')).toBe(iconForStat('move_speed'))
    expect(iconForBaseStat('health')).toBe(iconForStat('health'))
  })

  it('give a different picture to a stat and its regeneration', () => {
    expect(iconForBaseStat('health')).not.toBe(iconForBaseStat('health_regen'))
    expect(iconForBaseStat('resource')).not.toBe(iconForBaseStat('resource_regen'))
  })

  it('give nothing for a field that is not a stat', () => {
    expect(iconForBaseStat('title')).toBeUndefined()
  })
})
