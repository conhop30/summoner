import type { BaseStats } from '../champion/types'
import type { ChampionCatalogEntry } from '../championCatalog/types'
import { mapDDragonStats } from '../championCatalog/suggestions'
import { bodyIndex, combatantAt, coreStatsFilled, REFERENCE_LEVEL } from './combatant'
import { classProfile, referenceBonuses } from './reference'

// Where the stats half of the prediction gets its calibration: how sturdy and hard-hitting the
// real champions' bodies are, class by class, so a Tank is judged against Tanks.

export interface BodyStat {
  mean: number
  sd: number
  n: number
}

export interface BodyProfile {
  all: BodyStat
  byClass: Record<string, BodyStat>
  source: 'synced' | 'builtin'
}

/** Fewer champions than this in a class and its own average isn't trusted. */
const MIN_CLASS_SIZE = 8
/** Fewer than this in the whole roster and the built-in profile is used instead. */
const MIN_ROSTER_SIZE = 40

function statOf(values: number[]): BodyStat {
  const n = values.length
  const mean = values.reduce((s, v) => s + v, 0) / n
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  return { mean, sd: Math.sqrt(variance), n }
}

/** The body index of a roster champion: its level-13 stats with the typical items for its class. */
export function rosterBodyIndex(entry: ChampionCatalogEntry): number | null {
  const base = mapDDragonStats(entry.stats) as Partial<BaseStats>
  if (coreStatsFilled(base) < 6) return null
  const profile = classProfile(entry.tags)
  const offense = profile.ap ? 'ap' : 'ad'
  return bodyIndex(combatantAt(base, REFERENCE_LEVEL, referenceBonuses(entry.tags, offense)), offense)
}

export function buildBodyProfile(catalog: ChampionCatalogEntry[]): BodyProfile {
  const all: number[] = []
  const byClass = new Map<string, number[]>()
  for (const entry of catalog) {
    const index = rosterBodyIndex(entry)
    if (index === null) continue
    all.push(index)
    for (const tag of entry.tags) {
      if (!byClass.has(tag)) byClass.set(tag, [])
      byClass.get(tag)!.push(index)
    }
  }
  if (all.length < MIN_ROSTER_SIZE) return BUILTIN_BODY_PROFILE
  const classes: Record<string, BodyStat> = {}
  for (const [tag, values] of byClass) if (values.length >= MIN_CLASS_SIZE) classes[tag] = statOf(values)
  return { all: statOf(all), byClass: classes, source: 'synced' }
}

/**
 * A class whose champions are nearly identical (Mages differ by only a few percent) would turn a
 * small difference into a huge score, so a difference smaller than this counts as one deviation.
 */
const MIN_SD = 0.1

/** How many standard deviations above the average champion of the same class(es) this body is. */
export function bodyZ(index: number, classes: string[], profile: BodyProfile): number {
  const stats = classes.map(c => profile.byClass[c]).filter((s): s is BodyStat => !!s)
  const use = stats.length > 0 ? stats : [profile.all]
  const zs = use.map(s => (index - s.mean) / Math.max(s.sd, MIN_SD))
  return zs.reduce((a, b) => a + b, 0) / zs.length
}

// Computed from Data Dragon's champion stats at patch 16.19.1 (173 champions), for use before the
// roster has been synced. The synced roster replaces it, so it only needs to be about right.
// To regenerate after changing the body index: run buildBodyProfile over a saved champion.json.
export const BUILTIN_BODY_PROFILE: BodyProfile = {
  all: { mean: 6.6704, sd: 0.3385, n: 173 },
  byClass: {
    Assassin: { mean: 6.4908, sd: 0.2837, n: 46 },
    Fighter: { mean: 6.3903, sd: 0.1827, n: 60 },
    Mage: { mean: 6.9556, sd: 0.0693, n: 75 },
    Marksman: { mean: 6.5505, sd: 0.2857, n: 33 },
    Support: { mean: 7.0487, sd: 0.0922, n: 43 },
    Tank: { mean: 6.6186, sd: 0.3885, n: 46 },
  },
  source: 'builtin',
}
