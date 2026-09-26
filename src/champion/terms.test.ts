import { describe, it, expect } from 'vitest'
import { addStatPart, flatToStat, hasFlatPart, removeFlatPart, statToFlat } from './terms'
import type { Effect } from './types'

const armorBuff = (): Effect => ({ type: 'armor_modifier', base: [20, 30, 40], ratios: [{ stat: 'ad', part: 'bonus', values: [0.1, 0.1, 0.1] }] })

describe('the flat part of an amount', () => {
  it('is shown for an effect with a base, and for one with nothing yet', () => {
    expect(hasFlatPart({ base: [1, 2] })).toBe(true)
    expect(hasFlatPart({})).toBe(true)
  })

  it('is hidden once it has been moved away and something else is left', () => {
    expect(hasFlatPart({ ratios: [{ stat: 'ap', values: [1] }] })).toBe(false)
  })

  it('keeps an empty flat part when a first scaler is added, so nothing vanishes', () => {
    const next = addStatPart({ type: 'damage' }, { stat: 'ap', part: 'total', values: [0, 0, 0] })
    expect(next.base).toEqual([])
    expect(next.ratios).toHaveLength(1)
    expect(hasFlatPart(next)).toBe(true)
  })
})

describe('moving a part between flat and a stat', () => {
  it('turns the flat numbers into a scaler on the chosen stat, and drops the flat part', () => {
    const next = flatToStat(armorBuff(), 'armor', 3)
    expect(next.base).toBeUndefined()
    expect(next.ratios).toHaveLength(2)
    expect(next.ratios![1]).toEqual({ stat: 'armor', part: 'total', values: [20, 30, 40] })
    expect(next.ratios![0].stat).toBe('ad')
  })

  it('pads a short flat list to the rank count', () => {
    const next = flatToStat({ type: 'damage', base: [5] }, 'ap', 3)
    expect(next.ratios![0].values).toEqual([5, 0, 0])
  })

  it('turns a scaler back into the flat part when there is none', () => {
    const start = flatToStat(armorBuff(), 'armor', 3)
    const back = statToFlat(start, 1)
    expect(back.base).toEqual([20, 30, 40])
    expect(back.ratios).toHaveLength(1)
  })

  it('refuses to make a second flat part', () => {
    const start = armorBuff()
    expect(statToFlat(start, 0)).toBe(start)
  })

  it('removes only the flat part', () => {
    const next = removeFlatPart(armorBuff())
    expect(next.base).toBeUndefined()
    expect(next.ratios).toHaveLength(1)
  })
})
