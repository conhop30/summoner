import type { RatioEntry, RatioPart } from './types'

// What an ability can scale with. A ratio names a stat and which part of it counts: its base value
// (what the champion has on its own), its bonus (what items and effects add), or the total. Only
// stats that have a base of their own offer all three; the rest (ability power, lethality,
// penetration, crit chance, ability haste) are total-only, because the game gives a champion none
// of them before items.
//
// Ratios saved before this existed are free text ("Bonus AD", "Max Health"). resolveRatio reads
// those too, so they keep working untouched and are rewritten in the new form the next time one is
// edited. Anything it can't place is kept as typed and simply counts for nothing.

export type RatioStatId =
  | 'ad' | 'ap' | 'armor' | 'magic_resist' | 'health' | 'missing_health' | 'resource'
  | 'health_regen' | 'resource_regen' | 'attack_speed' | 'move_speed'
  | 'crit_chance' | 'lethality' | 'armor_pen' | 'magic_pen' | 'ability_haste'

export interface RatioStatDef {
  id: RatioStatId
  /** As the picker shows it. */
  label: string
  /** As it reads inside a sentence: "45% AP", "bonus armor". */
  short: string
  /** Parts that can be chosen. `['total']` means the stat has no separate base and bonus. */
  parts: RatioPart[]
}

const ALL_PARTS: RatioPart[] = ['total', 'bonus', 'base']
const TOTAL_ONLY: RatioPart[] = ['total']

export const RATIO_STATS: RatioStatDef[] = [
  { id: 'ad', label: 'Attack Damage', short: 'AD', parts: ALL_PARTS },
  { id: 'ap', label: 'Ability Power', short: 'AP', parts: TOTAL_ONLY },
  { id: 'armor', label: 'Armor', short: 'armor', parts: ALL_PARTS },
  { id: 'magic_resist', label: 'Magic Resist', short: 'MR', parts: ALL_PARTS },
  { id: 'health', label: 'Health', short: 'health', parts: ALL_PARTS },
  { id: 'missing_health', label: 'Missing Health (own)', short: 'missing health', parts: TOTAL_ONLY },
  { id: 'resource', label: 'Resource (Mana, Energy...)', short: 'resource', parts: ALL_PARTS },
  { id: 'health_regen', label: 'Health Regen', short: 'health regen', parts: ALL_PARTS },
  { id: 'resource_regen', label: 'Resource Regen', short: 'resource regen', parts: ALL_PARTS },
  { id: 'attack_speed', label: 'Attack Speed', short: 'attack speed', parts: ALL_PARTS },
  { id: 'move_speed', label: 'Move Speed', short: 'move speed', parts: ALL_PARTS },
  { id: 'crit_chance', label: 'Critical Chance', short: 'crit chance', parts: TOTAL_ONLY },
  { id: 'lethality', label: 'Lethality', short: 'lethality', parts: TOTAL_ONLY },
  { id: 'armor_pen', label: 'Armor Penetration', short: 'armor pen', parts: TOTAL_ONLY },
  { id: 'magic_pen', label: 'Magic Penetration', short: 'magic pen', parts: TOTAL_ONLY },
  { id: 'ability_haste', label: 'Ability Haste', short: 'ability haste', parts: TOTAL_ONLY },
]

export const PART_LABELS: Record<RatioPart, string> = { total: 'Total', bonus: 'Bonus', base: 'Base' }

const BY_ID = new Map<string, RatioStatDef>(RATIO_STATS.map(d => [d.id, d]))

export function ratioStatDef(id: string): RatioStatDef | undefined {
  return BY_ID.get(id)
}

export interface ResolvedRatio {
  stat: RatioStatId
  part: RatioPart
}

// What free text from before the picker existed can mean. A leading "bonus", "base" or "total" is
// peeled off first; what is left is looked up here.
const LEGACY_STATS: Record<string, RatioStatId> = {
  ap: 'ap', 'ability power': 'ap',
  ad: 'ad', 'attack damage': 'ad',
  armor: 'armor',
  mr: 'magic_resist', 'magic resist': 'magic_resist', 'magic resistance': 'magic_resist',
  health: 'health', hp: 'health', 'max health': 'health', 'maximum health': 'health',
  'missing health': 'missing_health',
  mana: 'resource', resource: 'resource',
  'health regen': 'health_regen', 'health regeneration': 'health_regen',
  'mana regen': 'resource_regen', 'mana regeneration': 'resource_regen',
  'resource regen': 'resource_regen', 'resource regeneration': 'resource_regen',
  'attack speed': 'attack_speed', as: 'attack_speed',
  'move speed': 'move_speed', 'movement speed': 'move_speed',
  'crit chance': 'crit_chance', 'critical chance': 'crit_chance', 'critical strike chance': 'crit_chance',
  lethality: 'lethality',
  'armor penetration': 'armor_pen', 'armor pen': 'armor_pen',
  'magic penetration': 'magic_pen', 'magic pen': 'magic_pen',
  'ability haste': 'ability_haste',
}

function parseLegacy(text: string): ResolvedRatio | null {
  const words = text.trim().toLowerCase().replace(/\s+/g, ' ')
  const prefix = /^(bonus|base|total) /.exec(words)
  const stem = prefix ? words.slice(prefix[0].length) : words
  const stat = Object.prototype.hasOwnProperty.call(LEGACY_STATS, stem) ? LEGACY_STATS[stem] : undefined
  if (!stat) return null
  // A part the stat doesn't have (a "bonus AP") means the total.
  const wanted = (prefix?.[1] as RatioPart | undefined) ?? 'total'
  return { stat, part: BY_ID.get(stat)!.parts.includes(wanted) ? wanted : 'total' }
}

/** Which stat and part a ratio means, whether it is in the structured form or old free text. Null if it can't be placed. */
export function resolveRatio(entry: Pick<RatioEntry, 'stat' | 'part'>): ResolvedRatio | null {
  const def = BY_ID.get(entry.stat)
  if (def) return { stat: def.id, part: entry.part && def.parts.includes(entry.part) ? entry.part : 'total' }
  return parseLegacy(entry.stat ?? '')
}

/** The ratio in the structured form if it can be placed, otherwise exactly as it was. */
export function normalizeRatio(entry: RatioEntry): RatioEntry {
  const resolved = resolveRatio(entry)
  if (!resolved) return entry
  return { ...entry, stat: resolved.stat, part: resolved.part }
}

// A ratio is a fraction of a stat (0.6 for 60%). Anyone typing 60 means the same, and no real
// ratio is above 5, so a bigger number is read as a percentage.
export function ratioFraction(v: number): number {
  return Math.abs(v) > 5 ? v / 100 : v
}

function trim(n: number): string {
  return String(Math.round(n * 10) / 10)
}

/** "45%" for a ratio that doesn't change with rank, "40–60%" for one that does. */
function percentText(values: number[]): string {
  const percents = values.map(v => ratioFraction(v) * 100)
  const first = percents[0]
  const last = percents[percents.length - 1]
  return first === last ? `${trim(first)}%` : `${trim(first)}–${trim(last)}%`
}

/** The stat as it reads in a sentence: "AP", "bonus AD", "armor". */
export function ratioStatText(entry: Pick<RatioEntry, 'stat' | 'part'>): string {
  const resolved = resolveRatio(entry)
  if (!resolved) return entry.stat
  const def = BY_ID.get(resolved.stat)!
  return resolved.part === 'total' ? def.short : `${resolved.part} ${def.short}`
}

/** A ratio as a phrase, "45% AP" or "40–60% bonus AD", or null when it has no value yet. */
export function describeRatio(entry: RatioEntry): string | null {
  const values = entry.values ?? []
  if (values.length === 0 || values.every(v => !v)) return null
  return `${percentText(values)} ${ratioStatText(entry)}`
}
