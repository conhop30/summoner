import type { AbilitySlot, Champion } from '../champion/types'
import type { ChampionCatalogEntry } from '../championCatalog/types'
import type { Item } from '../item/types'
import { getActiveBuild } from '../item/buildLogic'
import { bodyIndex, combatantAt, coreStatsFilled, CORE_STAT_COUNT, REFERENCE_GOLD, REFERENCE_LEVEL } from './combatant'
import { goldValueOf, scaleBonuses, totalsForBuild } from './gold'
import { evaluateKit, KIT_SLOTS, type SlotReport } from './kit'
import { classProfile, dominantOffense, referenceBonuses } from './reference'
import { bodyZ, buildBodyProfile, type BodyProfile } from './roster'

// The win-rate projection. It scores a champion at a mid-game snapshot (level 13, about 7,500g)
// on four things, each as a number of standard deviations from a typical champion, and turns
// the sum into percentage points around 50%:
//   stats  - the champion's own body (with typical items for the class) against real champions of the same class
//   damage - what the abilities deal per second to a typical target
//   utility and sustain - crowd control, mobility, shields and heals
//   build  - how well the items are priced, and what they trade between durability and damage
// The stats half is calibrated on the real roster. The kit half and the point weights are
// hand-tuned assumptions, because neither Data Dragon nor Riot's public data gives ability
// numbers or win rates to fit them to. The panel says so.

const BASE_WIN_RATE = 50
const MIN_WIN_RATE = 43
const MAX_WIN_RATE = 57

/** Percentage points per deviation. */
const POINTS = { stats: 0.7, damage: 1.5, utility: 0.6, sustain: 0.25, build: 0.4 }

/** A typical kit's damage-equivalent per second at the reference moment, and how wide "typical" is. */
const DAMAGE_REF = 70
const UTILITY_REF = 15
const SUSTAIN_REF = 5
const KIT_LOG_SD = 0.4
const KIT_Z_LIMIT = 2.5

/** Percentage points per unit of log change in the body index that a build causes (about 0.8 for 30% less durability). */
const BUILD_SHIFT_POINTS = 3
const BUILD_SHIFT_LIMIT = 2

/** What a plain-stat item is worth for its price, and how much that varies from build to build. */
const BUILD_EFFICIENCY_REF = 0.95
const BUILD_EFFICIENCY_SD = 0.15

/** How much of a typical kit each key is: what an unfilled key is assumed to contribute. */
const SLOT_SHARE: Record<AbilitySlot, number> = { passive: 0.1, q: 0.25, w: 0.2, e: 0.25, r: 0.2 }

const CORE_STAT_LABELS: [keyof Champion['base_stats'], string][] = [
  ['health', 'health'], ['armor', 'armor'], ['magic_resistance', 'magic resist'],
  ['attack_damage', 'attack damage'], ['attack_speed', 'attack speed'], ['movement_speed', 'move speed'],
]

export type ContributionKey = 'stats' | 'damage' | 'utility' | 'build'

export interface Contribution {
  key: ContributionKey
  label: string
  /** Percentage points added to or taken from 50%. */
  points: number
  /** What is behind it, in a few words. */
  note: string
}

export type Confidence = 'good' | 'fair' | 'rough'

export interface Prediction {
  /** False when too little is filled in to say anything: the panel shows what to fill in instead. */
  ready: boolean
  winRate: number
  /** The plus-or-minus around it, in percentage points. */
  band: number
  confidence: Confidence
  contributions: Contribution[]
  slots: SlotReport[]
  /** The build was empty or unreadable, so typical items for the class were assumed. */
  assumedBuild: boolean
  rosterSource: BodyProfile['source']
  hints: string[]
}

export interface PredictionInput {
  champion: Champion
  items: Item[]
  roster: ChampionCatalogEntry[]
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Deviations of a kit rate from the reference, on a log scale, with an offset so "none" isn't minus infinity. */
function kitZ(rate: number, ref: number): number {
  const offset = ref * 0.5
  return clamp(Math.log((rate + offset) / (ref + offset)) / KIT_LOG_SD, -KIT_Z_LIMIT, KIT_Z_LIMIT)
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

const SLOT_LETTER: Record<AbilitySlot, string> = { passive: 'passive', q: 'Q', w: 'W', e: 'E', r: 'R' }

const EMPTY: Omit<Prediction, 'hints' | 'rosterSource'> = {
  ready: false, winRate: BASE_WIN_RATE, band: 0, confidence: 'rough', contributions: [], slots: [], assumedBuild: true,
}

// The roster only changes when it is synced, so its profile is built once per roster, not per keystroke.
const profileCache = new WeakMap<ChampionCatalogEntry[], BodyProfile>()

function profileFor(roster: ChampionCatalogEntry[]): BodyProfile {
  let profile = profileCache.get(roster)
  if (!profile) {
    profile = buildBodyProfile(roster)
    profileCache.set(roster, profile)
  }
  return profile
}

export function predictWinRate({ champion, items, roster }: PredictionInput): Prediction {
  const profile = profileFor(roster)
  const base = champion.base_stats ?? {}
  const classes = champion.identity.class ?? []
  const hints: string[] = []

  const filled = coreStatsFilled(base)
  if (filled < CORE_STAT_COUNT - 2) {
    const missing = CORE_STAT_LABELS.filter(([k]) => !((base[k] as number | undefined) ?? 0)).map(([, l]) => l)
    if (!((base.attack_range?.[0] ?? 0) > 0)) missing.push('attack range')
    return { ...EMPTY, rosterSource: profile.source, hints: [`Fill in the base stats to see a projection. Still missing: ${missing.join(', ')}.`] }
  }

  // The build, compared at the same spend as a typical champion so a six-item build isn't rewarded for costing more.
  const offense = dominantOffense(champion, classes)
  const build = getActiveBuild(champion.builds ?? [], champion.active_build_id)
  const totals = build ? totalsForBuild(build.items, items) : null
  const hasBuild = !!totals && totals.itemCount > 0 && totals.goldSpent > 0
  const bonuses = hasBuild
    ? scaleBonuses(totals!.bonuses, clamp(REFERENCE_GOLD / totals!.goldSpent, 0.4, 3))
    : referenceBonuses(classes, offense)

  // The stats score is the champion's own body with typical items, the same footing the roster is
  // measured on. Real champions of one class differ by a few percent, while builds differ by far more,
  // so what the build changes is scored separately, more gently.
  const combatant = combatantAt(base, REFERENCE_LEVEL, bonuses)
  const reference = combatantAt(base, REFERENCE_LEVEL, referenceBonuses(classes, offense))
  const referenceIndex = bodyIndex(reference, offense)
  const statsZ = clamp(bodyZ(referenceIndex, classes, profile), -3, 3)
  const buildShift = hasBuild
    ? clamp((bodyIndex(combatant, offense) - referenceIndex) * BUILD_SHIFT_POINTS, -BUILD_SHIFT_LIMIT, BUILD_SHIFT_LIMIT)
    : 0

  // The kit. Keys with nothing priceable are assumed to be typical, so an unfinished kit isn't punished.
  const kit = evaluateKit(champion, combatant)
  const klass = classProfile(classes)
  const damageRef = DAMAGE_REF * klass.damage
  const utilityRef = UTILITY_REF * klass.utility
  const strain = kit.rotations === null ? 1 : 0.75 + 0.25 * Math.min(1, kit.rotations / 2)
  let damage = 0
  let utility = 0
  let sustain = 0
  for (const s of kit.slots) {
    if (s.scored) {
      damage += s.damage * strain
      utility += s.utility * strain
      sustain += s.sustain * strain
    } else {
      damage += SLOT_SHARE[s.slot] * damageRef
      utility += SLOT_SHARE[s.slot] * utilityRef
      sustain += SLOT_SHARE[s.slot] * SUSTAIN_REF
    }
  }
  const damageZ = kitZ(damage, damageRef)
  const utilityZ = kitZ(utility, utilityRef)
  const sustainZ = kitZ(sustain, SUSTAIN_REF)

  const efficiency = hasBuild ? goldValueOf(totals!.bonuses) / totals!.goldSpent : null
  const buildZ = efficiency === null ? 0 : clamp((efficiency - BUILD_EFFICIENCY_REF) / BUILD_EFFICIENCY_SD, -2, 2)

  const points = {
    stats: statsZ * POINTS.stats,
    damage: damageZ * POINTS.damage,
    utility: utilityZ * POINTS.utility + sustainZ * POINTS.sustain,
    build: buildZ * POINTS.build + buildShift,
  }
  const winRate = clamp(BASE_WIN_RATE + points.stats + points.damage + points.utility + points.build, MIN_WIN_RATE, MAX_WIN_RATE)

  // How sure to be: gaps in the stats, the kit and the build each widen the band.
  const abilityKeys = KIT_SLOTS.filter(k => k !== 'passive')
  const unscored = abilityKeys.filter(k => !kit.slots.find(s => s.slot === k)?.scored)
  const statsGap = 1 - filled / CORE_STAT_COUNT
  const kitGap = unscored.length / abilityKeys.length
  const band = round(clamp(1.5 + 2.5 * statsGap + 2.5 * kitGap + (hasBuild ? 0 : 0.8) + (profile.source === 'builtin' ? 0.3 : 0), 1.5, 7), 1)
  const confidence: Confidence = band <= 2.2 ? 'good' : band <= 3.8 ? 'fair' : 'rough'

  if (filled < CORE_STAT_COUNT) hints.push('Fill in every base stat to tighten the projection.')
  if (unscored.length > 0) {
    hints.push(`${unscored.map(k => SLOT_LETTER[k]).join(', ')} ${unscored.length === 1 ? 'has' : 'have'} no effect with numbers, so ${unscored.length === 1 ? 'it is' : 'they are'} counted as average. Add an effect with a base value or a ratio.`)
  }
  if (!hasBuild) {
    hints.push(items.length === 0 && (build?.items.length ?? 0) > 0
      ? 'Sync items on the Items panel to include your build. Typical items for the class are assumed.'
      : `No build yet, so typical items for ${classes[0] ? `a ${classes[0]}` : 'the class'} are assumed.`)
  }
  if (kit.rotations !== null && kit.rotations < 1.5) {
    hints.push(`The resource pool covers only ${round(kit.rotations, 1)} rotations of Q, W, E and R, which is holding the damage back.`)
  }
  if (profile.source === 'builtin') {
    hints.push('Sync champions from the lookup under Base stats to compare against the current roster instead of the built-in patch 16.19.1 numbers.')
  }

  const rounded = (v: number) => round(v, 1)
  const shredDamage = kit.slots.reduce((sum, s) => sum + s.shredDamage, 0)
  const teamShare = kit.slots.reduce((sum, s) => sum + s.teamShare, 0)
  const contributions: Contribution[] = [
    { key: 'stats', label: 'Stats', points: rounded(points.stats), note: describeZ(statsZ, `${classes[0] ?? 'champion'} bodies`) },
    { key: 'damage', label: 'Damage', points: rounded(points.damage), note: `${Math.round(damage)} per second of damage-equivalent${shredDamage >= 0.05 ? `, ${round(shredDamage, 1)} of it from shred and penetration` : ''}` },
    { key: 'utility', label: 'Control & sustain', points: rounded(points.utility), note: `${Math.round(utility + sustain)} per second${teamShare >= 0.05 ? `, ${round(teamShare, 1)} of it credit for teammates` : ''}` },
    { key: 'build', label: 'Build', points: rounded(points.build), note: hasBuild ? `${Math.round((efficiency ?? 0) * 100)}% gold efficiency` : 'typical items assumed' },
  ]

  return {
    ready: true,
    winRate: round(winRate, 1),
    band,
    confidence,
    contributions,
    slots: kit.slots,
    assumedBuild: !hasBuild,
    rosterSource: profile.source,
    hints,
  }
}

function describeZ(z: number, peers: string): string {
  if (z > 1.5) return `well above other ${peers}`
  if (z > 0.5) return `above other ${peers}`
  if (z >= -0.5) return `in line with other ${peers}`
  if (z >= -1.5) return `below other ${peers}`
  return `well below other ${peers}`
}
