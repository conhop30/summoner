import type { BuildEntry } from '../champion/types'
import type { Item } from '../item/types'
import { allStatsFor } from '../item/statParsing'

// What a build adds, in the units the predictor works in. Percentages are fractions (0.35 = 35%).
export interface ItemBonuses {
  health: number
  mana: number
  armor: number
  magicResist: number
  attackDamage: number
  abilityPower: number
  attackSpeed: number
  critChance: number
  abilityHaste: number
  moveSpeedFlat: number
  moveSpeedPercent: number
  lifeSteal: number
  omnivamp: number
}

export function emptyBonuses(): ItemBonuses {
  return {
    health: 0, mana: 0, armor: 0, magicResist: 0, attackDamage: 0, abilityPower: 0,
    attackSpeed: 0, critChance: 0, abilityHaste: 0, moveSpeedFlat: 0, moveSpeedPercent: 0,
    lifeSteal: 0, omnivamp: 0,
  }
}

// Gold per point of each stat, from the League wiki's gold-efficiency page (a community-derived
// proxy, not official Riot data): the price of the cheapest item that grants only that stat, so Long
// Sword's 350g for 10 AD is 35g each. Sources:
//   https://wiki.leagueoflegends.com/en-us/Gold_efficiency
//   https://wiki.leagueoflegends.com/en-us/Module:Gold_value/data
// Percentages are per 1.0 (100%), so attack speed's "25g per 1%" is 2500 here.
export const GOLD_PER: Record<keyof ItemBonuses, number> = {
  health: 2.6667,
  mana: 1,
  armor: 20,
  magicResist: 20,
  attackDamage: 35,
  abilityPower: 20,
  attackSpeed: 2500,
  critChance: 4000,
  abilityHaste: 50,
  moveSpeedFlat: 12,
  moveSpeedPercent: 6510.5,
  lifeSteal: 5355,
  omnivamp: 4600,
}

export function goldValueOf(bonuses: ItemBonuses): number {
  let total = 0
  for (const key of Object.keys(GOLD_PER) as (keyof ItemBonuses)[]) total += bonuses[key] * GOLD_PER[key]
  return total
}

export function scaleBonuses(bonuses: ItemBonuses, factor: number): ItemBonuses {
  const out = emptyBonuses()
  for (const key of Object.keys(out) as (keyof ItemBonuses)[]) out[key] = bonuses[key] * factor
  return out
}

export interface BuildTotals {
  bonuses: ItemBonuses
  /** Gold the resolved items cost. */
  goldSpent: number
  /** Build entries whose item was found in the synced catalog, counting stacks. */
  itemCount: number
}

/**
 * Everything a build grants, summed item by item. It reads each item on its own rather than going
 * through aggregateBuildStats, which keys totals by label and so folds an item's flat and percent
 * Move Speed together.
 */
export function totalsForBuild(build: BuildEntry[], catalog: Item[]): BuildTotals {
  const byId = new Map(catalog.map(i => [i.id, i]))
  const bonuses = emptyBonuses()
  let goldSpent = 0
  let itemCount = 0

  for (const entry of build) {
    const item = byId.get(entry.item_id)
    if (!item) continue
    itemCount += entry.count
    goldSpent += (item.gold_total ?? 0) * entry.count
    for (const stat of allStatsFor(item)) {
      const v = stat.value * entry.count
      switch (stat.label) {
        case 'Health': bonuses.health += v; break
        case 'Mana': bonuses.mana += v; break
        case 'Armor': bonuses.armor += v; break
        case 'Magic Resist': bonuses.magicResist += v; break
        case 'Attack Damage': bonuses.attackDamage += v; break
        case 'Ability Power': bonuses.abilityPower += v; break
        case 'Attack Speed': bonuses.attackSpeed += v; break
        case 'Critical Strike Chance': bonuses.critChance += v; break
        case 'Ability Haste': bonuses.abilityHaste += v; break
        case 'Life Steal': bonuses.lifeSteal += v; break
        case 'Omnivamp': bonuses.omnivamp += v; break
        case 'Move Speed':
          if (stat.isPercent) bonuses.moveSpeedPercent += v
          else bonuses.moveSpeedFlat += v
          break
      }
    }
  }
  return { bonuses, goldSpent, itemCount }
}
