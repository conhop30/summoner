import type { AbilityBody, AbilitySlot, Champion, Effect, RatioEntry, RatioPart } from '../champion/types'
import { effectKind } from '../champion/effects'
import { assumedUnits, ratioFraction, resolveRatio, type RatioStatId } from '../champion/ratios'
import type { Combatant } from './combatant'

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
  stun: 1, knock_up: 1, charm: 1, fear: 1, silence: 0.6, knock_back: 0.4, slow: 0.5,
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
}

export interface KitReport {
  slots: SlotReport[]
  /** Casting the whole Q-W-E-R rotation once, against the resource pool: how many times over. */
  rotations: number | null
}

interface Parts {
  damage: number
  utility: number
  sustain: number
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
    // Items don't grant these in the data the app reads yet, so they count for nothing.
    case 'lethality':
    case 'armor_pen':
    case 'magic_pen':
      return 0
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

function evaluateEffect(effect: Effect, rankIndex: number, c: Combatant): Parts {
  const parts: Parts = { damage: 0, utility: 0, sustain: 0 }
  const base = valueAt(effect.base, rankIndex)
  const amount = base + (effect.ratios ?? []).reduce((sum, r) => sum + ratioAmount(r, rankIndex, c), 0)
  const type = effect.type
  const { family, unit } = effectKind(effect)
  const explicit = valueAt(effect.duration, rankIndex)

  if (family === 'damage') {
    const mitigation = effect.damage_type === 'True' ? 1
      : 100 / (100 + (effect.damage_type === 'Magic' ? TARGET_MAGIC_RESIST : TARGET_ARMOR))
    parts.damage = Math.max(0, amount) * mitigation
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
  } else {
    parts.utility = FLAT_UTILITY_VALUE[type] ?? OTHER_UTILITY_VALUE
  }
  return parts
}

function evaluateBody(body: AbilityBody, rankIndex: number, c: Combatant): Parts {
  const total: Parts = { damage: 0, utility: 0, sustain: 0 }
  for (const effect of body.effects ?? []) {
    const p = evaluateEffect(effect, rankIndex, c)
    total.damage += p.damage
    total.utility += p.utility
    total.sustain += p.sustain
  }
  return total
}

function isPriced(p: Parts): boolean {
  return p.damage + p.utility + p.sustain > 0
}

export function evaluateKit(champion: Champion, c: Combatant): KitReport {
  const slots: SlotReport[] = []
  let rotationCost = 0

  for (const slot of KIT_SLOTS) {
    const ability = champion.abilities?.[slot]
    const report: SlotReport = { slot, name: ability?.name ?? '', scored: false, damage: 0, utility: 0, sustain: 0, damagePerCast: 0, cooldown: 0 }
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
      const parts = evaluateBody(body, rankIndex, c)
      if (!isPriced(parts)) continue
      report.scored = true
      const declared = valueAt(body.cooldown, rankIndex) || (inheritCooldown ? ownCooldown : 0)
      const cooldown = Math.max(1, (declared || fallbackPeriod) * 100 / (100 + c.abilityHaste))
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

  // Resource: the pool plus what regenerates over the 20 seconds a rotation takes to come back around.
  const budget = c.resource + 4 * c.resourceRegen
  return { slots, rotations: rotationCost > 0 ? budget / rotationCost : null }
}
