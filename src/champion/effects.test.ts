import { describe, it, expect } from 'vitest'
import { BUILT_IN_EFFECT_TYPES, defaultUnitFor, effectKind, guessFamily, isBuiltInEffect, unitSuffix } from './effects'

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
