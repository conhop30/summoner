import { describe, it, expect } from 'vitest'
import type { Ability, Champion, Effect } from '../champion/types'
import { combatantAt, REFERENCE_LEVEL } from './combatant'
import { emptyBonuses } from './gold'
import { evaluateKit, resistMultiplier, TARGET_ARMOR, TARGET_MAGIC_RESIST, type SlotReport } from './kit'

const STATS = {
  health: 590, health_growth: 104, resource: 418, resource_growth: 25, resource_regen: 8,
  attack_damage: 53, attack_damage_growth: 3, attack_speed: 0.668, attack_speed_growth: 2,
  armor: 21, armor_growth: 4.7, magic_resistance: 30, magic_resistance_growth: 1.3,
  movement_speed: 330, attack_range: [550],
}
const c = combatantAt(STATS, REFERENCE_LEVEL, emptyBonuses())

const rank = (v: number) => [v, v, v, v, v]
const ability = (over: Partial<Ability> = {}): Ability => ({ max_rank: 5, ...over })

function kit(abilities: Partial<Record<'passive' | 'q' | 'w' | 'e' | 'r', Ability>>): Champion {
  return {
    identity: { name: 'T', class: ['Mage'] },
    base_stats: STATS,
    abilities: { passive: ability(), q: ability(), w: ability(), e: ability(), r: ability({ max_rank: 3 }), ...abilities },
    metadata: { id: 'x', created_at: '', updated_at: '', version: '1', is_favorite: false, tags: [] },
    builds: [], active_build_id: '',
  } as Champion
}

const physical = (n: number): Effect => ({ type: 'damage', damage_type: 'Physical', base: rank(n) })
const magic = (n: number): Effect => ({ type: 'damage', damage_type: 'Magic', base: rank(n) })
const change = (over: Partial<Effect>): Effect => ({ type: 'stat_change', stat: 'armor', direction: 'lower', target: 'enemy', unit: 'percent', base: rank(30), duration: rank(4), ...over })

const slot = (report: { slots: SlotReport[] }, key: SlotReport['slot']) => report.slots.find(s => s.slot === key)!

describe('what a resist change does to damage', () => {
  it('is the change in damage taken: 30% off 80 armor is about 15% more', () => {
    expect(resistMultiplier(80, 0.3, 0)).toBeCloseTo(180 / 156, 6)
    expect(resistMultiplier(80, 0, 20)).toBeCloseTo(180 / 160, 6)
    expect(resistMultiplier(80, 0, 0)).toBe(1)
  })

  it('cannot go below no resistance, or past taking it all', () => {
    expect(resistMultiplier(80, 1, 0)).toBeCloseTo(1.8, 6)
    expect(resistMultiplier(80, 5, 0)).toBeCloseTo(1.8, 6)
    expect(resistMultiplier(80, 0, 500)).toBeCloseTo(1.8, 6)
    expect(resistMultiplier(80, -1, -10)).toBe(1)
  })
})

describe('shred', () => {
  const q = ability({ cooldown: rank(10), effects: [physical(200)] })
  const shredW = (over: Partial<Effect> = {}) => ability({ cooldown: rank(10), effects: [change(over)] })

  it('makes the kit\'s damage of that type larger, credited to the key that shreds', () => {
    const plain = evaluateKit(kit({ q }), c)
    const shred = evaluateKit(kit({ q, w: shredW() }), c)
    // 30% of 80 armor is 4 s out of every 10: a 15.4% gain while it is up
    const gain = (180 / 156 - 1) * 0.4
    expect(slot(shred, 'q').damage).toBeCloseTo(slot(plain, 'q').damage, 6)
    expect(slot(shred, 'w').shredDamage).toBeCloseTo(slot(plain, 'q').damage * gain, 6)
    expect(slot(shred, 'w').damage).toBe(slot(shred, 'w').shredDamage)
  })

  it('counts the key as priced even though it deals no damage of its own', () => {
    expect(slot(evaluateKit(kit({ w: shredW() }), c), 'w').scored).toBe(true)
  })

  it('lasts as long as it is told to, up to always', () => {
    const at = (seconds: number) => slot(evaluateKit(kit({ q, w: shredW({ duration: rank(seconds) }) }), c), 'w').shredDamage
    expect(at(8)).toBeCloseTo(at(4) * 2, 6)
    expect(at(30)).toBeCloseTo(at(10), 6)
  })

  it('does nothing for the other kind of damage, apart from the small team share', () => {
    const mageQ = ability({ cooldown: rank(10), effects: [magic(200)] })
    const w = slot(evaluateKit(kit({ q: mageQ, w: shredW() }), c), 'w')
    expect(w.shredDamage).toBe(0)
    expect(w.teamShare).toBeGreaterThan(0)
  })

  it('reads magic resist against magic damage', () => {
    const mageQ = ability({ cooldown: rank(10), effects: [magic(200)] })
    const w = slot(evaluateKit(kit({ q: mageQ, w: shredW({ stat: 'magic_resist' }) }), c), 'w')
    expect(w.shredDamage).toBeGreaterThan(0)
    expect(TARGET_MAGIC_RESIST).toBeLessThan(TARGET_ARMOR)
  })

  it('keeps the team share small next to the champion\'s own gain, for a kit that deals typical damage', () => {
    const bigQ = ability({ cooldown: rank(10), effects: [physical(600)] })
    const w = slot(evaluateKit(kit({ q: bigQ, w: shredW() }), c), 'w')
    expect(w.teamShare).toBeGreaterThan(0)
    expect(w.teamShare).toBeLessThan(w.shredDamage)
  })

  it('stacks from several sources, but not without limit', () => {
    const one = slot(evaluateKit(kit({ q, w: shredW({ base: rank(30), duration: rank(30) }) }), c), 'w').shredDamage
    const many = evaluateKit(kit({ q, w: shredW({ base: rank(30), duration: rank(30) }), e: shredW({ base: rank(30), duration: rank(30) }), r: ability({ max_rank: 3, cooldown: [10, 10, 10], effects: [change({ base: rank(30), duration: rank(30) })] }) }), c)
    const total = slot(many, 'w').shredDamage + slot(many, 'e').shredDamage + slot(many, 'r').shredDamage
    expect(total).toBeGreaterThan(one)
    expect(total).toBeLessThanOrEqual(slot(many, 'q').damage * 0.6 + 1e-9)
  })

  it('reads a flat amount as points off the resistance', () => {
    const w = slot(evaluateKit(kit({ q, w: shredW({ unit: 'flat', base: rank(20) }) }), c), 'w')
    const gain = (180 / 160 - 1) * 0.4
    expect(w.shredDamage).toBeCloseTo(slot(evaluateKit(kit({ q }), c), 'q').damage * gain, 6)
  })

  it('is always on for a passive with no cooldown and no duration', () => {
    const passive = ability({ effects: [change({ duration: undefined })] })
    const w = slot(evaluateKit(kit({ q, passive }), c), 'passive')
    expect(w.shredDamage).toBeCloseTo(slot(evaluateKit(kit({ q }), c), 'q').damage * (180 / 156 - 1), 6)
  })
})

describe('penetration', () => {
  const q = ability({ cooldown: rank(10), effects: [physical(200)] })
  const pen = (over: Partial<Effect>) => ability({ cooldown: rank(10), effects: [change({ direction: 'raise', target: 'self', stat: 'armor_pen', ...over })] })

  it('on yourself helps your own damage and no one else\'s', () => {
    const w = slot(evaluateKit(kit({ q, w: pen({}) }), c), 'w')
    expect(w.shredDamage).toBeGreaterThan(0)
    expect(w.teamShare).toBe(0)
  })

  it('on an ally helps only the team', () => {
    const w = slot(evaluateKit(kit({ q, w: pen({ target: 'ally' }) }), c), 'w')
    expect(w.shredDamage).toBe(0)
    expect(w.teamShare).toBeGreaterThan(0)
  })

  it('counts lethality as flat penetration, worth a little less than its number before level 18', () => {
    const lethality = slot(evaluateKit(kit({ q, w: pen({ stat: 'lethality', unit: 'flat', base: rank(20) }) }), c), 'w').shredDamage
    const flat = slot(evaluateKit(kit({ q, w: change({ unit: 'flat', base: rank(20) }) && ability({ cooldown: rank(10), effects: [change({ unit: 'flat', base: rank(20) })] }) }), c), 'w').shredDamage
    expect(lethality).toBeGreaterThan(0)
    expect(lethality).toBeLessThan(flat)
  })
})

describe('buffs and slows written as a stat change', () => {
  const only = (effect: Effect) => slot(evaluateKit(kit({ w: ability({ cooldown: rank(10), effects: [effect] }) }), c), 'w')

  it('prices extra armor, magic resist and health as durability', () => {
    for (const stat of ['armor', 'magic_resist', 'health']) {
      const w = only(change({ stat, direction: 'raise', target: 'self', unit: 'flat', base: rank(40) }))
      expect(w.sustain).toBeGreaterThan(0)
      expect(w.damage).toBe(0)
    }
  })

  it('values a buff on an ally at a share of the same buff on yourself', () => {
    const self = only(change({ stat: 'armor', direction: 'raise', target: 'self', unit: 'flat', base: rank(40) })).sustain
    const ally = only(change({ stat: 'armor', direction: 'raise', target: 'ally', unit: 'flat', base: rank(40) })).sustain
    expect(ally).toBeCloseTo(self * 0.6, 6)
  })

  it('values a bigger or longer buff more, up to a whole fight', () => {
    const buff = (base: number, seconds: number) => only(change({ stat: 'armor', direction: 'raise', target: 'self', unit: 'flat', base: rank(base), duration: rank(seconds) })).sustain
    expect(buff(80, 4)).toBeCloseTo(buff(40, 4) * 2, 6)
    expect(buff(40, 2)).toBeCloseTo(buff(40, 4) / 2, 6)
    expect(buff(40, 12)).toBeCloseTo(buff(40, 4), 6)
  })

  it('prices lowering an enemy\'s move speed like a slow', () => {
    const asChange = only(change({ stat: 'move_speed', direction: 'lower', target: 'enemy', unit: 'percent', base: rank(30), duration: undefined })).utility
    const asSlow = only({ type: 'slow', base: rank(30) }).utility
    expect(asChange).toBeCloseTo(asSlow, 6)
  })

  it('prices an unfinished one as a small flat value, so a half-made kit isn\'t punished', () => {
    const w = only({ type: 'stat_change' })
    expect(w.scored).toBe(true)
    expect(w.utility).toBeGreaterThan(0)
  })
})

describe('states and the newer controls', () => {
  const only = (effect: Effect) => slot(evaluateKit(kit({ w: ability({ cooldown: rank(10), effects: [effect] }) }), c), 'w')

  it('prices not being hurt as durability, growing with its length up to a fight', () => {
    for (const type of ['untargetable', 'invulnerable']) {
      const short = only({ type, base: rank(1) }).sustain
      expect(short).toBeGreaterThan(0)
      expect(only({ type, base: rank(2) }).sustain).toBeCloseTo(short * 2, 6)
      expect(only({ type, base: rank(60) }).sustain).toBeCloseTo(only({ type, base: rank(5) }).sustain, 6)
    }
  })

  it('prices not being stopped as utility, and a default length while it is blank', () => {
    for (const type of ['unstoppable', 'cc_immune']) {
      expect(only({ type, base: rank(2) }).utility).toBeCloseTo(only({ type, base: rank(1) }).utility * 2, 6)
      expect(only({ type }).utility).toBeCloseTo(only({ type, base: rank(1.5) }).utility, 6)
    }
  })

  it('prices a taunt and a root a little under a stun of the same length', () => {
    const stun = only({ type: 'stun', base: rank(1.5) }).utility
    expect(only({ type: 'taunt', base: rank(1.5) }).utility).toBeCloseTo(stun * 0.9, 6)
    expect(only({ type: 'root', base: rank(1.5) }).utility).toBeCloseTo(stun * 0.7, 6)
  })
})
