import { describe, it, expect } from 'vitest'
import { RATIO_STATS, describeRatio, normalizeRatio, ratioFraction, ratioStatDef, resolveRatio } from './ratios'
import { describeEffect, effectName } from './effects'

describe('the ratio vocabulary', () => {
  it('offers base, bonus and total only for stats a champion has a base of', () => {
    for (const id of ['ad', 'armor', 'magic_resist', 'health', 'resource', 'health_regen', 'resource_regen', 'attack_speed', 'move_speed']) {
      expect(ratioStatDef(id)!.parts).toEqual(['total', 'bonus', 'base'])
    }
    for (const id of ['ap', 'lethality', 'armor_pen', 'magic_pen', 'crit_chance', 'ability_haste', 'missing_health']) {
      expect(ratioStatDef(id)!.parts).toEqual(['total'])
    }
  })

  it('has one entry per id', () => {
    expect(new Set(RATIO_STATS.map(s => s.id)).size).toBe(RATIO_STATS.length)
  })
})

describe('resolving a ratio', () => {
  it('reads the structured form as it is', () => {
    expect(resolveRatio({ stat: 'ad', part: 'bonus' })).toEqual({ stat: 'ad', part: 'bonus' })
    expect(resolveRatio({ stat: 'armor' })).toEqual({ stat: 'armor', part: 'total' })
  })

  it('treats a part the stat does not have as the total', () => {
    expect(resolveRatio({ stat: 'ap', part: 'bonus' })).toEqual({ stat: 'ap', part: 'total' })
    expect(resolveRatio({ stat: 'lethality', part: 'base' })).toEqual({ stat: 'lethality', part: 'total' })
  })

  // Every string the editor's old suggestion list offered, plus the wording people naturally use.
  it('reads the free text saved before the picker existed', () => {
    const cases: [string, { stat: string; part: string }][] = [
      ['AP', { stat: 'ap', part: 'total' }],
      ['Bonus AD', { stat: 'ad', part: 'bonus' }],
      ['Total AD', { stat: 'ad', part: 'total' }],
      ['Max Health', { stat: 'health', part: 'total' }],
      ['Missing Health', { stat: 'missing_health', part: 'total' }],
      ['Bonus Health', { stat: 'health', part: 'bonus' }],
      ['Armor', { stat: 'armor', part: 'total' }],
      ['Magic Resist', { stat: 'magic_resist', part: 'total' }],
      ['  bonus   magic resist ', { stat: 'magic_resist', part: 'bonus' }],
      ['Base Armor', { stat: 'armor', part: 'base' }],
      ['Bonus Mana Regen', { stat: 'resource_regen', part: 'bonus' }],
      ['Critical Strike Chance', { stat: 'crit_chance', part: 'total' }],
      ['Bonus AP', { stat: 'ap', part: 'total' }],
    ]
    for (const [text, expected] of cases) expect(resolveRatio({ stat: text }), text).toEqual(expected)
  })

  it('leaves text it cannot place alone', () => {
    expect(resolveRatio({ stat: 'Stacks' })).toBeNull()
    expect(resolveRatio({ stat: '' })).toBeNull()
    expect(resolveRatio({ stat: 'constructor' })).toBeNull()
    const odd = { stat: 'Stacks', values: [1] }
    expect(normalizeRatio(odd)).toBe(odd)
  })

  it('rewrites a placeable ratio in the structured form and keeps its numbers', () => {
    expect(normalizeRatio({ stat: 'Bonus AD', values: [0.5, 0.6] })).toEqual({ stat: 'ad', part: 'bonus', values: [0.5, 0.6] })
  })
})

describe('reading ratio numbers', () => {
  it('reads a number above 5 as a percentage', () => {
    expect(ratioFraction(0.6)).toBe(0.6)
    expect(ratioFraction(60)).toBe(0.6)
    expect(ratioFraction(-80)).toBe(-0.8)
  })
})

describe('describing a ratio', () => {
  it('says the percentage and the stat', () => {
    expect(describeRatio({ stat: 'ap', values: [0.45, 0.45, 0.45] })).toBe('45% AP')
    expect(describeRatio({ stat: 'ad', part: 'bonus', values: [0.4, 0.5, 0.6] })).toBe('40–60% bonus AD')
    expect(describeRatio({ stat: 'armor', part: 'base', values: [60] })).toBe('60% base armor')
  })

  it('says nothing for a ratio with no value yet', () => {
    expect(describeRatio({ stat: 'ap', values: [0, 0, 0] })).toBeNull()
    expect(describeRatio({ stat: 'ap', values: [] })).toBeNull()
  })

  it('shows a stat it cannot place as typed', () => {
    expect(describeRatio({ stat: 'Stacks', values: [0.1] })).toBe('10% Stacks')
  })
})

describe('describing an effect on one line', () => {
  it('reads like the ability tooltip', () => {
    expect(describeEffect({ type: 'damage', damage_type: 'Magic', base: [40, 65, 90], ratios: [{ stat: 'ap', values: [0.45, 0.45, 0.45] }] }))
      .toBe('Damage · Magic · 40/65/90 + 45% AP')
  })

  it('keeps several scalers on the same line', () => {
    expect(describeEffect({ type: 'heal', base: [50], ratios: [{ stat: 'ap', values: [0.3] }, { stat: 'resource_regen', part: 'bonus', values: [1] }, { stat: 'lethality', values: [0.5] }] }))
      .toBe('Heal · 50 + 30% AP + 100% bonus resource regen + 50% lethality')
  })

  it('shows the unit of a control and defaults damage to physical', () => {
    expect(describeEffect({ type: 'taunt', base: [1.5, 1.5] })).toBe('Taunt · 1.5 s')
    expect(describeEffect({ type: 'damage', base: [100] })).toBe('Damage · Physical · 100')
    expect(describeEffect({ type: 'slow', base: [30, 40] })).toBe('Slow · 30/40%')
  })

  it('says so when there is nothing yet, and makes a name from a type', () => {
    expect(describeEffect({ type: 'stun' })).toBe('Stun · no numbers yet')
    expect(describeEffect({ type: 'damage', base: [0, 0], ratios: [{ stat: 'ap', values: [0, 0] }] })).toBe('Damage · Physical · no numbers yet')
    expect(effectName('knock_up')).toBe('Knock up')
    expect(effectName('')).toBe('Effect')
  })
})
