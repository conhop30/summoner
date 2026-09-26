import type { Effect, EffectFamily, EffectUnit, StatChangeDirection, StatChangeTarget } from './types'
import { describeRatio, rankList, ratioStatDef, unitAfter, type RatioStatId } from './ratios'

// What an effect IS, separately from what it is called. Built-in effect types (damage, stun, slow...)
// each carry a fixed family and unit. A custom effect ("taunt", "sleep", anything typed) has only a
// label, so it picks a family to say what it behaves like, and a unit to say what its base number
// measures. Everything that has to reason about an effect (the win-rate model today, an Advanced
// formula editor tomorrow) asks here, so a new kind of effect is one entry in one place.

export interface EffectKind {
  family: EffectFamily
  unit: EffectUnit
}

const BUILT_IN: Record<string, EffectKind> = {
  damage: { family: 'damage', unit: 'flat' },
  heal: { family: 'sustain', unit: 'flat' },
  shield: { family: 'sustain', unit: 'flat' },
  slow: { family: 'soft_control', unit: 'percent' },
  stun: { family: 'hard_control', unit: 'seconds' },
  knock_up: { family: 'hard_control', unit: 'seconds' },
  knock_back: { family: 'hard_control', unit: 'seconds' },
  charm: { family: 'hard_control', unit: 'seconds' },
  fear: { family: 'hard_control', unit: 'seconds' },
  silence: { family: 'hard_control', unit: 'seconds' },
  speed_boost: { family: 'utility', unit: 'percent' },
  armor_modifier: { family: 'utility', unit: 'flat' },
  magic_resistance_modifier: { family: 'utility', unit: 'flat' },
  dash: { family: 'utility', unit: 'flat' },
  // Its unit is the effect's own choice, flat or percent; see effectKind.
  stat_change: { family: 'utility', unit: 'flat' },
}

export const STAT_CHANGE = 'stat_change'

/** The effect types the editor offers as suggestions, in the order they are listed. */
export const BUILT_IN_EFFECT_TYPES: string[] = Object.keys(BUILT_IN)

export function isBuiltInEffect(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILT_IN, type)
}

export const FAMILY_OPTIONS: { value: EffectFamily; label: string; hint: string }[] = [
  { value: 'damage', label: 'Damage', hint: 'Deals damage' },
  { value: 'hard_control', label: 'Hard control', hint: 'Takes control of the target: stun, taunt, root, sleep' },
  { value: 'soft_control', label: 'Soft control', hint: 'Hinders the target: slow, blind' },
  { value: 'sustain', label: 'Heal or shield', hint: 'Restores health or absorbs damage' },
  { value: 'utility', label: 'Utility', hint: 'Anything else: dashes, buffs, stealth' },
]

export const UNIT_OPTIONS: { value: EffectUnit; label: string }[] = [
  { value: 'seconds', label: 'seconds' },
  { value: 'percent', label: '%' },
  { value: 'flat', label: 'a flat amount' },
]

// Words that say what a custom effect probably is, so typing "taunt" starts out as hard control
// without asking. It is only a starting point: a family picked by hand always wins.
const FAMILY_WORDS: [EffectFamily, string[]][] = [
  ['hard_control', ['taunt', 'root', 'snare', 'suppress', 'sleep', 'polymorph', 'ground', 'immobil', 'airborne', 'pull', 'drag', 'stasis', 'pin', 'knock', 'stun', 'charm', 'fear', 'flee', 'silence', 'disarm']],
  ['soft_control', ['slow', 'blind', 'cripple', 'weaken', 'sap', 'wither']],
  ['sustain', ['heal', 'shield', 'barrier', 'absorb', 'restore', 'lifesteal', 'regen']],
  ['damage', ['damage', 'burn', 'bleed', 'poison', 'execute', 'strike', 'explod']],
]

export function guessFamily(label: string): EffectFamily {
  const text = label.trim().toLowerCase()
  for (const [family, words] of FAMILY_WORDS) if (words.some(w => text.includes(w))) return family
  return 'utility'
}

export function defaultUnitFor(family: EffectFamily): EffectUnit {
  return family === 'hard_control' ? 'seconds' : family === 'soft_control' ? 'percent' : 'flat'
}

/** Family and unit of an effect: fixed for a built-in type, chosen (or guessed from the label) for a custom one. */
export function effectKind(effect: Pick<Effect, 'type' | 'family' | 'unit'>): EffectKind {
  if (effect.type === STAT_CHANGE) return { family: 'utility', unit: effect.unit === 'percent' ? 'percent' : 'flat' }
  const builtIn = BUILT_IN[effect.type]
  if (builtIn && isBuiltInEffect(effect.type)) return builtIn
  const family = effect.family ?? guessFamily(effect.type ?? '')
  return { family, unit: effect.unit ?? defaultUnitFor(family) }
}

/** How a unit reads after "Base per rank", or nothing where it needs no explaining. */
export function unitSuffix(unit: EffectUnit): string {
  return unit === 'seconds' ? ' (seconds)' : unit === 'percent' ? ' (%)' : ''
}

/** How the type picker names a type. Most read fine as they are; a stat change needs to say what it does. */
export function effectTypeLabel(type: string): string {
  return type === STAT_CHANGE ? 'Raise or lower a stat' : effectName(type)
}

/**
 * What an effect answers to in a description until it is given a name: {Damage}, {Stun}, and for a
 * stat change the stat it moves, {Armor}, which is how the sentence would say it.
 */
export function defaultTokenName(effect: Pick<Effect, 'type' | 'stat'>): string {
  if (effect.type === STAT_CHANGE) return ratioStatDef(statChangeOf(effect).stat)!.label
  return effectName(effect.type)
}

/** An effect type as a name: "knock_up" becomes "Knock up", a custom label keeps what was typed. */
export function effectName(type: string): string {
  const text = type.replace(/_/g, ' ').trim()
  return text ? text[0].toUpperCase() + text.slice(1) : 'Effect'
}

/** Effect types whose effect lasts a while, so the editor offers a duration for them. Instant ones (damage, heals, dashes) and controls (whose amount is their length) don't. */
const TIMED_TYPES = ['stat_change', 'slow', 'shield', 'speed_boost', 'armor_modifier', 'magic_resistance_modifier']

/** True when a duration makes sense for the effect, or one is already filled in. */
export function takesDuration(effect: Pick<Effect, 'type' | 'family' | 'unit' | 'duration'>): boolean {
  if ((effect.duration ?? []).some(v => v)) return true
  if (TIMED_TYPES.includes(effect.type)) return true
  return !isBuiltInEffect(effect.type) && effect.type.trim() !== '' && effectKind(effect).family !== 'hard_control'
}

// ─── Stat changes ──────────────────────────────────────────────────────────────

/** The stats a stat change can move, in the order the picker lists them. Penetration is here so shred can be written down. */
export const CHANGEABLE_STATS: RatioStatId[] = [
  'armor', 'magic_resist', 'health', 'attack_speed', 'move_speed', 'ad', 'ap',
  'crit_chance', 'ability_haste', 'lethality', 'armor_pen', 'magic_pen', 'health_regen', 'resource_regen',
]

export const DIRECTION_OPTIONS: { value: StatChangeDirection; label: string }[] = [
  { value: 'raise', label: 'Raise' },
  { value: 'lower', label: 'Lower' },
]

export const TARGET_OPTIONS: { value: StatChangeTarget; label: string; short: string }[] = [
  { value: 'self', label: 'Self', short: 'self' },
  { value: 'ally', label: 'An ally', short: 'an ally' },
  { value: 'enemy', label: 'An enemy', short: 'an enemy' },
]

/** What a new stat change starts as: the most common one, which the user then adjusts. */
export const STAT_CHANGE_DEFAULTS: Required<Pick<Effect, 'stat' | 'direction' | 'target' | 'unit'>> = {
  stat: 'armor', direction: 'raise', target: 'self', unit: 'flat',
}

/** A stat change's settings with the blanks filled in, so a half-made one still reads sensibly. */
export function statChangeOf(effect: Pick<Effect, 'stat' | 'direction' | 'target'>) {
  return {
    stat: effect.stat && ratioStatDef(effect.stat) ? effect.stat : STAT_CHANGE_DEFAULTS.stat,
    direction: effect.direction ?? STAT_CHANGE_DEFAULTS.direction,
    target: effect.target ?? STAT_CHANGE_DEFAULTS.target,
  }
}

/** "Raise armor on self": the sentence at the head of a stat change. */
export function describeStatChange(effect: Pick<Effect, 'stat' | 'direction' | 'target'>): string {
  const { stat, direction, target } = statChangeOf(effect)
  const verb = DIRECTION_OPTIONS.find(o => o.value === direction)!.label
  const who = TARGET_OPTIONS.find(o => o.value === target)!.short
  return `${verb} ${ratioStatDef(stat)!.short} on ${who}`
}

/**
 * One line that says what an effect does, for the collapsed card: "Damage · Magic · 40/65/90 + 45% AP".
 * It reads the same however many scalers there are, so a busy effect stays one tidy line.
 */
export function describeEffect(effect: Effect): string {
  const kind = effectKind(effect)
  const isStatChange = effect.type === STAT_CHANGE
  const head = [isStatChange ? describeStatChange(effect) : effectName(effect.type)]
  if (kind.family === 'damage') head.push(effect.damage_type ?? 'Physical')

  const amounts: string[] = []
  const base = effect.base ?? []
  if (base.some(v => v)) {
    amounts.push(rankList(base) + unitAfter(kind.unit))
  }
  for (const ratio of effect.ratios ?? []) {
    const text = describeRatio(ratio, kind.unit)
    if (text) amounts.push(text)
  }
  const lasts = (effect.duration ?? []).some(v => v) ? ` · for ${rankList(effect.duration!)} s` : ''
  return `${head.join(' · ')} · ${amounts.length ? amounts.join(' + ') : 'no numbers yet'}${lasts}`
}
