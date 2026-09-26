import { describe, it, expect } from 'vitest'
import { classIconUrl, laneIconUrl } from './leagueAssets'

describe('lane icons', () => {
  it('know the lane by whatever the role is called', () => {
    expect(laneIconUrl('Top')).toMatch(/position-top\.svg$/)
    expect(laneIconUrl('Mid')).toMatch(/position-middle\.svg$/)
    expect(laneIconUrl('bot')).toMatch(/position-bottom\.svg$/)
    expect(laneIconUrl('ADC')).toMatch(/position-bottom\.svg$/)
    expect(laneIconUrl(' Support ')).toMatch(/position-utility\.svg$/)
    expect(laneIconUrl('Jungle')).toMatch(/position-jungle\.svg$/)
  })

  it('give nothing for a role they do not know', () => {
    expect(laneIconUrl('Flex')).toBeNull()
    expect(laneIconUrl('')).toBeNull()
  })
})

describe('class icons', () => {
  it('cover the six classes, whatever the case', () => {
    for (const name of ['Assassin', 'FIGHTER', 'mage', 'Marksman', 'Support', 'Tank']) expect(classIconUrl(name)).toMatch(new RegExp(`role-icon-${name.toLowerCase()}\.png$`))
  })

  it('give nothing for a class they do not know', () => {
    expect(classIconUrl('Enchanter')).toBeNull()
  })
})
