import { describe, it, expect } from 'vitest'
import type { Effect } from './types'
import {
  adoptTemplate, durationPhrase, effectPhrase, effectTokenNames, hasTokens, insertAtCaret, keepTokens, renamesBetween,
  resolveSegments, resolveTokens, retargetTokens, tokenChoices, unknownTokens,
} from './descriptionTokens'

const damage: Effect = { type: 'damage', damage_type: 'Physical', base: [40, 65, 90], ratios: [{ stat: 'ap', values: [0.45, 0.45, 0.45] }] }
const stun: Effect = { type: 'stun', base: [1.5, 1.5, 1.5] }
const slow: Effect = { type: 'slow', base: [20, 25, 30], ratios: [{ stat: 'armor', part: 'bonus', per: 80, values: [1, 1, 1] }] }

describe('token names', () => {
  it('is the effect type, capitalised, when nothing was chosen', () => {
    expect(effectTokenNames([damage, stun])).toEqual(['Damage', 'Stun'])
    expect(effectTokenNames([{ type: 'knock_up' }])).toEqual(['Knock up'])
    expect(effectTokenNames([])).toEqual([])
    expect(effectTokenNames(undefined)).toEqual([])
  })

  it('numbers a repeat so every name is different', () => {
    expect(effectTokenNames([damage, damage, damage])).toEqual(['Damage', 'Damage 2', 'Damage 3'])
  })

  it('honours a name the user chose, and lets it stand in for the type', () => {
    expect(effectTokenNames([{ ...damage, name: 'Base hit' }, { ...damage, name: 'Bonus hit' }])).toEqual(['Base hit', 'Bonus hit'])
    expect(effectTokenNames([{ ...damage, name: 'Base hit' }, damage])).toEqual(['Base hit', 'Damage'])
  })

  it('serves chosen names before automatic ones, so adding a Damage never renames a chosen one', () => {
    // The third effect is called "Damage 2" by its author; the automatic second Damage must step aside.
    expect(effectTokenNames([damage, damage, { ...damage, name: 'Damage 2' }])).toEqual(['Damage', 'Damage 3', 'Damage 2'])
  })

  it('numbers two chosen names that collide, ignoring case and spacing', () => {
    expect(effectTokenNames([{ ...damage, name: 'Hit' }, { ...damage, name: '  hit ' }])).toEqual(['Hit', 'hit 2'])
  })

  it('treats a blank name as no name, and a blank type as "Effect"', () => {
    expect(effectTokenNames([{ ...damage, name: '   ' }])).toEqual(['Damage'])
    expect(effectTokenNames([{ type: '' }])).toEqual(['Effect'])
  })
})

describe('the number an effect stands for', () => {
  it('reads like an ability tooltip', () => {
    expect(effectPhrase(damage)).toBe('40/65/90 (+45% AP)')
    expect(effectPhrase(stun)).toBe('1.5 s')
    expect(effectPhrase(slow)).toBe('20/25/30% (+1% per 80 bonus armor)')
  })

  it('lists several scalers in one bracket', () => {
    expect(effectPhrase({ type: 'heal', base: [50], ratios: [{ stat: 'ap', values: [0.3] }, { stat: 'lethality', values: [0.5] }] })).toBe('50 (+30% AP, +50% lethality)')
  })

  it('works with scalers and no base, and is empty with no numbers', () => {
    expect(effectPhrase({ type: 'damage', ratios: [{ stat: 'ad', values: [0.5] }] })).toBe('50% AD')
    expect(effectPhrase({ type: 'damage' })).toBe('')
    expect(effectPhrase({ type: 'damage', base: [0, 0] })).toBe('')
  })
})

describe('resolving a description', () => {
  it('fills each token from the effect of that name', () => {
    expect(resolveTokens('Deals {Damage} magic damage and stuns for {Stun}.', [damage, stun]))
      .toBe('Deals 40/65/90 (+45% AP) magic damage and stuns for 1.5 s.')
  })

  it('tells two damages apart by their names', () => {
    const effects = [{ ...damage, name: 'Slash' }, { type: 'damage', base: [10, 20, 30], name: 'Bleed' } as Effect]
    expect(resolveTokens('{Slash}, then {Bleed} over time', effects)).toBe('40/65/90 (+45% AP) physical damage, then 10/20/30 physical damage over time')
  })

  it('tells two unnamed damages apart by their numbers', () => {
    expect(resolveTokens('{Damage} and {Damage 2}', [damage, { type: 'damage', base: [5, 5, 5] }])).toBe('40/65/90 (+45% AP) physical damage and 5 physical damage')
  })

  it('matches names without regard to case or spacing', () => {
    expect(resolveTokens('{ damage } {STUN}', [damage, stun])).toBe('40/65/90 (+45% AP) physical damage 1.5 s')
  })

  it('leaves a token that names nothing, or names an effect with no numbers yet, as written', () => {
    expect(resolveTokens('{Nope} and {Damage}', [{ type: 'damage' }])).toBe('{Nope} and {Damage}')
  })

  it('leaves ordinary text alone', () => {
    expect(resolveTokens('No tokens here', [damage])).toBe('No tokens here')
    expect(resolveTokens('', [damage])).toBe('')
    expect(resolveTokens(undefined, [damage])).toBe('')
    expect(resolveTokens('{Damage}', undefined)).toBe('{Damage}')
    expect(hasTokens('a {b} c')).toBe(true)
    expect(hasTokens('a { } c')).toBe(true)
    expect(hasTokens('a {} c')).toBe(false)
    expect(hasTokens(undefined)).toBe(false)
  })

  it('names the tokens that match no effect', () => {
    expect(unknownTokens('{Damage} {Poof} {poof} {Zap}', [damage])).toEqual(['Poof', 'Zap'])
    expect(unknownTokens('{Damage}', [damage])).toEqual([])
    expect(unknownTokens(undefined, [damage])).toEqual([])
  })
})

describe('keeping tokens when an effect is renamed', () => {
  it('rewrites the tokens for the effect that changed', () => {
    expect(retargetTokens('a {Damage} b {Stun}', [['Damage', 'Slash']])).toBe('a {Slash} b {Stun}')
  })

  it('handles a swap in one pass', () => {
    expect(retargetTokens('{A} and {B}', [['A', 'B'], ['B', 'A']])).toBe('{B} and {A}')
  })

  it('leaves everything alone when nothing was renamed', () => {
    expect(retargetTokens('{Damage}', [])).toBe('{Damage}')
    expect(retargetTokens(undefined, [['a', 'b']])).toBeUndefined()
    expect(retargetTokens('plain', [['a', 'b']])).toBe('plain')
  })

  it('works out the renames from an edit: changing a type, naming, unnaming', () => {
    const before = [damage, stun]
    expect(renamesBetween(before, [{ ...damage, type: 'heal' }, stun])).toEqual([['Damage', 'Heal']])
    expect(renamesBetween(before, [{ ...damage, name: 'Slash' }, stun])).toEqual([['Damage', 'Slash']])
    expect(renamesBetween([{ ...damage, name: 'Slash' }, stun], before)).toEqual([['Slash', 'Damage']])
    expect(renamesBetween(before, before)).toEqual([])
  })

  it('works out the renames when an effect is removed: the ones after it keep their tokens', () => {
    // Removing the first of two Damages turns "Damage 2" into "Damage"; its token must follow.
    const before = [damage, { ...damage, base: [1, 2, 3] }, stun]
    expect(renamesBetween(before, [before[1], before[2]], 0)).toEqual([['Damage 2', 'Damage']])
    // Removing the second leaves the first alone; the removed effect's own token is not touched.
    expect(renamesBetween(before, [before[0], before[2]], 1)).toEqual([])
  })

  it('keeps a description working through a real sequence of edits', () => {
    let effects: Effect[] = [damage, { type: 'damage', base: [5, 5, 5] }]
    let text = 'Hits for {Damage}, bleeds for {Damage 2}.'
    const apply = (next: Effect[], removed?: number) => {
      text = retargetTokens(text, renamesBetween(effects, next, removed))!
      effects = next
    }
    apply([effects[0], { ...effects[1], name: 'Bleed' }])
    expect(text).toBe('Hits for {Damage}, bleeds for {Bleed}.')
    apply([{ ...effects[0], name: 'Slash' }, effects[1]])
    expect(text).toBe('Hits for {Slash}, bleeds for {Bleed}.')
    expect(resolveTokens(text, effects)).toBe('Hits for 40/65/90 (+45% AP) physical damage, bleeds for 5 physical damage.')
    apply([effects[1]], 0)
    expect(text).toBe('Hits for {Slash}, bleeds for {Bleed}.')
    expect(unknownTokens(text, effects)).toEqual(['Slash'])
  })
})

describe('inserting a token', () => {
  it('puts it at the caret and moves the caret past it', () => {
    expect(insertAtCaret('dealing  damage', 8, 8, '{Damage}')).toEqual({ text: 'dealing {Damage} damage', caret: 16 })
  })

  it('replaces a selection', () => {
    expect(insertAtCaret('dealing X damage', 8, 9, '{Damage}')).toEqual({ text: 'dealing {Damage} damage', caret: 16 })
  })

  it('copes with a caret outside the text', () => {
    expect(insertAtCaret('ab', 99, 99, 'X')).toEqual({ text: 'abX', caret: 3 })
    expect(insertAtCaret('ab', -4, -4, 'X')).toEqual({ text: 'Xab', caret: 1 })
  })
})

describe('tokens across files', () => {
  it('keeps the tokens when the file brings back exactly what they resolve to', () => {
    const current = 'Deals {Damage}.'
    expect(keepTokens('Deals 40/65/90 (+45% AP) physical damage.', current, [damage])).toBe(current)
  })

  it('takes the file\'s text when it was edited', () => {
    expect(keepTokens('Deals a lot.', 'Deals {Damage}.', [damage])).toBe('Deals a lot.')
  })

  it('takes the file\'s text when there are no tokens to keep, and nothing when it has none', () => {
    expect(keepTokens('Plain', 'Also plain', [damage])).toBe('Plain')
    expect(keepTokens(undefined, 'Deals {Damage}.', [damage])).toBeUndefined()
    expect(keepTokens('Deals X', undefined, [damage])).toBe('Deals X')
  })

  it('adopts a template only if it produces exactly the text the file says', () => {
    expect(adoptTemplate('Deals 40/65/90 (+45% AP) physical damage.', 'Deals {Damage}.', [damage])).toBe('Deals {Damage}.')
    expect(adoptTemplate('Deals something else.', 'Deals {Damage}.', [damage])).toBe('Deals something else.')
    expect(adoptTemplate('Deals X', undefined, [damage])).toBe('Deals X')
    expect(adoptTemplate('Deals X', 'no tokens', [damage])).toBe('Deals X')
  })
})

describe('an effect\'s duration as a token', () => {
  const shred: Effect = { type: 'stat_change', stat: 'armor', direction: 'lower', target: 'enemy', unit: 'percent', base: [20, 25, 30], duration: [4, 4, 4] }

  it('is the effect\'s name with "duration" after it', () => {
    expect(durationPhrase(shred)).toBe('4 s')
    expect(durationPhrase({ ...shred, duration: [3, 3.5, 4] })).toBe('3/3.5/4 s')
    expect(durationPhrase({ ...shred, duration: undefined })).toBe('')
    expect(resolveTokens('Reduces {Armor} for {armor duration}.', [shred])).toBe('Reduces 20/25/30% for 4 s.')
  })

  it('stays as written until the duration is filled in', () => {
    expect(resolveTokens('For {Armor duration}.', [{ ...shred, duration: undefined }])).toBe('For {Armor duration}.')
  })

  it('does not steal a name that an effect really has', () => {
    const named: Effect = { type: 'damage', name: 'Armor duration', base: [9, 9, 9] }
    expect(resolveTokens('{Armor duration}', [shred, named])).toBe('9 physical damage')
  })

  it('is known to the checker, and follows its effect when it is renamed', () => {
    expect(unknownTokens('{Armor} {Armor duration} {Stun duration}', [shred])).toEqual(['Stun duration'])
    expect(retargetTokens('for {Armor duration}, {Armor}', [['Armor', 'Shred']])).toBe('for {Shred duration}, {Shred}')
  })

  it('is offered for effects that last a while, and not for instant ones', () => {
    const choices = tokenChoices([damage, shred]).map(c => c.token)
    expect(choices).toEqual(['Damage', 'Armor', 'Armor duration'])
    expect(tokenChoices([shred])[1].phrase).toBe('4 s')
    expect(tokenChoices([{ ...shred, duration: undefined }])[1].phrase).toBe('(no duration yet)')
  })
})

describe('the kind of damage after an amount', () => {
  const magic: Effect = { type: 'damage', damage_type: 'Magic', base: [40, 65, 90] }
  const truth: Effect = { type: 'damage', damage_type: 'True', base: [10, 10, 10] }

  it('is written in after a damage effect\'s amount when the description leaves it out', () => {
    expect(resolveTokens('Deals {Damage}.', [magic])).toBe('Deals 40/65/90 magic damage.')
    expect(resolveTokens('Deals {Damage}.', [truth])).toBe('Deals 10 true damage.')
    expect(resolveTokens('Deals {Damage}.', [{ type: 'damage', base: [5] }])).toBe('Deals 5 physical damage.')
  })

  it('is not written twice when the description already says it', () => {
    expect(resolveTokens('Deals {Damage} magic damage.', [magic])).toBe('Deals 40/65/90 magic damage.')
    expect(resolveTokens('Deals {Damage} damage.', [magic])).toBe('Deals 40/65/90 damage.')
    expect(resolveTokens('Deals {Damage} MAGIC DAMAGE.', [magic])).toBe('Deals 40/65/90 MAGIC DAMAGE.')
  })

  it('lets what was written win when it names a different kind', () => {
    expect(resolveTokens('Deals {Damage} true damage.', [magic])).toBe('Deals 40/65/90 true damage.')
  })

  it('is not added to anything but a damage amount', () => {
    expect(resolveTokens('Stuns for {Stun}.', [stun])).toBe('Stuns for 1.5 s.')
    expect(resolveTokens('Lasts {Armor duration}.', [{ type: 'stat_change', stat: 'armor', base: [1], duration: [4] }])).toBe('Lasts 4 s.')
    expect(resolveTokens('{Nope}', [magic])).toBe('{Nope}')
  })

  it('comes as runs of text, with the words that name a kind of damage marked for colouring', () => {
    expect(resolveSegments('Deals {Damage}, then {Damage 2}.', [magic, truth])).toEqual([
      { text: 'Deals 40/65/90 ' },
      { text: 'magic damage', tone: 'magic' },
      { text: ', then 10 ' },
      { text: 'true damage', tone: 'true' },
      { text: '.' },
    ])
    expect(resolveSegments('Deals {Damage} true damage.', [magic])).toEqual([
      { text: 'Deals 40/65/90 ' },
      { text: 'true damage', tone: 'true' },
      { text: '.' },
    ])
    expect(resolveSegments('Plain', [magic])).toEqual([{ text: 'Plain' }])
    expect(resolveSegments('', [magic])).toEqual([])
  })
})

describe('an effect written as what it is, in place of its numbers', () => {
  const magic: Effect = { type: 'damage', damage_type: 'Magic', base: [40, 65, 90], ratios: [{ stat: 'ap', values: [0.45, 0.45, 0.45] }] }
  const shred: Effect = { type: 'stat_change', stat: 'armor', direction: 'lower', target: 'enemy', unit: 'percent', base: [20, 25, 30], duration: [3, 3, 3] }
  const tags = { tags: true }

  it('puts the name of the effect where its numbers were', () => {
    expect(resolveSegments('Deals {Damage} to the first enemy.', [magic], tags)).toEqual([
      { text: 'Deals ' },
      { text: 'magic damage', tone: 'magic', tag: { icon: 'ap' } },
      { text: ' to the first enemy.' },
    ])
  })

  it('does not say it twice when the description already does', () => {
    const text = (s: string) => resolveSegments(s, [magic], tags).map(x => x.text).join('')
    expect(text('Deals {Damage} magic damage.')).toBe('Deals magic damage.')
    expect(text('Deals {Damage} damage.')).toBe('Deals damage.')
  })

  it('names other kinds of effect the same way, with their icons', () => {
    expect(resolveSegments('Applies {Armor}.', [shred], tags)).toEqual([
      { text: 'Applies ' },
      { text: 'armor shred', tag: { icon: 'armor' } },
      { text: '.' },
    ])
    expect(resolveSegments('Stuns with {Stun}.', [{ type: 'stun', base: [1.5] }], tags)[1]).toEqual({ text: 'stun', tag: {} })
    expect(resolveSegments('Heals for {Heal}.', [{ type: 'heal', base: [50] }], tags)[1]).toEqual({ text: 'healing', tag: { icon: 'heal' } })
  })

  it('names an effect that has no numbers yet, since it needs none', () => {
    expect(resolveSegments('Deals {Damage}.', [{ type: 'damage', damage_type: 'Magic' }], tags)[1]).toMatchObject({ text: 'magic damage' })
  })

  it('names a duration "duration", whether or not one is filled in, and leaves a token that names nothing as written', () => {
    expect(resolveSegments('For {Armor duration}. {Nope}', [shred], tags)).toEqual([
      { text: 'For ' },
      { text: 'duration', tag: {} },
      { text: '. {Nope}' },
    ])
    expect(resolveSegments('For {Armor duration}.', [{ ...shred, duration: undefined }], tags)[1]).toEqual({ text: 'duration', tag: {} })
  })

  it('still gives a duration as its number outside tag mode', () => {
    expect(resolveTokens('For {Armor duration}.', [shred])).toBe('For 3 s.')
  })

  it('does not change the text sent out of the app, which keeps its numbers', () => {
    expect(resolveTokens('Deals {Damage} to the first enemy.', [magic])).toBe('Deals 40/65/90 (+45% AP) magic damage to the first enemy.')
  })
})
