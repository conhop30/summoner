import { describe, it, expect } from 'vitest'
import type { Ability, Champion, Effect } from '../champion/types'
import type { Item } from '../item/types'
import { combatantAt, REFERENCE_LEVEL } from './combatant'
import { emptyBonuses, goldValueOf, totalsForBuild, type ItemBonuses } from './gold'
import { evaluateKit, resistMultiplier, targetResist, TARGET_ARMOR, TARGET_MAGIC_RESIST } from './kit'

const STATS = {
  health: 590, health_growth: 104, resource: 418, resource_growth: 25, resource_regen: 8,
  attack_damage: 53, attack_damage_growth: 3, attack_speed: 0.668, attack_speed_growth: 2,
  armor: 21, armor_growth: 4.7, magic_resistance: 30, magic_resistance_growth: 1.3,
  movement_speed: 330, attack_range: [550],
}
const LETHALITY_13 = 0.6 + (0.4 * REFERENCE_LEVEL) / 18

const withBonuses = (over: Partial<ItemBonuses>) => combatantAt(STATS, REFERENCE_LEVEL, { ...emptyBonuses(), ...over })
const rank = (v: number) => [v, v, v, v, v]
const ability = (over: Partial<Ability> = {}): Ability => ({ max_rank: 5, ...over })

function kit(q: Ability): Champion {
  return {
    identity: { name: 'T', class: ['Fighter'] }, base_stats: STATS,
    abilities: { passive: ability(), q, w: ability(), e: ability(), r: ability({ max_rank: 3 }) },
    metadata: { id: 'x', created_at: '', updated_at: '', version: '1', is_favorite: false, tags: [] },
    builds: [], active_build_id: '',
  } as Champion
}

const hit = (type: 'Physical' | 'Magic', n: number, extra: Partial<Effect> = {}): Ability =>
  ability({ cooldown: rank(10), effects: [{ type: 'damage', damage_type: type, base: rank(n), ...extra }] })

function textItem(id: string, gold: number, stats: [string, string][]): Item {
  const lines = stats.map(([value, label]) => `<attention>${value}</attention> ${label}`).join('<br>')
  return { id, ddragon_version: '16.1.1', name: id, gold_total: gold, purchasable: true, tags: [], stats: {}, maps: {}, synced_at: '', description: `<mainText><stats>${lines}</stats></mainText>` } as Item
}

describe('reading penetration off items', () => {
  const dirk = textItem('dirk', 1000, [['20', 'Attack Damage'], ['10', 'Lethality']])
  const whisper = textItem('whisper', 1450, [['20', 'Attack Damage'], ['18%', 'Armor Penetration']])
  const shoes = textItem('shoes', 1100, [['12', 'Magic Penetration'], ['45', 'Move Speed']])
  const jewel = textItem('jewel', 1100, [['25', 'Ability Power'], ['13%', 'Magic Penetration']])
  const catalog = [dirk, whisper, shoes, jewel]

  it('finds lethality, armor penetration and both kinds of magic penetration', () => {
    const b = totalsForBuild([{ item_id: 'dirk', count: 2 }, { item_id: 'whisper', count: 1 }, { item_id: 'shoes', count: 1 }, { item_id: 'jewel', count: 1 }], catalog).bonuses
    expect(b.lethality).toBe(20)
    expect(b.armorPen).toBeCloseTo(0.18, 6)
    expect(b.magicPenFlat).toBe(12)
    expect(b.magicPen).toBeCloseTo(0.13, 6)
  })

  it('prices each source item at about its cost, so a penetration item is not treated as overpriced', () => {
    for (const item of catalog) {
      const { bonuses, goldSpent } = totalsForBuild([{ item_id: item.id, count: 1 }], catalog)
      expect(goldValueOf(bonuses) / goldSpent).toBeCloseTo(1, 1)
    }
  })

  it('carries onto the champion, with percentage penetration bounded', () => {
    const c = withBonuses({ lethality: 18, armorPen: 0.9, magicPenFlat: 10, magicPen: 0.2 })
    expect(c.lethality).toBe(18)
    expect(c.armorPen).toBe(0.6)
    expect(c.magicPenFlat).toBe(10)
    expect(c.magicPen).toBe(0.2)
  })
})

describe('what penetration does to damage', () => {
  const damageOf = (c: ReturnType<typeof withBonuses>, type: 'Physical' | 'Magic') =>
    evaluateKit(kit(hit(type, 300)), c).slots.find(s => s.slot === 'q')!.damagePerCast

  it('changes nothing without any', () => {
    expect(targetResist('armor', withBonuses({}))).toBe(TARGET_ARMOR)
    expect(damageOf(withBonuses({}), 'Physical')).toBeCloseTo(300 * 100 / (100 + TARGET_ARMOR), 6)
  })

  it('lethality lowers the armor the target is hit through, by a little less than its number at level 13', () => {
    const c = withBonuses({ lethality: 20 })
    expect(targetResist('armor', c)).toBeCloseTo(TARGET_ARMOR - 20 * LETHALITY_13, 6)
    expect(damageOf(c, 'Physical')).toBeGreaterThan(damageOf(withBonuses({}), 'Physical'))
  })

  it('percentage armor penetration takes a share of it', () => {
    expect(targetResist('armor', withBonuses({ armorPen: 0.4 }))).toBeCloseTo(TARGET_ARMOR * 0.6, 6)
  })

  it('magic penetration works on magic resist, flat or percent, and never on armor', () => {
    expect(targetResist('magic_resist', withBonuses({ magicPenFlat: 15 }))).toBe(TARGET_MAGIC_RESIST - 15)
    expect(targetResist('magic_resist', withBonuses({ magicPen: 0.3 }))).toBeCloseTo(TARGET_MAGIC_RESIST * 0.7, 6)
    expect(targetResist('armor', withBonuses({ magicPen: 0.3, magicPenFlat: 15 }))).toBe(TARGET_ARMOR)
  })

  it('does not go below no resistance, and does nothing to true damage', () => {
    expect(targetResist('armor', withBonuses({ lethality: 500 }))).toBe(0)
    const trueHit = evaluateKit(kit(hit('Physical', 300, { damage_type: 'True' })), withBonuses({ lethality: 40 })).slots.find(s => s.slot === 'q')!
    expect(trueHit.damagePerCast).toBe(300)
  })

  it('makes shred worth less against a target that penetration has already worn down', () => {
    const plain = resistMultiplier(80, 0.3, 0)
    const worn = resistMultiplier(80, 0.3, 0, { percent: 0.4, flat: 0 })
    expect(worn).toBeLessThan(plain)
    expect(worn).toBeGreaterThan(1)
  })

  it('is what an ability that scales with lethality reads', () => {
    const scaled = ability({ cooldown: rank(10), effects: [{ type: 'damage', damage_type: 'True', ratios: [{ stat: 'lethality', values: rank(2) }] }] })
    const q = evaluateKit(kit(scaled), withBonuses({ lethality: 25 })).slots.find(s => s.slot === 'q')!
    // 200% of 25 lethality
    expect(q.damagePerCast).toBeCloseTo(50, 6)
  })
})
