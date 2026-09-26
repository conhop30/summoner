import type { DamageType, Effect } from './types'
import { STAT_CHANGE, isBuiltInEffect, statChangeOf, canLast } from './effects'

// What an effect does, in the words a person would use, as a short curated list. Each outcome is a
// preset for the fields an effect already has (its type, damage type, stat, direction, who it
// affects and unit), so choosing "Armor shred" fills in all of them at once and nothing new is
// stored: the same list reads an existing effect back into its outcome, and an effect that fits no
// entry is simply "Custom". Everything that needs to offer, name or recognise an outcome asks here.

export type OutcomeKind = 'damage' | 'buff' | 'debuff' | 'state' | 'custom'

/** What a piece of ability text is about, so it can be coloured the way the game colours it. */
export type Tone = 'physical' | 'magic' | 'true'

export interface Outcome {
  id: string
  kind: OutcomeKind
  label: string
  /** The words that follow this outcome's amount in a sentence ("magic damage"), written in after it when a description leaves them out. */
  noun?: string
  tone?: Tone
  /** The effect fields this outcome sets. */
  fields: Partial<Effect>
  /** True for an effect that is this outcome. */
  matches: (effect: Effect) => boolean
  /** A catch-all that only applies after every specific outcome has had its say. */
  fallback?: boolean
}

export const KIND_OPTIONS: { kind: OutcomeKind; label: string; hint: string }[] = [
  { kind: 'damage', label: 'Damage', hint: 'Hurts a target' },
  { kind: 'buff', label: 'Buff', hint: 'Heals, shields or strengthens someone' },
  { kind: 'debuff', label: 'Debuff', hint: 'Weakens or controls an enemy' },
  { kind: 'state', label: 'State', hint: 'Makes the champion untargetable, unstoppable and the like' },
  { kind: 'custom', label: 'Custom', hint: 'Anything else: name it yourself' },
]

const byType = (id: string, kind: OutcomeKind, label: string, type: string, alsoTypes: string[] = []): Outcome => ({
  id, kind, label, fields: { type }, matches: e => e.type === type || alsoTypes.includes(e.type),
})

const damage = (id: string, label: string, damageType: DamageType): Outcome => ({
  id, kind: 'damage', label, noun: label.toLowerCase(), tone: damageType.toLowerCase() as Tone,
  fields: { type: 'damage', damage_type: damageType },
  matches: e => e.type === 'damage' && (e.damage_type ?? 'Physical') === damageType,
})

// A change to one stat. `raise` outcomes cover any target but an enemy, `lower` ones an enemy.
const gains = (id: string, label: string, stat: string, unit: 'flat' | 'percent', alsoTypes: string[] = []): Outcome => ({
  id, kind: 'buff', label,
  fields: { type: STAT_CHANGE, stat, direction: 'raise', target: 'self', unit },
  matches: e => alsoTypes.includes(e.type) || (e.type === STAT_CHANGE && statChangeOf(e).stat === stat && statChangeOf(e).direction === 'raise' && statChangeOf(e).target !== 'enemy'),
})

const shreds = (id: string, label: string, stat: string): Outcome => ({
  id, kind: 'debuff', label,
  fields: { type: STAT_CHANGE, stat, direction: 'lower', target: 'enemy', unit: 'percent' },
  matches: e => e.type === STAT_CHANGE && statChangeOf(e).stat === stat && statChangeOf(e).direction === 'lower' && statChangeOf(e).target === 'enemy',
})

export const OUTCOMES: Outcome[] = [
  damage('physical', 'Physical damage', 'Physical'),
  damage('magic', 'Magic damage', 'Magic'),
  damage('true', 'True damage', 'True'),

  byType('heal', 'buff', 'Healing', 'heal'),
  byType('shield', 'buff', 'Shielding', 'shield'),
  gains('armor', 'Armor', 'armor', 'flat', ['armor_modifier']),
  gains('magic_resist', 'Magic resist', 'magic_resist', 'flat', ['magic_resistance_modifier']),
  gains('attack_speed', 'Attack speed', 'attack_speed', 'percent'),
  {
    id: 'move_speed', kind: 'buff', label: 'Movement speed',
    fields: { type: 'speed_boost' },
    matches: e => e.type === 'speed_boost' || (e.type === STAT_CHANGE && statChangeOf(e).stat === 'move_speed' && statChangeOf(e).direction === 'raise' && statChangeOf(e).target !== 'enemy'),
  },
  byType('dash', 'buff', 'Dash', 'dash'),
  {
    id: 'stat_up', kind: 'buff', label: 'Other stat…', fallback: true,
    fields: { type: STAT_CHANGE, stat: 'ad', direction: 'raise', target: 'self', unit: 'flat' },
    matches: e => e.type === STAT_CHANGE && statChangeOf(e).direction === 'raise',
  },

  shreds('armor_shred', 'Armor shred', 'armor'),
  shreds('magic_resist_shred', 'Magic resist shred', 'magic_resist'),
  {
    id: 'slow', kind: 'debuff', label: 'Slow',
    fields: { type: 'slow' },
    matches: e => e.type === 'slow' || (e.type === STAT_CHANGE && statChangeOf(e).stat === 'move_speed' && statChangeOf(e).direction === 'lower' && statChangeOf(e).target === 'enemy'),
  },
  byType('taunt', 'debuff', 'Taunt', 'taunt'),
  byType('silence', 'debuff', 'Silence', 'silence'),
  byType('fear', 'debuff', 'Fear', 'fear'),
  byType('root', 'debuff', 'Root', 'root'),
  byType('stun', 'debuff', 'Stun', 'stun'),
  byType('airborne', 'debuff', 'Airborne', 'knock_up'),
  byType('charm', 'debuff', 'Charm', 'charm'),
  byType('knock_back', 'debuff', 'Knock back', 'knock_back'),
  {
    id: 'stat_down', kind: 'debuff', label: 'Other stat…', fallback: true,
    fields: { type: STAT_CHANGE, stat: 'attack_speed', direction: 'lower', target: 'enemy', unit: 'percent' },
    matches: e => e.type === STAT_CHANGE,
  },

  byType('untargetable', 'state', 'Untargetable', 'untargetable'),
  byType('invulnerable', 'state', 'Invulnerable', 'invulnerable'),
  byType('unstoppable', 'state', 'Unstoppable', 'unstoppable'),
  byType('cc_immune', 'state', 'CC immune', 'cc_immune'),

  {
    id: 'custom', kind: 'custom', label: 'Custom', fallback: true,
    fields: { type: '' },
    matches: e => !isBuiltInEffect(e.type),
  },
]

export function outcomesFor(kind: OutcomeKind): Outcome[] {
  return OUTCOMES.filter(o => o.kind === kind)
}

export function outcomeById(id: string): Outcome | undefined {
  return OUTCOMES.find(o => o.id === id)
}

/** The outcome an effect is. A built-in type the list doesn't name falls back to Custom, so every effect has one. */
export function outcomeOf(effect: Effect): Outcome {
  const specific = OUTCOMES.find(o => !o.fallback && o.matches(effect))
  if (specific) return specific
  return OUTCOMES.find(o => o.fallback && o.matches(effect)) ?? OUTCOMES[OUTCOMES.length - 1]
}

const CLEARED: Partial<Effect> = { family: undefined, unit: undefined, damage_type: undefined, stat: undefined, direction: undefined, target: undefined }

/**
 * The effect with a different outcome: its numbers, name and notes stay, and the fields that say what
 * it does are replaced. A duration goes too if the new outcome has none (a heal doesn't last), so
 * nothing stale is left to be read.
 */
export function applyOutcome(effect: Effect, outcome: Outcome): Effect {
  const next = { ...effect, ...CLEARED, ...outcome.fields } as Effect
  if (!canLast(next)) next.duration = undefined
  return next
}

/** An effect that has just been added: the first thing the list offers. */
export function newEffect(): Effect {
  return applyOutcome({ type: '' }, OUTCOMES[0])
}
