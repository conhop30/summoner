import { describe, it, expect } from 'vitest'
import { cooldownText, costText, detailRows } from './tooltip'
import type { Effect } from './types'

describe('the cooldown and cost line', () => {
  it('spaces the ranks out, and gives one number when they are all the same', () => {
    expect(cooldownText({ cooldown: [8, 7.5, 7, 6.5, 6] })).toBe('8 / 7.5 / 7 / 6.5 / 6 s')
    expect(cooldownText({ cooldown: [7, 7, 7, 7, 7] })).toBe('7 s')
  })

  it('says nothing when nothing is filled in', () => {
    expect(cooldownText({})).toBe('')
    expect(cooldownText({ cooldown: [0, 0, 0] })).toBe('')
    expect(costText({ cost: [0, 0, 0] })).toBe('')
  })

  it('names what the cost is paid in, and leaves it out for none', () => {
    expect(costText({ cost: [50, 55, 60], cost_type: 'Energy' })).toBe('50 / 55 / 60 Energy')
    expect(costText({ cost: [60] })).toBe('60 Mana')
    expect(costText({ cost: [60], cost_type: 'None' })).toBe('')
  })
})

describe('the rows shown when detail is asked for', () => {
  const effects: Effect[] = [
    { type: 'damage', damage_type: 'Magic', base: [40, 65, 90], ratios: [{ stat: 'ap', values: [0.45, 0.45, 0.45] }], notes: 'On hit' },
    { type: 'stat_change', stat: 'armor', direction: 'lower', target: 'enemy', unit: 'percent', base: [20, 25, 30], duration: [4, 4, 4] },
    { type: 'stat_change', stat: 'ad', direction: 'raise', target: 'self', base: [10] },
    { type: 'sleep', base: [2] },
    { type: 'stun', base: [1.5] },
  ]
  const rows = detailRows(effects)

  it('has one row for every effect, named by its outcome', () => {
    expect(rows.map(r => r.label)).toEqual(['Magic damage', 'Armor shred', 'Raise AD on self', 'Sleep', 'Stun'])
  })

  it('carries the numbers, how long it lasts, the notes and the tone', () => {
    expect(rows[0]).toMatchObject({ tone: 'magic', value: '40/65/90 (+45% AP)', lasts: '', notes: 'On hit' })
    expect(rows[1]).toMatchObject({ value: '20/25/30%', lasts: 'for 4 s' })
    expect(rows[4].lasts).toBe('')
  })

  it('is empty when there are no effects', () => {
    expect(detailRows(undefined)).toEqual([])
  })
})
