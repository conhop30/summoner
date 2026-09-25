import type { Champion } from '../champion/types'
import { resolveRatio } from '../champion/ratios'
import { emptyBonuses, GOLD_PER, type ItemBonuses } from './gold'
import { REFERENCE_GOLD, type OffenseStat } from './combatant'

// How a typical champion of each class spends its gold, and how big a kit it is expected to have.
// These are hand-tuned assumptions, not fitted to data: Data Dragon publishes no ability numbers
// or win rates to fit them against.
interface ClassProfile {
  /** Share of gold spent on damage stats; the rest goes to health and resistances. */
  offense: number
  /** Split of the offense gold for an AD build. Crit takes the remainder. */
  adShare: number
  asShare: number
  /** Builds AP rather than AD unless the kit says otherwise. */
  ap: boolean
  /** How much damage and how much utility this class's kit is expected to bring, against 1.0. */
  damage: number
  utility: number
}

const CLASS_PROFILES: Record<string, ClassProfile> = {
  Assassin: { offense: 0.6, adShare: 1, asShare: 0, ap: false, damage: 1.1, utility: 0.9 },
  Fighter: { offense: 0.5, adShare: 0.6, asShare: 0.4, ap: false, damage: 0.85, utility: 1 },
  Mage: { offense: 0.65, adShare: 1, asShare: 0, ap: true, damage: 1.05, utility: 1 },
  Marksman: { offense: 0.75, adShare: 0.4, asShare: 0.35, ap: false, damage: 0.8, utility: 0.6 },
  Support: { offense: 0.3, adShare: 1, asShare: 0, ap: true, damage: 0.6, utility: 1.5 },
  Tank: { offense: 0.2, adShare: 0.7, asShare: 0.3, ap: false, damage: 0.55, utility: 1.5 },
}

const NEUTRAL: ClassProfile = { offense: 0.5, adShare: 0.6, asShare: 0.4, ap: false, damage: 1, utility: 1 }

/** The profile for a champion's classes: a champion with two classes takes the average. */
export function classProfile(classes: string[]): ClassProfile {
  const known = classes.map(c => CLASS_PROFILES[c]).filter((p): p is ClassProfile => !!p)
  if (known.length === 0) return NEUTRAL
  const mean = (pick: (p: ClassProfile) => number) => known.reduce((s, p) => s + pick(p), 0) / known.length
  return {
    offense: mean(p => p.offense),
    adShare: mean(p => p.adShare),
    asShare: mean(p => p.asShare),
    ap: known.filter(p => p.ap).length * 2 >= known.length && known.some(p => p.ap),
    damage: mean(p => p.damage),
    utility: mean(p => p.utility),
  }
}

/** Items are worth a little less than their stats alone: passives and actives take part of the price. */
const ITEM_EFFICIENCY = 0.85

/**
 * The items a typical champion of these classes would have at the reference moment: the gold
 * split between damage and defence the way the class does it, bought as plain stats.
 */
export function referenceBonuses(classes: string[], offense: OffenseStat, gold = REFERENCE_GOLD): ItemBonuses {
  const profile = classProfile(classes)
  const spend = gold * ITEM_EFFICIENCY
  const offenseGold = spend * profile.offense
  const defenceGold = spend - offenseGold
  const b = emptyBonuses()

  if (offense === 'ap') {
    b.abilityPower = offenseGold / GOLD_PER.abilityPower
  } else {
    b.attackDamage = (offenseGold * profile.adShare) / GOLD_PER.attackDamage
    b.attackSpeed = (offenseGold * profile.asShare) / GOLD_PER.attackSpeed
    const critGold = offenseGold * Math.max(0, 1 - profile.adShare - profile.asShare)
    b.critChance = critGold / GOLD_PER.critChance
  }
  b.health = (defenceGold * 0.5) / GOLD_PER.health
  b.armor = (defenceGold * 0.25) / GOLD_PER.armor
  b.magicResist = (defenceGold * 0.25) / GOLD_PER.magicResist
  return b
}

/** Which damage stat this champion's kit leans on, falling back to what its class usually builds. */
export function dominantOffense(champion: Champion, classes: string[]): OffenseStat {
  let ap = 0
  let ad = 0
  const slots = Object.values(champion.abilities ?? {})
  for (const ability of slots) {
    const bodies = [ability, ...(ability?.blocks ?? [])]
    for (const body of bodies) {
      for (const effect of body?.effects ?? []) {
        for (const ratio of effect.ratios ?? []) {
          const size = Math.max(0, ...(ratio.values ?? []).map(v => Math.abs(v)))
          const stat = resolveRatio(ratio)?.stat
          if (stat === 'ap') ap += size
          else if (stat === 'ad') ad += size
        }
      }
    }
  }
  if (ap === 0 && ad === 0) return classProfile(classes).ap ? 'ap' : 'ad'
  return ap > ad ? 'ap' : 'ad'
}
