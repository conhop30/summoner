import { describe, it, expect } from 'vitest'
import { BUILT_IN_EFFECT_TYPES, CHANGEABLE_STATS, STAT_CHANGE_DEFAULTS, defaultUnitFor, describeEffect, effectKind, guessFamily, isBuiltInEffect, statChangeOf, unitSuffix } from './effects'
import { ratioStatDef } from './ratios'
import type { Effect } from './types'

describe('built-in effects', () => {
  it('lists every type the editor suggests, each with a fixed kind', () => {
    expect(BUILT_IN_EFFECT_TYPES).toContain('stun')
    for (const type of BUILT_IN_EFFECT_TYPES) {
      expect(isBuiltInEffect(type)).toBe(true)
      expect(effectKind({ type })).toBeTruthy()
    }
  })

  it('gives a built-in its own family and unit whatever is stored on it', () => {
    expect(effectKind({ type: 'stun' })).toEqual({ family: 'hard_control', unit: 'seconds' })
    expect(effectKind({ type: 'slow' })).toEqual({ family: 'soft_control', unit: 'percent' })
    expect(effectKind({ type: 'damage' })).toEqual({ family: 'damage', unit: 'flat' })
    expect(effectKind({ type: 'stun', family: 'damage', unit: 'flat' })).toEqual({ family: 'hard_control', unit: 'seconds' })
  })

  it('does not mistake an inherited property name for a built-in', () => {
    expect(isBuiltInEffect('constructor')).toBe(false)
    expect(isBuiltInEffect('toString')).toBe(false)
    expect(effectKind({ type: 'constructor' }).family).toBe('utility')
  })
})

describe('custom effects', () => {
  it('guesses what a label behaves like', () => {
    expect(guessFamily('taunt')).toBe('hard_control')
    expect(guessFamily('Root')).toBe('hard_control')
    expect(guessFamily('blind')).toBe('soft_control')
    expect(guessFamily('barrier')).toBe('sustain')
    expect(guessFamily('burn')).toBe('damage')
    expect(guessFamily('blink')).toBe('utility')
    expect(guessFamily('')).toBe('utility')
  })

  it('uses the guess until a family is picked, and the pick always wins', () => {
    expect(effectKind({ type: 'taunt' })).toEqual({ family: 'hard_control', unit: 'seconds' })
    expect(effectKind({ type: 'taunt', family: 'utility' })).toEqual({ family: 'utility', unit: 'flat' })
    expect(effectKind({ type: 'taunt', unit: 'percent' })).toEqual({ family: 'hard_control', unit: 'percent' })
  })

  it('picks the natural unit for each family', () => {
    expect(defaultUnitFor('hard_control')).toBe('seconds')
    expect(defaultUnitFor('soft_control')).toBe('percent')
    expect(defaultUnitFor('damage')).toBe('flat')
    expect(defaultUnitFor('sustain')).toBe('flat')
    expect(defaultUnitFor('utility')).toBe('flat')
  })

  it('names a unit only where it needs explaining', () => {
    expect(unitSuffix('seconds')).toBe(' (seconds)')
    expect(unitSuffix('percent')).toBe(' (%)')
    expect(unitSuffix('flat')).toBe('')
  })
})

describe('stat changes', () => {
  it('is a built-in whose unit is the effect\'s own choice between flat and percent', () => {
    expect(isBuiltInEffect('stat_change')).toBe(true)
    expect(effectKind({ type: 'stat_change' })).toEqual({ family: 'utility', unit: 'flat' })
    expect(effectKind({ type: 'stat_change', unit: 'percent' })).toEqual({ family: 'utility', unit: 'percent' })
    expect(effectKind({ type: 'stat_change', unit: 'seconds' })).toEqual({ family: 'utility', unit: 'flat' })
  })

  it('fills in the blanks of a half-made one', () => {
    expect(statChangeOf({})).toEqual({ stat: 'armor', direction: 'raise', target: 'self' })
    expect(statChangeOf({ stat: 'not a stat' }).stat).toBe('armor')
  })

  it('reads as one line, with the duration last', () => {
    const shred: Effect = { type: 'stat_change', stat: 'armor', direction: 'lower', target: 'enemy', unit: 'percent', base: [20, 25, 30], duration: [4, 4, 4] }
    expect(describeEffect(shred)).toBe('Lower armor on an enemy · 20/25/30% · for 4 s')
    expect(describeEffect({ type: 'stat_change', ...STAT_CHANGE_DEFAULTS })).toBe('Raise armor on self · no numbers yet')
  })

  it('only offers stats the picker knows', () => {
    for (const id of CHANGEABLE_STATS) expect(ratioStatDef(id)).toBeTruthy()
  })
})
