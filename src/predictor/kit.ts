import type { AbilityBody, AbilitySlot, Champion, Effect } from '../champion/types'
import type { Combatant } from './combatant'

// Turns a champion's five abilities into rates of "damage-equivalent" value per second at the
// reference moment. Everything an ability does is priced in the same unit: damage dealt to a
// typical target, crowd control at so much per second, shields and heals at a discount.
// The prices below are hand-tuned assumptions. Data Dragon publishes no ability numbers to fit them to.

/** The enemy the damage is dealt to: a typical mid-game champion. */
export const TARGET_ARMOR = 80
export const TARGET_MAGIC_RESIST = 60

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

// A ratio is a fraction of a stat (0.6 for 60% AP). Anyone typing 60 means the same, and no real
// ratio is above 5, so a bigger number is read as a percentage.
function ratioFraction(v: number): number {
  return Math.abs(v) > 5 ? v / 100 : v
}

function statForRatio(name: string, c: Combatant): number {
  switch (name.trim().toLowerCase()) {
    case 'ap': case 'ability power': return c.abilityPower
    case 'bonus ad': case 'bonus attack damage': return Math.max(0, c.attackDamage - c.baseAttackDamage)
    case 'total ad': case 'ad': case 'attack damage': return c.attackDamage
    case 'max health': case 'maximum health': case 'health': return c.health
    case 'bonus health': return Math.max(0, c.health - c.baseHealth)
    // An ability that scales with missing health is used when the target is hurt: call it 40%.
    case 'missing health': return c.health * 0.4
    case 'armor': case 'bonus armor': return c.armor
    case 'magic resist': case 'magic resistance': case 'mr': return c.magicResist
    case 'move speed': return c.moveSpeed
    default: return 0
  }
}

function evaluateEffect(effect: Effect, rankIndex: number, c: Combatant): Parts {
  const parts: Parts = { damage: 0, utility: 0, sustain: 0 }
  const base = valueAt(effect.base, rankIndex)
  const amount = base + (effect.ratios ?? []).reduce(
    (sum, r) => sum + ratioFraction(valueAt(r.values, rankIndex)) * statForRatio(r.stat, c), 0)
  const type = effect.type

  if (type === 'damage') {
    const mitigation = effect.damage_type === 'True' ? 1
      : 100 / (100 + (effect.damage_type === 'Magic' ? TARGET_MAGIC_RESIST : TARGET_ARMOR))
    parts.damage = Math.max(0, amount) * mitigation
  } else if (type === 'heal') {
    parts.sustain = Math.max(0, amount) * HEAL_WEIGHT
  } else if (type === 'shield') {
    parts.sustain = Math.max(0, amount) * SHIELD_WEIGHT
  } else if (type in CC_WEIGHT) {
    // The editor has no duration field, so a hard control's "Base per rank" is its length in
    // seconds; a slow's is its strength as a percentage.
    const explicit = valueAt(effect.duration, rankIndex)
    if (type === 'slow') {
      const strength = base > 1 ? Math.min(base, 100) / 100 : base > 0 ? base : 0.3
      parts.utility = (explicit || DEFAULT_CC_SECONDS.slow) * CC_VALUE_PER_SECOND * CC_WEIGHT.slow * (strength / 0.3)
    } else {
      const seconds = explicit || (base > 0 && base <= 5 ? base : DEFAULT_CC_SECONDS[type] ?? 1)
      parts.utility = seconds * CC_VALUE_PER_SECOND * CC_WEIGHT[type]
    }
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
