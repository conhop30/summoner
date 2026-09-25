import type { Effect, EffectFamily, EffectUnit } from './types'
import { describeRatio } from './ratios'

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
}

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
  const builtIn = BUILT_IN[effect.type]
  if (builtIn && isBuiltInEffect(effect.type)) return builtIn
  const family = effect.family ?? guessFamily(effect.type ?? '')
  return { family, unit: effect.unit ?? defaultUnitFor(family) }
}

/** How a unit reads after "Base per rank", or nothing where it needs no explaining. */
export function unitSuffix(unit: EffectUnit): string {
  return unit === 'seconds' ? ' (seconds)' : unit === 'percent' ? ' (%)' : ''
}

/** An effect type as a name: "knock_up" becomes "Knock up", a custom label keeps what was typed. */
export function effectName(type: string): string {
  const text = type.replace(/_/g, ' ').trim()
  return text ? text[0].toUpperCase() + text.slice(1) : 'Effect'
}

function trimNumber(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** Base values across the ranks: "60" if they are all the same, otherwise "40/65/90". */
function rankList(values: number[]): string {
  return values.every(v => v === values[0]) ? trimNumber(values[0]) : values.map(trimNumber).join('/')
}

/**
 * One line that says what an effect does, for the collapsed card: "Damage · Magic · 40/65/90 + 45% AP".
 * It reads the same however many scalers there are, so a busy effect stays one tidy line.
 */
export function describeEffect(effect: Effect): string {
  const kind = effectKind(effect)
  const head = [effectName(effect.type)]
  if (kind.family === 'damage') head.push(effect.damage_type ?? 'Physical')

  const amounts: string[] = []
  const base = effect.base ?? []
  if (base.some(v => v)) {
    amounts.push(rankList(base) + (kind.unit === 'seconds' ? ' s' : kind.unit === 'percent' ? '%' : ''))
  }
  for (const ratio of effect.ratios ?? []) {
    const text = describeRatio(ratio)
    if (text) amounts.push(text)
  }
  return `${head.join(' · ')} · ${amounts.length ? amounts.join(' + ') : 'no numbers yet'}`
}
