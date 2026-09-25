import { describe, it, expect } from 'vitest'
import type { Ability, Champion, Effect } from '../champion/types'
import type { ChampionCatalogEntry, ChampionCatalogStats } from '../championCatalog/types'
import type { Item } from '../item/types'
import { predictWinRate } from './predict'
import { buildBodyProfile, bodyZ, BUILTIN_BODY_PROFILE, rosterBodyIndex } from './roster'
import { totalsForBuild, goldValueOf } from './gold'
import { combatantAt, REFERENCE_LEVEL } from './combatant'
import { evaluateKit } from './kit'
import { emptyBonuses } from './gold'

// Ahri's real Data Dragon stats, as a mage that is fully filled in.
const MAGE_STATS = {
  health: 590, health_growth: 104, health_regen: 2.5, health_regen_growth: 0.6,
  resource: 418, resource_growth: 25, resource_regen: 8, resource_regen_growth: 0.8,
  attack_damage: 53, attack_damage_growth: 3, attack_speed: 0.668, attack_speed_growth: 2,
  armor: 21, armor_growth: 4.7, magic_resistance: 30, magic_resistance_growth: 1.3,
  movement_speed: 330, attack_range: [550], crit_damage_multiplier: 1.75,
}

function ability(over: Partial<Ability> = {}): Ability {
  return { max_rank: 5, ...over }
}

function damage(base: number[], ratio?: [string, number[]], type: 'Magic' | 'Physical' | 'True' = 'Magic'): Effect {
  return { type: 'damage', damage_type: type, base, ratios: ratio ? [{ stat: ratio[0], values: ratio[1] }] : undefined }
}

// A middling mage kit: three damaging basics, one hard control, an ultimate.
function mageKit(): Champion['abilities'] {
  return {
    passive: ability(),
    q: ability({ cooldown: [7, 7, 7, 7, 7], cost: [55, 60, 65, 70, 75], effects: [damage([40, 65, 90, 115, 140], ['AP', [0.45, 0.45, 0.45, 0.45, 0.45]])] }),
    w: ability({ cooldown: [9, 8, 7, 6, 5], cost: [30, 30, 30, 30, 30], effects: [damage([40, 65, 90, 115, 140], ['AP', [0.3, 0.3, 0.3, 0.3, 0.3]])] }),
    e: ability({ cooldown: [12, 12, 12, 12, 12], cost: [60, 60, 60, 60, 60], effects: [damage([60, 90, 120, 150, 180], ['AP', [0.5, 0.5, 0.5, 0.5, 0.5]]), { type: 'charm', base: [1.5, 1.6, 1.7, 1.8, 1.9] }] }),
    r: ability({ max_rank: 3, cooldown: [120, 100, 80], cost: [100, 100, 100], effects: [damage([200, 350, 500], ['AP', [0.8, 0.8, 0.8]])] }),
  }
}

function champion(over: Partial<Champion> = {}, abilities: Champion['abilities'] = mageKit()): Champion {
  return {
    identity: { name: 'Test', class: ['Mage'] },
    base_stats: { ...MAGE_STATS },
    abilities,
    metadata: { id: 'x', created_at: '', updated_at: '', version: '1', is_favorite: false, tags: [] },
    builds: [{ id: 'b1', name: 'Build 1', items: [] }],
    active_build_id: 'b1',
    ...over,
  }
}

function emptyKit(): Champion['abilities'] {
  return { passive: ability(), q: ability(), w: ability(), e: ability(), r: ability({ max_rank: 3 }) }
}

function item(id: string, gold: number, stats: Record<string, number>): Item {
  return { id, ddragon_version: '16.1.1', name: id, gold_total: gold, purchasable: true, tags: [], stats, maps: {}, synced_at: '' }
}

const APPLY = (i: Item, count = 1) => ({ item_id: i.id, count })
const NLR = item('nlr', 3000, { FlatMagicDamageMod: 120 })
const HP = item('hp', 3000, { FlatHPPoolMod: 800 })
const AD = item('ad', 3000, { FlatPhysicalDamageMod: 75 })
const CATALOG = [NLR, HP, AD]

function withBuild(c: Champion, entries: { item_id: string; count: number }[]): Champion {
  return { ...c, builds: [{ id: 'b1', name: 'Build 1', items: entries }] }
}

const NO_ROSTER: ChampionCatalogEntry[] = []

describe('predictWinRate: readiness', () => {
  it('asks for the stats before saying anything', () => {
    const p = predictWinRate({ champion: champion({ base_stats: { attack_range: [0] } }), items: [], roster: NO_ROSTER })
    expect(p.ready).toBe(false)
    expect(p.hints[0]).toContain('base stats')
    expect(p.hints[0]).toContain('health')
  })

  it('projects once the stats are in, even with no abilities', () => {
    const p = predictWinRate({ champion: champion({}, emptyKit()), items: [], roster: NO_ROSTER })
    expect(p.ready).toBe(true)
    expect(p.hints.join(' ')).toContain('Q, W, E, R')
  })
})

describe('predictWinRate: the number', () => {
  it('puts a middling kit near 50% and stays inside the clamp', () => {
    const p = predictWinRate({ champion: champion(), items: CATALOG, roster: NO_ROSTER })
    expect(p.winRate).toBeGreaterThan(47)
    expect(p.winRate).toBeLessThan(53)
    expect(p.winRate).toBeGreaterThanOrEqual(43)
    expect(p.winRate).toBeLessThanOrEqual(57)
  })

  it('does not punish a kit that is not filled in', () => {
    const blank = predictWinRate({ champion: champion({}, emptyKit()), items: [], roster: NO_ROSTER })
    expect(Math.abs(blank.winRate - 50)).toBeLessThan(3)
  })

  it('rewards stronger damage numbers', () => {
    const weak = mageKit()
    const strong = mageKit()
    strong.q = ability({ ...strong.q, effects: [damage([140, 165, 190, 215, 240], ['AP', [1, 1, 1, 1, 1]])] })
    const a = predictWinRate({ champion: champion({}, weak), items: [], roster: NO_ROSTER })
    const b = predictWinRate({ champion: champion({}, strong), items: [], roster: NO_ROSTER })
    expect(b.winRate).toBeGreaterThan(a.winRate)
  })

  it('values a shorter cooldown', () => {
    const slow = mageKit()
    const fast = mageKit()
    fast.q = ability({ ...fast.q, cooldown: [3, 3, 3, 3, 3] })
    const a = predictWinRate({ champion: champion({}, slow), items: [], roster: NO_ROSTER })
    const b = predictWinRate({ champion: champion({}, fast), items: [], roster: NO_ROSTER })
    expect(b.winRate).toBeGreaterThan(a.winRate)
  })

  it('counts true damage for more than physical, which a typical target resists', () => {
    const phys = mageKit()
    const truth = mageKit()
    phys.q = ability({ ...phys.q, effects: [damage([100, 100, 100, 100, 100], undefined, 'Physical')] })
    truth.q = ability({ ...truth.q, effects: [damage([100, 100, 100, 100, 100], undefined, 'True')] })
    const a = predictWinRate({ champion: champion({}, phys), items: [], roster: NO_ROSTER })
    const b = predictWinRate({ champion: champion({}, truth), items: [], roster: NO_ROSTER })
    expect(b.winRate).toBeGreaterThan(a.winRate)
  })

  it('reads a ratio typed as a percentage the same as a fraction', () => {
    const fraction = mageKit()
    const percent = mageKit()
    fraction.q = ability({ ...fraction.q, effects: [damage([50, 50, 50, 50, 50], ['AP', [0.6, 0.6, 0.6, 0.6, 0.6]])] })
    percent.q = ability({ ...percent.q, effects: [damage([50, 50, 50, 50, 50], ['AP', [60, 60, 60, 60, 60]])] })
    const a = predictWinRate({ champion: champion({}, fraction), items: [], roster: NO_ROSTER })
    const b = predictWinRate({ champion: champion({}, percent), items: [], roster: NO_ROSTER })
    expect(b.winRate).toBe(a.winRate)
  })

  it('clamps an absurd kit', () => {
    const kit = mageKit()
    kit.q = ability({ ...kit.q, effects: [damage([99999, 99999, 99999, 99999, 99999])] })
    kit.w = ability({ ...kit.w, effects: [damage([99999, 99999, 99999, 99999, 99999])] })
    const p = predictWinRate({ champion: champion({}, kit), items: [], roster: NO_ROSTER })
    expect(p.winRate).toBeLessThanOrEqual(57)
  })
})

describe('predictWinRate: builds', () => {
  it('prefers ability power for an ability-power kit', () => {
    const ap = predictWinRate({ champion: withBuild(champion(), [APPLY(NLR, 2), APPLY(HP)]), items: CATALOG, roster: NO_ROSTER })
    const ad = predictWinRate({ champion: withBuild(champion(), [APPLY(AD, 2), APPLY(HP)]), items: CATALOG, roster: NO_ROSTER })
    expect(ap.winRate).toBeGreaterThan(ad.winRate)
  })

  it('compares builds at the same spend, so a bigger build is not rewarded for costing more', () => {
    const two = predictWinRate({ champion: withBuild(champion(), [APPLY(NLR, 2)]), items: CATALOG, roster: NO_ROSTER })
    const six = predictWinRate({ champion: withBuild(champion(), [APPLY(NLR, 6)]), items: CATALOG, roster: NO_ROSTER })
    expect(six.winRate).toBe(two.winRate)
  })

  it('says when it is assuming items', () => {
    const none = predictWinRate({ champion: champion(), items: CATALOG, roster: NO_ROSTER })
    expect(none.assumedBuild).toBe(true)
    expect(none.hints.join(' ')).toContain('typical items')
    const some = predictWinRate({ champion: withBuild(champion(), [APPLY(NLR)]), items: CATALOG, roster: NO_ROSTER })
    expect(some.assumedBuild).toBe(false)
  })

  it('asks for an item sync when the build names items the catalog lacks', () => {
    const p = predictWinRate({ champion: withBuild(champion(), [APPLY(NLR)]), items: [], roster: NO_ROSTER })
    expect(p.assumedBuild).toBe(true)
    expect(p.hints.join(' ')).toContain('Sync items')
  })
})

describe('predictWinRate: confidence', () => {
  it('narrows the band as things are filled in', () => {
    const rough = predictWinRate({ champion: champion({}, emptyKit()), items: [], roster: NO_ROSTER })
    const full = predictWinRate({ champion: withBuild(champion(), [APPLY(NLR, 2)]), items: CATALOG, roster: NO_ROSTER })
    expect(full.band).toBeLessThan(rough.band)
    expect(full.confidence === 'good' || full.confidence === 'fair').toBe(true)
    expect(rough.confidence).not.toBe('good')
  })

  it('contributions add up to the distance from 50%', () => {
    const p = predictWinRate({ champion: withBuild(champion(), [APPLY(NLR, 2)]), items: CATALOG, roster: NO_ROSTER })
    const sum = p.contributions.reduce((s, c) => s + c.points, 0)
    expect(Math.abs(50 + sum - p.winRate)).toBeLessThan(0.3)
  })
})

describe('kit evaluation', () => {
  const c = combatantAt(MAGE_STATS, REFERENCE_LEVEL, { ...emptyBonuses(), abilityPower: 200 })

  it('reads the rank a champion has at the reference level', () => {
    const report = evaluateKit(champion(), c)
    const q = report.slots.find(s => s.slot === 'q')!
    // rank 4: 115 + 0.45 * 200 = 205, against 60 magic resist
    expect(q.damagePerCast).toBeCloseTo(205 * (100 / 160), 0)
    expect(q.cooldown).toBeCloseTo(7, 5)
  })

  it('shortens cooldowns with ability haste', () => {
    const haste = combatantAt(MAGE_STATS, REFERENCE_LEVEL, { ...emptyBonuses(), abilityHaste: 100 })
    const q = evaluateKit(champion(), haste).slots.find(s => s.slot === 'q')!
    expect(q.cooldown).toBeCloseTo(3.5, 5)
  })

  it('counts recasts and alternate forms for less than a key of their own', () => {
    const plain = champion()
    const withBlock = champion()
    withBlock.abilities.q = ability({
      ...withBlock.abilities.q,
      blocks: [{ kind: 'alternate_form', effects: [damage([100, 100, 100, 100, 100])] }],
    })
    const a = evaluateKit(plain, c).slots.find(s => s.slot === 'q')!
    const b = evaluateKit(withBlock, c).slots.find(s => s.slot === 'q')!
    expect(b.damage).toBeGreaterThan(a.damage)
    // half of what a full cast of that damage would add
    expect(b.damage - a.damage).toBeCloseTo((100 * (100 / 160) * 0.5) / 7, 3)
  })

  it('reports how many rotations the resource pool pays for', () => {
    const report = evaluateKit(champion(), c)
    expect(report.rotations).not.toBeNull()
    expect(report.rotations!).toBeGreaterThan(1)
  })
})

describe('custom effects', () => {
  const c = combatantAt(MAGE_STATS, REFERENCE_LEVEL, emptyBonuses())
  function qWith(effects: Effect[]): Champion {
    const k = mageKit()
    k.q = ability({ cooldown: [8, 8, 8, 8, 8], effects })
    return champion({}, k)
  }
  const utilityOfQ = (effects: Effect[]) => evaluateKit(qWith(effects), c).slots.find(s => s.slot === 'q')!.utility

  it('prices a taunt like a stun once it is known to be hard control', () => {
    const taunt = utilityOfQ([{ type: 'taunt', base: [1.5, 1.5, 1.5, 1.5, 1.5] }])
    const stun = utilityOfQ([{ type: 'stun', base: [1.5, 1.5, 1.5, 1.5, 1.5] }])
    expect(taunt).toBeGreaterThan(0)
    expect(taunt).toBeCloseTo(stun, 10)
  })

  it('reads a custom control number as seconds only when its unit says so', () => {
    const seconds = utilityOfQ([{ type: 'taunt', base: [3, 3, 3, 3, 3] }])
    const percent = utilityOfQ([{ type: 'taunt', unit: 'percent', base: [3, 3, 3, 3, 3] }])
    expect(seconds).toBeGreaterThan(percent)
  })

  it('follows the family picked, not the label', () => {
    const asUtility = utilityOfQ([{ type: 'taunt', family: 'utility', base: [3, 3, 3, 3, 3] }])
    const asHard = utilityOfQ([{ type: 'taunt', base: [3, 3, 3, 3, 3] }])
    expect(asHard).toBeGreaterThan(asUtility)
  })

  it('counts a custom damage effect as damage, and a custom heal as sustain', () => {
    const dmgKit = evaluateKit(qWith([{ type: 'scorch', family: 'damage', damage_type: 'Magic', base: [100, 100, 100, 100, 100] }]), c).slots.find(s => s.slot === 'q')!
    expect(dmgKit.damage).toBeGreaterThan(0)
    const healKit = evaluateKit(qWith([{ type: 'mend', base: [100, 100, 100, 100, 100] }]), c).slots.find(s => s.slot === 'q')!
    expect(healKit.damage).toBe(0)
    expect(healKit.sustain).toBe(0)
    expect(evaluateKit(qWith([{ type: 'mend', family: 'sustain', base: [100, 100, 100, 100, 100] }]), c).slots.find(s => s.slot === 'q')!.sustain).toBeGreaterThan(0)
  })
})

describe('build totals', () => {
  it('sums what the items grant and what they cost', () => {
    const t = totalsForBuild([APPLY(NLR), APPLY(HP, 2)], CATALOG)
    expect(t.bonuses.abilityPower).toBe(120)
    expect(t.bonuses.health).toBe(1600)
    expect(t.goldSpent).toBe(9000)
    expect(t.itemCount).toBe(3)
  })

  it('keeps flat and percent move speed apart', () => {
    const boots = item('boots', 1000, { FlatMovementSpeedMod: 45, PercentMovementSpeedMod: 0.08 })
    const t = totalsForBuild([APPLY(boots)], [boots])
    expect(t.bonuses.moveSpeedFlat).toBe(45)
    expect(t.bonuses.moveSpeedPercent).toBeCloseTo(0.08)
  })

  it('prices stats the way the wiki does', () => {
    const t = totalsForBuild([APPLY(item('sword', 350, { FlatPhysicalDamageMod: 10 }))], [item('sword', 350, { FlatPhysicalDamageMod: 10 })])
    expect(goldValueOf(t.bonuses)).toBeCloseTo(350)
  })
})

describe('roster calibration', () => {
  function entry(name: string, tags: string[], stats: ChampionCatalogStats): ChampionCatalogEntry {
    return { id: name, ddragon_version: '16.1.1', key: '1', name, tags, stats, synced_at: '' }
  }
  const mage: ChampionCatalogStats = {
    hp: 590, hpperlevel: 104, mp: 418, mpperlevel: 25, movespeed: 330, armor: 21, armorperlevel: 4.7,
    spellblock: 30, spellblockperlevel: 1.3, attackrange: 550, attackdamage: 53, attackdamageperlevel: 3,
    attackspeed: 0.668, attackspeedperlevel: 2, hpregen: 2.5, mpregen: 8,
  }

  it('falls back to the built-in profile when the roster is not synced', () => {
    expect(buildBodyProfile([]).source).toBe('builtin')
    expect(buildBodyProfile([entry('A', ['Mage'], mage)]).source).toBe('builtin')
  })

  it('uses a synced roster of a sensible size', () => {
    const roster = Array.from({ length: 60 }, (_, i) => entry(`M${i}`, ['Mage'], { ...mage, hp: 500 + i * 4 }))
    const profile = buildBodyProfile(roster)
    expect(profile.source).toBe('synced')
    expect(profile.byClass.Mage.n).toBe(60)
  })

  it('scores a stronger body higher within its class', () => {
    const tougher = { ...mage, hp: 800, armor: 40, spellblock: 45 }
    const a = rosterBodyIndex(entry('a', ['Mage'], mage))!
    const b = rosterBodyIndex(entry('b', ['Mage'], tougher))!
    expect(bodyZ(b, ['Mage'], BUILTIN_BODY_PROFILE)).toBeGreaterThan(bodyZ(a, ['Mage'], BUILTIN_BODY_PROFILE))
  })

  it('judges a champion against its own class, not everyone', () => {
    // A body exactly as good as the average Tank is average among Tanks, and nothing like average among Mages.
    const tankAverage = BUILTIN_BODY_PROFILE.byClass.Tank.mean
    expect(bodyZ(tankAverage, ['Tank'], BUILTIN_BODY_PROFILE)).toBeCloseTo(0, 5)
    expect(Math.abs(bodyZ(tankAverage, ['Mage'], BUILTIN_BODY_PROFILE))).toBeGreaterThan(1)
  })

  it('a roster champion of average stats lands near the middle of its own class', () => {
    const roster = Array.from({ length: 60 }, (_, i) => entry(`M${i}`, ['Mage'], { ...mage, hp: 500 + i * 4 }))
    const profile = buildBodyProfile(roster)
    const middle = rosterBodyIndex(entry('mid', ['Mage'], { ...mage, hp: 500 + 30 * 4 }))!
    expect(Math.abs(bodyZ(middle, ['Mage'], profile))).toBeLessThan(0.6)
  })
})
