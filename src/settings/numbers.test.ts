import { describe, it, expect } from 'vitest'
import { NUMBERS_PRESETS, applyNumbers, presetOf } from './numbers'

describe('the two starting points', () => {
  it('are Story (nothing) and Full (everything), and are recognised as themselves', () => {
    expect(Object.values(NUMBERS_PRESETS.story).every(v => v === false)).toBe(true)
    expect(Object.values(NUMBERS_PRESETS.full).every(v => v === true)).toBe(true)
    expect(presetOf(NUMBERS_PRESETS.story)).toBe('story')
    expect(presetOf(NUMBERS_PRESETS.full)).toBe('full')
  })

  it('call any mix custom', () => {
    expect(presetOf({ numbers_abilities: true, numbers_stats: false, numbers_win_rate: false })).toBe('custom')
  })
})

describe('changing one switch', () => {
  it('turns win rate on along with the two things it needs', () => {
    expect(applyNumbers(NUMBERS_PRESETS.story, { numbers_win_rate: true })).toEqual(NUMBERS_PRESETS.full)
  })

  it('turns win rate off when either thing it needs goes off', () => {
    expect(applyNumbers(NUMBERS_PRESETS.full, { numbers_stats: false })).toEqual({ numbers_abilities: true, numbers_stats: false, numbers_win_rate: false })
    expect(applyNumbers(NUMBERS_PRESETS.full, { numbers_abilities: false })).toEqual({ numbers_abilities: false, numbers_stats: true, numbers_win_rate: false })
  })

  it('leaves the other switches alone otherwise', () => {
    expect(applyNumbers(NUMBERS_PRESETS.story, { numbers_stats: true })).toEqual({ numbers_abilities: false, numbers_stats: true, numbers_win_rate: false })
    expect(applyNumbers(NUMBERS_PRESETS.full, { numbers_win_rate: false })).toEqual({ numbers_abilities: true, numbers_stats: true, numbers_win_rate: false })
  })

  it('can set a whole starting point at once', () => {
    expect(applyNumbers(NUMBERS_PRESETS.full, NUMBERS_PRESETS.story)).toEqual(NUMBERS_PRESETS.story)
  })
})
