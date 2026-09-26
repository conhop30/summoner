import type { AbilityBody, AbilitySlot, Champion, Effect, RatioEntry, RatioPart } from '../champion/types'
import { STAT_CHANGE, effectKind, statChangeOf } from '../champion/effects'
import { assumedUnits, ratioFraction, resolveRatio, type RatioStatId } from '../champion/ratios'
import { REFERENCE_LEVEL, type Combatant } from './combatant'

// Turns a champion's five abilities into rates of "damage-equivalent" value per second at the
// reference moment. Everything an ability does is priced in the same unit: damage dealt to a
// typical target, crowd control at so much per second, shields and heals at a discount.
// The prices below are hand-tuned assumptions. Data Dragon publishes no ability numbers to fit them to.

/** The enemy the damage is dealt to: a typical mid-game champion. */
export const TARGET_ARMOR = 80
export const TARGET_MAGIC_RESIST = 60
/** The same enemy's health, for abilities that take a share of it. Damage aimed at a target is used when it is somewhat hurt. */
export const TARGET_MAX_HEALTH = 2600
const TARGET_CURRENT_SHARE = 0.6
const TARGET_MISSING_SHARE = 0.4

/** Ranks the abilities are read at: at level 13 the basics are about rank 4 and the ultimate rank 2. */
const BASIC_RANK = 4
const ULT_RANK = 2

/** A full second of hard crowd control, in damage-equivalent. */
const CC_VALUE_PER_SECOND = 100
/** How much of a full second each kind of control is worth. */
const CC_WEIGHT: Record<string, number> = {
  stun: 1, knock_up: 1, charm: 1, fear: 1, silence: 0.6, knock_back: 0.4, slow: 0.5, taunt: 0.9, root: 0.7,
}
const DEFAULT_CC_SECONDS: Record<string, number> = { knock_back: 0.6, slow: 1.5 }
/** A slow of this strength is what the slow price is quoted for; stronger or weaker scales from it. */
const SLOW_REFERENCE_STRENGTH = 0.3
const DEFAULT_SOFT_SECONDS = 1.5
/** Flat per-cast values for effects that have no number worth reading. */
const FLAT_UTILITY_VALUE: Record<string, number> = {
  dash: 40, speed_boost: 30, armor_modifier: 30, magic_resistance_modifier: 30,
}
const OTHER_UTILITY_VALUE = 20
/** States: a second of not being hurt is worth this share of the champion's health (before the shield discount); a second of not being stopped, this much. */
const UNHURT_HEALTH_PER_SECOND = 0.1
const UNSTOPPABLE_PER_SECOND = 40
const DEFAULT_STATE_SECONDS = 1.5
const MAX_STATE_SECONDS = 5

// Raising or lowering a stat. How long one lasts when no duration is filled in, and how much of a
// fight a buff has to last to be worth its whole size (a fight's damage arrives over about this long).
const DEFAULT_STAT_SECONDS = 4
const FIGHT_SECONDS = 4
/** A buff on an ally is worth this much of the same buff on yourself. */
const ALLY_BUFF_WEIGHT = 0.6
/** Shred and penetration make every source of damage on the target hit harder; the champion's own damage is credited in full, up to this much extra. */
const MAX_SHRED_GAIN = 0.6
/** ...plus a small share for the teammates it helps: what the rest of the team deals to that target per second (in the same units), and how much of it the champion is credited with. */
const ALLY_DAMAGE = 100
const TEAM_CREDIT = 0.25
/** Lethality is flat armor penetration that grows with level, reaching its full value at 18. */
const LETHALITY_AT_REFERENCE = 0.6 + (0.4 * REFERENCE_LEVEL) / 18

type Resist = 'armor' | 'magic_resist'

/** What is ignored of a resistance: a share of it, then a flat amount. */
interface Penetration {
  percent: number
  flat: number
}

const NO_PENETRATION: Penetration = { percent: 0, flat: 0 }

function afterPenetration(resist: number, pen: Penetration): number {
  return Math.max(0, resist * (1 - Math.min(1, Math.max(0, pen.percent))) - Math.max(0, pen.flat))
}

/** What the champion's items ignore of the target's armor or magic resist. */
function itemPenetration(resist: Resist, c: Combatant): Penetration {
  return resist === 'armor'
    ? { percent: c.armorPen, flat: c.lethality * LETHALITY_AT_REFERENCE }
    : { percent: c.magicPen, flat: c.magicPenFlat }
}

/** The target's armor or magic resist as this champion's damage meets it, after its items' penetration. */
export function targetResist(resist: Resist, c: Combatant): number {
  return afterPenetration(resist === 'armor' ? TARGET_ARMOR : TARGET_MAGIC_RESIST, itemPenetration(resist, c))
}

/**
 * What a resist change does to damage: the target loses this much of it (by percent, then flat), and
 * takes (100 + R) / (100 + R') times as much. Penetration, when there is some, is applied after the
 * change and is already in both R and R', so the gain from shred is smaller against a target that
 * penetration has already worn down.
 */
export function resistMultiplier(resist: number, percent: number, flat: number, pen: Penetration = NO_PENETRATION): number {
  const shredded = Math.max(0, resist * (1 - Math.min(1, Math.max(0, percent))) - Math.max(0, flat))
  return (100 + afterPenetration(resist, pen)) / (100 + afterPenetration(shredded, pen))
}
const HEAL_WEIGHT = 0.8
const SHIELD_WEIGHT = 0.7

/** How long to assume between uses when an ability has no cooldown filled in. */
const ASSUMED_COOLDOWN = 8
const ASSUMED_PASSIVE_PERIOD = 12
/** Blocks under a key are worth less than a key of their own: a recast is part of the same cast, and only one form is out at a time. */
const BLOCK_WEIGHT = { passive: 1, recast: 0.6, alternate_form: 0.5 } as const

export const KIT_SLOTS: AbilitySlot[] = ['passive', 'q', 'w', 'e', 'r']

export interface SlotReport {
  slot: AbilitySlot
  name: string
  /** Has at least one effect with a number the model can price. */
  scored: boolean
  /** Damage-equivalent per second, split by what it is. */
  damage: number
  utility: number
  sustain: number
  /** Damage dealt by one cast of the main ability, after the target's resistances. */
  damagePerCast: number
  /** Seconds between casts, after ability haste. */
  cooldown: number
  /** Part of `damage` that is this key's shred or penetration making the rest of the kit hit harder. */
  shredDamage: number
  /** Part of `utility` that is the same thing done for teammates. Kept small on purpose. */
  teamShare: number
}

export interface KitReport {
  slots: SlotReport[]
  /** Casting the whole Q-W-E-R rotation once, against the resource pool: how many times over. */
  rotations: number | null
}

/** Armor or magic resist taken off the target (shred), or ignored (penetration). */
interface Shred {
  resist: Resist
  percent: number
  flat: number
  /** Helps the champion's own damage, and/or teammates'. */
  own: boolean
  team: boolean
  /** How long it lasts; Infinity when it is always on. */
  seconds: number
}

interface Parts {
  damage: number
  utility: number
  sustain: number
  /** The damage above by type, after resistances, so shred knows what it is multiplying. */
  physical: number
  magic: number
  shreds: Shred[]
}

function noParts(): Parts {
  return { damage: 0, utility: 0, sustain: 0, physical: 0, magic: 0, shreds: [] }
}

function valueAt(values: number[] | undefined, rankIndex: number): number {
  if (!values || values.length === 0) return 0
  const v = values[Math.min(rankIndex, values.length - 1)]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** What one part of a stat comes to, in the units a ratio is quoted in (percentage points for the percentage stats). */
function statValue(stat: RatioStatId, part: RatioPart, c: Combatant): number {
  const pick = (base: number, total: number) => (part === 'base' ? base : part === 'bonus' ? Math.max(0, total - base) : total)
  switch (stat) {
    case 'ad': return pick(c.baseAttackDamage, c.attackDamage)
    case 'ap': return c.abilityPower
    case 'armor': return pick(c.baseArmor, c.armor)
    case 'magic_resist': return pick(c.baseMagicResist, c.magicResist)
    case 'health': return pick(c.baseHealth, c.health)
    // An ability that scales with missing health is used when the target is hurt: call it 40%.
    case 'missing_health': return c.health * 0.4
    case 'resource': return pick(c.baseResource, c.resource)
    case 'health_regen': return pick(c.healthRegen, c.healthRegen)
    case 'resource_regen': return pick(c.resourceRegen, c.resourceRegen)
    case 'attack_speed': return pick(c.baseAttackSpeed * 100, c.attackSpeed * 100)
    case 'move_speed': return pick(c.baseMoveSpeed, c.moveSpeed)
    case 'crit_chance': return c.critChance * 100
    case 'ability_haste': return c.abilityHaste
    case 'lethality': return c.lethality
    case 'armor_pen': return c.armorPen * 100
    // Flat magic penetration: what an ability that scales with "magic pen" means.
    case 'magic_pen': return c.magicPenFlat
    case 'target_max_health': return TARGET_MAX_HEALTH
    case 'target_current_health': return TARGET_MAX_HEALTH * TARGET_CURRENT_SHARE
    case 'target_missing_health': return TARGET_MAX_HEALTH * TARGET_MISSING_SHARE
  }
}

/**
 * What one scaler adds at a rank. A plain ratio is a fraction of its stat. A per-N one adds its
 * value for every N of the stat, continuously (1 per 80 armor is 1.5 at 120 armor). A value the
 * user named themselves (stacks) has no stat to read, so it uses the number they said to assume,
 * one unit by default. The value of a per-N or custom scaler is in the effect's own unit.
 */
function ratioAmount(ratio: RatioEntry, rankIndex: number, c: Combatant): number {
  const value = valueAt(ratio.values, rankIndex)
  const per = typeof ratio.per === 'number' && ratio.per > 0 ? ratio.per : 0
  const resolved = resolveRatio(ratio)
  if (!resolved) return (value * assumedUnits(ratio)) / (per || 1)
  const stat = statValue(resolved.stat, resolved.part, c)
  return per ? (value * stat) / per : ratioFraction(value) * stat
}

/** How long a state lasts: the amount, in seconds, or a default while it is blank, and never more than a fight. */
function stateSeconds(amount: number): number {
  return amount > 0 ? Math.min(amount, MAX_STATE_SECONDS) : DEFAULT_STATE_SECONDS
}

/** A percentage typed either way: 30 and 0.3 both mean 30%. */
function percentOf(amount: number): number {
  return amount > 1 ? Math.min(amount, 100) / 100 : Math.max(0, amount)
}

/**
 * A stat change is priced by what it does. Shrinking the target's armor or magic resist, or
 * penetrating it, is a multiplier on damage and is settled once the whole kit is known. Extra
 * armor, magic resist or health is durability, priced like a shield of the effective health it adds.
 * Slowing an enemy is a slow; speeding someone up is a speed boost. Anything else is a small flat value.
 */
function evaluateStatChange(effect: Effect, amount: number, rankIndex: number, c: Combatant, alwaysOn: boolean): Parts {
  const parts = noParts()
  const { stat, direction, target } = statChangeOf(effect)
  const { unit } = effectKind(effect)
  const explicit = valueAt(effect.duration, rankIndex)
  const seconds = alwaysOn && !explicit ? Infinity : explicit || DEFAULT_STAT_SECONDS
  const size = Math.max(0, amount)
  if (size === 0) { parts.utility = OTHER_UTILITY_VALUE; return parts }

  const resistOf: Partial<Record<string, Resist>> = { armor: 'armor', magic_resist: 'magic_resist', armor_pen: 'armor', lethality: 'armor', magic_pen: 'magic_resist' }
  const resist = resistOf[stat]

  if ((stat === 'armor' || stat === 'magic_resist') && direction === 'lower' && target === 'enemy') {
    parts.shreds.push({ resist: resist!, percent: unit === 'percent' ? percentOf(size) : 0, flat: unit === 'percent' ? 0 : size, own: true, team: true, seconds })
  } else if ((stat === 'armor_pen' || stat === 'magic_pen' || stat === 'lethality') && direction === 'raise' && target !== 'enemy') {
    const isFlat = stat === 'lethality'
    parts.shreds.push({ resist: resist!, percent: isFlat ? 0 : percentOf(size), flat: isFlat ? size * LETHALITY_AT_REFERENCE : 0, own: target === 'self', team: target === 'ally', seconds })
  } else if ((stat === 'armor' || stat === 'magic_resist' || stat === 'health') && direction === 'raise' && target !== 'enemy') {
    const held = stat === 'armor' ? c.armor : stat === 'magic_resist' ? c.magicResist : c.health
    const gained = unit === 'percent' ? held * percentOf(size) : size
    // Health is worth its size scaled by the resistances behind it. A point of resistance is worth a
    // hundredth of the health it protects, for the half of the damage it applies to.
    const effectiveHealth = stat === 'health' ? gained * (1 + (c.armor + c.magicResist) / 200) : (0.5 * c.health * gained) / 100
    parts.sustain = effectiveHealth * Math.min(1, seconds / FIGHT_SECONDS) * SHIELD_WEIGHT * (target === 'ally' ? ALLY_BUFF_WEIGHT : 1)
  } else if (stat === 'move_speed' && direction === 'lower' && target === 'enemy') {
    const strength = unit === 'percent' ? percentOf(size) : SLOW_REFERENCE_STRENGTH
    const lasts = explicit || DEFAULT_SOFT_SECONDS
    parts.utility = lasts * CC_VALUE_PER_SECOND * CC_WEIGHT.slow * (strength / SLOW_REFERENCE_STRENGTH)
  } else if (stat === 'move_speed' && direction === 'raise' && target !== 'enemy') {
    parts.utility = FLAT_UTILITY_VALUE.speed_boost * (target === 'ally' ? ALLY_BUFF_WEIGHT : 1)
  } else {
    parts.utility = OTHER_UTILITY_VALUE
  }
  return parts
}

function evaluateEffect(effect: Effect, rankIndex: number, c: Combatant, alwaysOn: boolean): Parts {
  const parts = noParts()
  const base = valueAt(effect.base, rankIndex)
  const amount = base + (effect.ratios ?? []).reduce((sum, r) => sum + ratioAmount(r, rankIndex, c), 0)
  const type = effect.type
  const { family, unit } = effectKind(effect)
  const explicit = valueAt(effect.duration, rankIndex)

  if (type === STAT_CHANGE) return evaluateStatChange(effect, amount, rankIndex, c, alwaysOn)

  if (family === 'damage') {
    const mitigation = effect.damage_type === 'True' ? 1
      : 100 / (100 + targetResist(effect.damage_type === 'Magic' ? 'magic_resist' : 'armor', c))
    parts.damage = Math.max(0, amount) * mitigation
    if (effect.damage_type === 'Magic') parts.magic = parts.damage
    else if (effect.damage_type !== 'True') parts.physical = parts.damage
  } else if (family === 'sustain') {
    parts.sustain = Math.max(0, amount) * (type === 'shield' ? SHIELD_WEIGHT : HEAL_WEIGHT)
  } else if (family === 'hard_control') {
    // The editor has no duration field, so a hard control's number (its base plus any scalers) is
    // its length when its unit is seconds; otherwise it is priced at a default length for what it is.
    const seconds = explicit || (unit === 'seconds' && amount > 0 && amount <= 5 ? amount : DEFAULT_CC_SECONDS[type] ?? 1)
    parts.utility = seconds * CC_VALUE_PER_SECOND * (CC_WEIGHT[type] ?? 1)
  } else if (family === 'soft_control') {
    // A soft control's number is its strength as a percentage, or its length if the unit is seconds.
    const strength = unit === 'percent' ? (amount > 1 ? Math.min(amount, 100) / 100 : amount > 0 ? amount : SLOW_REFERENCE_STRENGTH) : SLOW_REFERENCE_STRENGTH
    const seconds = explicit || (unit === 'seconds' && amount > 0 && amount <= 5 ? amount : DEFAULT_CC_SECONDS[type] ?? DEFAULT_SOFT_SECONDS)
    parts.utility = seconds * CC_VALUE_PER_SECOND * (CC_WEIGHT[type] ?? CC_WEIGHT.slow) * (strength / SLOW_REFERENCE_STRENGTH)
  } else if (type === 'untargetable' || type === 'invulnerable') {
    parts.sustain = stateSeconds(amount) * c.health * UNHURT_HEALTH_PER_SECOND * SHIELD_WEIGHT
  } else if (type === 'unstoppable' || type === 'cc_immune') {
    parts.utility = stateSeconds(amount) * UNSTOPPABLE_PER_SECOND
  } else {
    parts.utility = FLAT_UTILITY_VALUE[type] ?? OTHER_UTILITY_VALUE
  }
  return parts
}

function evaluateBody(body: AbilityBody, rankIndex: number, c: Combatant, alwaysOn: boolean): Parts {
  const total = noParts()
  for (const effect of body.effects ?? []) {
    const p = evaluateEffect(effect, rankIndex, c, alwaysOn)
    total.damage += p.damage
    total.utility += p.utility
    total.sustain += p.sustain
    total.physical += p.physical
    total.magic += p.magic
    total.shreds.push(...p.shreds)
  }
  return total
}

function isPriced(p: Parts): boolean {
  return p.damage + p.utility + p.sustain > 0 || p.shreds.length > 0
}

export function evaluateKit(champion: Champion, c: Combatant): KitReport {
  const slots: SlotReport[] = []
  let rotationCost = 0
  // Shred and penetration are settled in a second pass: they multiply damage from the whole kit,
  // including keys that come after the one that grants them.
  const shreds: { report: SlotReport; shred: Shred; uptime: number }[] = []
  const rate = { armor: 0, magic_resist: 0 }

  for (const slot of KIT_SLOTS) {
    const ability = champion.abilities?.[slot]
    const report: SlotReport = { slot, name: ability?.name ?? '', scored: false, damage: 0, utility: 0, sustain: 0, damagePerCast: 0, cooldown: 0, shredDamage: 0, teamShare: 0 }
    if (!ability) { slots.push(report); continue }

    const rank = slot === 'r' ? ULT_RANK : BASIC_RANK
    const rankIndex = Math.max(0, Math.min(rank, ability.max_rank || rank) - 1)
    const fallbackPeriod = slot === 'passive' ? ASSUMED_PASSIVE_PERIOD : ASSUMED_COOLDOWN
    const ownCooldown = valueAt(ability.cooldown, rankIndex)

    const bodies: { body: AbilityBody; weight: number; inheritCooldown: boolean }[] = [
      { body: ability, weight: 1, inheritCooldown: false },
      ...(ability.blocks ?? []).map(b => ({ body: b as AbilityBody, weight: BLOCK_WEIGHT[b.kind] ?? 0.5, inheritCooldown: b.kind !== 'passive' })),
    ]

    for (const [i, { body, weight, inheritCooldown }] of bodies.entries()) {
      const declared = valueAt(body.cooldown, rankIndex) || (inheritCooldown ? ownCooldown : 0)
      // A passive with no cooldown of its own is always in effect, so what it grants isn't a timed buff.
      const parts = evaluateBody(body, rankIndex, c, slot === 'passive' && !declared)
      if (!isPriced(parts)) continue
      report.scored = true
      const cooldown = Math.max(1, (declared || fallbackPeriod) * 100 / (100 + c.abilityHaste))
      rate.armor += (parts.physical * weight) / cooldown
      rate.magic_resist += (parts.magic * weight) / cooldown
      for (const shred of parts.shreds) shreds.push({ report, shred, uptime: Math.min(1, shred.seconds / cooldown) * weight })
      report.damage += (parts.damage * weight) / cooldown
      report.utility += (parts.utility * weight) / cooldown
      report.sustain += (parts.sustain * weight) / cooldown
      if (i === 0) {
        report.damagePerCast = parts.damage
        report.cooldown = cooldown
      }
    }

    if (slot !== 'passive' && ['Mana', 'Energy'].includes(ability.cost_type ?? 'Mana')) {
      rotationCost += valueAt(ability.cost, rankIndex)
    }
    slots.push(report)
  }

  for (const resist of ['armor', 'magic_resist'] as const) {
    const base = resist === 'armor' ? TARGET_ARMOR : TARGET_MAGIC_RESIST
    const pen = itemPenetration(resist, c)
    const active = shreds.filter(s => s.shred.resist === resist)
    const gains = active.map(s => (resistMultiplier(base, s.shred.percent, s.shred.flat, pen) - 1) * s.uptime)
    const sum = gains.reduce((a, b) => a + b, 0)
    const scale = sum > MAX_SHRED_GAIN ? MAX_SHRED_GAIN / sum : 1
    active.forEach(({ report, shred }, i) => {
      const gain = gains[i] * scale
      if (shred.own) {
        const extra = gain * rate[resist]
        report.damage += extra
        report.shredDamage += extra
      }
      if (shred.team) {
        // Half of what teammates deal is of each kind.
        const extra = gain * 0.5 * ALLY_DAMAGE * TEAM_CREDIT
        report.utility += extra
        report.teamShare += extra
      }
    })
  }

  // Resource: the pool plus what regenerates over the 20 seconds a rotation takes to come back around.
  const budget = c.resource + 4 * c.resourceRegen
  return { slots, rotations: rotationCost > 0 ? budget / rotationCost : null }
}
