import { describe, it, expect } from 'vitest'
import type { Champion, Identity, BaseStats } from './types'
import {
  setClass, removeClass, setRole, removeRole, setAttackType, removeAttackType,
  setAttackRange, addAttackRange, removeAttackRange, normalizeRankArray,
  toggleFavorite, addTag, removeTag,
} from './disclosure'

const identity = (extra: Partial<Identity> = {}): Identity => ({ name: 'Test', ...extra })
const stats = (attack_range: number[]): BaseStats => ({ attack_range })

describe('identity chips', () => {
  it('adds a class once — adding it again changes nothing', () => {
    const once = setClass(identity(), 'Mage')
    expect(once.class).toEqual(['Mage'])
    expect(setClass(once, 'Mage')).toBe(once)
  })

  it('supports several classes at once', () => {
    expect(setClass(setClass(identity(), 'Fighter'), 'Tank').class).toEqual(['Fighter', 'Tank'])
  })

  it('clears the field entirely when the last class is removed', () => {
    expect(removeClass(identity({ class: ['Mage'] }), 'Mage').class).toBeUndefined()
    expect(removeClass(identity({ class: ['Mage', 'Tank'] }), 'Mage').class).toEqual(['Tank'])
  })

  it('does the same for lanes and attack types', () => {
    expect(setRole(identity(), 'Mid').role).toEqual(['Mid'])
    expect(removeRole(identity({ role: ['Mid'] }), 'Mid').role).toBeUndefined()
    expect(setAttackType(identity(), 'Ranged').attack_type).toEqual(['Ranged'])
    expect(removeAttackType(identity({ attack_type: ['Ranged'] }), 'Ranged').attack_type).toBeUndefined()
  })

  it('never mutates the identity it was given', () => {
    const original = identity({ class: ['Mage'] })
    setClass(original, 'Tank')
    removeClass(original, 'Mage')
    expect(original.class).toEqual(['Mage'])
  })
})

describe('attack range', () => {
  it('sets, adds and removes values', () => {
    expect(setAttackRange(stats([0]), [550]).attack_range).toEqual([550])
    expect(addAttackRange(stats([175]), 550).attack_range).toEqual([175, 550])
  })

  it('does not add a value that is already there', () => {
    const s = stats([175])
    expect(addAttackRange(s, 175)).toBe(s)
  })

  it('falls back to [0] rather than ending up with no range at all', () => {
    expect(removeAttackRange(stats([550]), 550).attack_range).toEqual([0])
    expect(removeAttackRange(stats([175, 550]), 175).attack_range).toEqual([550])
  })
})

describe('normalizeRankArray', () => {
  it('leaves an array that already fits alone', () => {
    const v = [1, 2, 3]
    expect(normalizeRankArray(v, 3)).toBe(v)
  })

  it('pads with the last value when ranks are added', () => {
    expect(normalizeRankArray([10, 20], 5)).toEqual([10, 20, 20, 20, 20])
  })

  it('pads an empty array with zeros', () => {
    expect(normalizeRankArray([], 3)).toEqual([0, 0, 0])
  })

  it('trims when ranks are removed', () => {
    expect(normalizeRankArray([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3])
  })
})

describe('champion-level helpers', () => {
  const champion = { metadata: { is_favorite: false, tags: ['a'] } } as unknown as Champion

  it('toggles the favourite flag without touching the original', () => {
    expect(toggleFavorite(champion).metadata.is_favorite).toBe(true)
    expect(toggleFavorite(toggleFavorite(champion)).metadata.is_favorite).toBe(false)
    expect(champion.metadata.is_favorite).toBe(false)
  })

  it('adds a tag once and removes it by name', () => {
    const tagged = addTag(champion, 'b')
    expect(tagged.metadata.tags).toEqual(['a', 'b'])
    expect(addTag(tagged, 'b')).toBe(tagged)
    expect(removeTag(tagged, 'a').metadata.tags).toEqual(['b'])
  })
})
