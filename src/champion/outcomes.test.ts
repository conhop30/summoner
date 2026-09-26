import { describe, it, expect } from 'vitest'
import { BUILT_IN_EFFECT_TYPES, CHANGEABLE_STATS, describeEffect, effectKind } from './effects'
import { KIND_OPTIONS, OUTCOMES, applyOutcome, newEffect, outcomeById, outcomeOf, outcomesFor } from './outcomes'
import type { Effect } from './types'

describe('the curated list', () => {
  it('has a unique id for every outcome and a unique label within each kind', () => {
    expect(new Set(OUTCOMES.map(o => o.id)).size).toBe(OUTCOMES.length)
    for (const { kind } of KIND_OPTIONS) {
      const labels = outcomesFor(kind).map(o => o.label)
      expect(labels.length).toBeGreaterThan(0)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('offers what a person would look for, by kind', () => {
    const labels = (kind: Parameters<typeof outcomesFor>[0]) => outcomesFor(kind).map(o => o.label)
    expect(labels('damage')).toEqual(['Physical damage', 'Magic damage', 'True damage'])
    expect(labels('buff')).toEqual(expect.arrayContaining(['Healing', 'Shielding', 'Armor', 'Magic resist', 'Attack speed', 'Movement speed']))
    expect(labels('debuff')).toEqual(expect.arrayContaining(['Armor shred', 'Magic resist shred', 'Slow', 'Taunt', 'Silence', 'Fear', 'Root', 'Stun', 'Airborne']))
    expect(labels('state')).toEqual(['Untargetable', 'Invulnerable', 'Unstoppable', 'CC immune'])
    expect(labels('custom')).toEqual(['Custom'])
  })
})

describe('choosing an outcome and reading it back', () => {
  it('reads back as itself, for every outcome', () => {
    for (const outcome of OUTCOMES) {
      const effect = applyOutcome({ type: 'damage', damage_type: 'Magic', base: [1, 2] }, outcome)
      expect(outcomeOf(effect).id, outcome.id).toBe(outcome.id)
    }
  })

  it('sets every field an outcome needs, and keeps the numbers, name and notes', () => {
    const before: Effect = { type: 'damage', damage_type: 'Magic', name: 'Hit', notes: 'n', base: [10, 20], ratios: [{ stat: 'ap', values: [1, 1] }], duration: [3, 3] }
    const shred = applyOutcome(before, outcomeById('armor_shred')!)
    expect(shred).toMatchObject({ type: 'stat_change', stat: 'armor', direction: 'lower', target: 'enemy', unit: 'percent', name: 'Hit', notes: 'n', base: [10, 20], duration: [3, 3] })
    expect(shred.damage_type).toBeUndefined()
    expect(shred.ratios).toEqual(before.ratios)
  })

  it('leaves nothing of the old outcome behind', () => {
    const shred = applyOutcome({ type: 'damage' }, outcomeById('armor_shred')!)
    const stun = applyOutcome(shred, outcomeById('stun')!)
    expect(stun).toMatchObject({ type: 'stun' })
    for (const key of ['stat', 'direction', 'target', 'unit', 'damage_type', 'family'] as const) expect(stun[key]).toBeUndefined()
  })

  it('starts a new effect as physical damage', () => {
    expect(outcomeOf(newEffect()).id).toBe('physical')
  })

  it('gives each outcome the meaning the model prices it with', () => {
    expect(effectKind(applyOutcome({ type: '' }, outcomeById('stun')!))).toEqual({ family: 'hard_control', unit: 'seconds' })
    expect(effectKind(applyOutcome({ type: '' }, outcomeById('armor_shred')!)).unit).toBe('percent')
    expect(effectKind(applyOutcome({ type: '' }, outcomeById('armor')!)).unit).toBe('flat')
    expect(effectKind(applyOutcome({ type: '' }, outcomeById('unstoppable')!))).toEqual({ family: 'utility', unit: 'seconds' })
  })
})

describe('placing an effect that already exists', () => {
  it('never leaves a built-in type as Custom', () => {
    for (const type of BUILT_IN_EFFECT_TYPES) expect(outcomeOf({ type }).id, type).not.toBe('custom')
  })

  it('reads a damage effect with no damage type as physical, as the model does', () => {
    expect(outcomeOf({ type: 'damage' }).id).toBe('physical')
    expect(outcomeOf({ type: 'damage', damage_type: 'True' }).id).toBe('true')
  })

  it('reads the older effect types as the outcome they mean', () => {
    expect(outcomeOf({ type: 'armor_modifier' }).id).toBe('armor')
    expect(outcomeOf({ type: 'magic_resistance_modifier' }).id).toBe('magic_resist')
    expect(outcomeOf({ type: 'knock_up' }).label).toBe('Airborne')
  })

  it('reads stat changes by what they change, whoever they are for', () => {
    const change = (over: Partial<Effect>): Effect => ({ type: 'stat_change', stat: 'armor', direction: 'raise', target: 'self', ...over })
    expect(outcomeOf(change({ target: 'ally' })).id).toBe('armor')
    expect(outcomeOf(change({ direction: 'lower', target: 'enemy' })).id).toBe('armor_shred')
    expect(outcomeOf(change({ stat: 'magic_resist', direction: 'lower', target: 'enemy' })).id).toBe('magic_resist_shred')
    expect(outcomeOf(change({ stat: 'move_speed' })).id).toBe('move_speed')
    expect(outcomeOf(change({ stat: 'move_speed', direction: 'lower', target: 'enemy' })).id).toBe('slow')
    expect(outcomeOf(change({ stat: 'attack_speed' })).id).toBe('attack_speed')
  })

  it('puts a change to any other stat under "Other stat…", in the right direction', () => {
    expect(outcomeOf({ type: 'stat_change', stat: 'ad', direction: 'raise', target: 'self' }).id).toBe('stat_up')
    expect(outcomeOf({ type: 'stat_change', stat: 'attack_speed', direction: 'lower', target: 'enemy' }).id).toBe('stat_down')
    expect(outcomeOf({ type: 'stat_change', stat: 'armor', direction: 'lower', target: 'self' }).id).toBe('stat_down')
  })

  it('treats an effect with a label of its own, or none yet, as custom', () => {
    expect(outcomeOf({ type: 'sleep' }).id).toBe('custom')
    expect(outcomeOf({ type: '' }).id).toBe('custom')
  })

  it('reads a summary for every outcome', () => {
    for (const outcome of OUTCOMES) expect(describeEffect(applyOutcome({ type: '' }, outcome))).toBeTruthy()
    expect(CHANGEABLE_STATS).toContain(outcomeById('stat_up')!.fields.stat)
  })
})

describe('durations when the outcome changes', () => {
  it('drops a duration the new outcome has no use for, and keeps one it does', () => {
    const shred = { ...applyOutcome({ type: '' }, outcomeById('armor_shred')!), base: [30], duration: [4] }
    expect(applyOutcome(shred, outcomeById('untargetable')!).duration).toBeUndefined()
    expect(applyOutcome(shred, outcomeById('heal')!).duration).toBeUndefined()
    expect(applyOutcome(shred, outcomeById('slow')!).duration).toEqual([4])
    expect(applyOutcome(shred, outcomeById('attack_speed')!).duration).toEqual([4])
  })

  it('does not read one out of an effect that cannot use it', () => {
    expect(describeEffect({ type: 'heal', base: [50], duration: [4] })).toBe('Heal · 50')
    expect(describeEffect({ type: 'slow', base: [30], duration: [2] })).toBe('Slow · 30% · for 2 s')
  })
})
