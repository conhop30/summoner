import type { BaseStats } from './types'

// The one place that knows what each champion stat IS: a whole number or a decimal, how many
// decimals it keeps, and what unit its per-level growth is in. Inputs, the suggestions, the
// lookup, the View page and the build comparison all go through here, so they can't disagree.

export type StatKind = 'int' | 'float'

export interface StatSpec {
  valueKey: keyof BaseStats
  growthKey?: keyof BaseStats
  /** Whole number or decimal. */
  kind: StatKind
  /** Decimals kept for the base value (0 for whole numbers). */
  decimals: number
  /**
   * What the per-level growth means. `flat` adds that many points each level. `percent` is a
   * percentage of the BASE value — Data Dragon's attack speed growth of 2 means +2% per level,
   * not +2.0 attack speed.
   */
  growthUnit: 'flat' | 'percent'
  /** Step for the number input's arrows. */
  step: number
}

// Health regen, resource regen and attack speed are decimals; every other base stat is whole.
export const STAT_SPECS: StatSpec[] = [
  { valueKey: 'health',           growthKey: 'health_growth',           kind: 'int',   decimals: 0, growthUnit: 'flat', step: 1 },
  { valueKey: 'health_regen',     growthKey: 'health_regen_growth',     kind: 'float', decimals: 2, growthUnit: 'flat', step: 0.1 },
  { valueKey: 'resource',         growthKey: 'resource_growth',         kind: 'int',   decimals: 0, growthUnit: 'flat', step: 1 },
  { valueKey: 'resource_regen',   growthKey: 'resource_regen_growth',   kind: 'float', decimals: 2, growthUnit: 'flat', step: 0.1 },
  { valueKey: 'attack_damage',    growthKey: 'attack_damage_growth',    kind: 'int',   decimals: 0, growthUnit: 'flat', step: 1 },
  { valueKey: 'attack_speed',     growthKey: 'attack_speed_growth',     kind: 'float', decimals: 3, growthUnit: 'percent', step: 0.01 },
  { valueKey: 'armor',            growthKey: 'armor_growth',            kind: 'int',   decimals: 0, growthUnit: 'flat', step: 1 },
  { valueKey: 'magic_resistance', growthKey: 'magic_resistance_growth', kind: 'int',   decimals: 0, growthUnit: 'flat', step: 1 },
  { valueKey: 'movement_speed',   growthKey: 'movement_speed_growth',   kind: 'int',   decimals: 0, growthUnit: 'flat', step: 1 },
  { valueKey: 'attack_range',                                           kind: 'int',   decimals: 0, growthUnit: 'flat', step: 1 },
  { valueKey: 'crit_damage_multiplier',                                 kind: 'float', decimals: 2, growthUnit: 'flat', step: 0.05 },
]

/** Real growth values are fractional even for whole-number stats (armor +4.7 per level), so
 *  growth keeps decimals whatever its stat's kind. */
export const GROWTH_DECIMALS = 2

const byKey = new Map<keyof BaseStats, { spec: StatSpec; role: 'value' | 'growth' }>()
for (const spec of STAT_SPECS) {
  byKey.set(spec.valueKey, { spec, role: 'value' })
  if (spec.growthKey) byKey.set(spec.growthKey, { spec, role: 'growth' })
}

/** The spec a base-stat key (value or growth) belongs to, and which of the two it is. */
export function statSpecFor(key: keyof BaseStats): { spec: StatSpec; role: 'value' | 'growth' } | undefined {
  return byKey.get(key)
}

/** Arrow-key step for a stat's input: its own for the base value, a fine step for growth. */
export function inputStep(key: keyof BaseStats): number {
  const found = statSpecFor(key)
  return found?.role === 'growth' ? 0.1 : found?.spec.step ?? 1
}

export function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/** Coerce a number to what its stat allows: whole numbers are rounded, decimals are trimmed. */
export function normalizeStat(key: keyof BaseStats, n: number): number {
  const found = statSpecFor(key)
  if (!found || !Number.isFinite(n)) return n
  return roundTo(n, found.role === 'growth' ? GROWTH_DECIMALS : found.spec.decimals)
}

/** Every number in a (partial) set of stats coerced to what its stat allows. */
export function normalizeBaseStats(stats: Partial<BaseStats>): Partial<BaseStats> {
  const out: Record<string, number | number[] | undefined> = {}
  for (const [key, value] of Object.entries(stats) as [keyof BaseStats, number | number[] | undefined][]) {
    out[key] = Array.isArray(value) ? value.map(v => normalizeStat(key, v)) : typeof value === 'number' ? normalizeStat(key, value) : value
  }
  return out as Partial<BaseStats>
}

/** Text from an input box → the stored number: blank or unreadable is "not set". */
export function parseStatInput(key: keyof BaseStats, raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const n = parseFloat(raw)
  return Number.isFinite(n) ? normalizeStat(key, n) : undefined
}

/** A stat value as text, without trailing zeros: 610, 0.658, 8.5. */
export function formatStat(key: keyof BaseStats, n: number): string {
  return String(normalizeStat(key, n))
}

/** A growth value as text with its unit: "+104", "+4.7", "+2%". (Callers add "/lvl".) */
export function formatGrowth(valueKey: keyof BaseStats, n: number): string {
  const found = statSpecFor(valueKey)
  const growthKey = found?.spec.growthKey ?? valueKey
  const text = formatStat(growthKey, n)
  return found?.spec.growthUnit === 'percent' ? `+${text}%` : `+${text}`
}

/** The stat at a champion level (1–18): base plus growth, in the growth's own unit. */
export function statAtLevel(valueKey: keyof BaseStats, base: number, growth: number, level: number): number {
  const found = statSpecFor(valueKey)
  const steps = Math.max(0, level - 1)
  const raw = found?.spec.growthUnit === 'percent'
    ? base * (1 + (growth / 100) * steps)
    : base + growth * steps
  return normalizeStat(valueKey, raw)
}
