import type { BaseStats } from '../champion/types'
import { statAtLevel } from '../champion/statSpec'
import type { ItemBonuses } from './gold'

// The predictor judges a champion at one moment: a mid-game snapshot, level 13 with about
// 7,500 gold of items. A win rate is an average over whole games, and this is roughly where the
// average game's fights are decided.
export const REFERENCE_LEVEL = 13
export const REFERENCE_GOLD = 7500

const DEFAULT_CRIT_MULTIPLIER = 1.75

/** What a champion can do at the reference moment. */
export interface Combatant {
  health: number
  /** Health and attack damage before items, for the ratios that scale off "bonus" amounts. */
  baseHealth: number
  baseAttackDamage: number
  armor: number
  magicResist: number
  attackDamage: number
  attackSpeed: number
  attackRange: number
  moveSpeed: number
  abilityPower: number
  critChance: number
  critMultiplier: number
  abilityHaste: number
  /** Resource pool, and its regeneration per 5 seconds. */
  resource: number
  resourceRegen: number
}

function num(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

/** A stat at the level, from the base value and its growth (0 when either is missing). */
function at(base: Partial<BaseStats>, valueKey: keyof BaseStats, growthKey: keyof BaseStats, level: number): number {
  return statAtLevel(valueKey, num(base[valueKey] as number | undefined), num(base[growthKey] as number | undefined), level)
}

export function combatantAt(base: Partial<BaseStats>, level: number, bonus: ItemBonuses): Combatant {
  const attackSpeed = at(base, 'attack_speed', 'attack_speed_growth', level)
  const baseHealth = at(base, 'health', 'health_growth', level)
  const baseAttackDamage = at(base, 'attack_damage', 'attack_damage_growth', level)
  return {
    health: baseHealth + bonus.health,
    baseHealth,
    baseAttackDamage,
    armor: at(base, 'armor', 'armor_growth', level) + bonus.armor,
    magicResist: at(base, 'magic_resistance', 'magic_resistance_growth', level) + bonus.magicResist,
    attackDamage: baseAttackDamage + bonus.attackDamage,
    attackSpeed: attackSpeed * (1 + bonus.attackSpeed),
    attackRange: num(base.attack_range?.[0]),
    moveSpeed: (num(base.movement_speed) + bonus.moveSpeedFlat) * (1 + bonus.moveSpeedPercent),
    abilityPower: bonus.abilityPower,
    critChance: Math.min(1, bonus.critChance),
    critMultiplier: num(base.crit_damage_multiplier) || DEFAULT_CRIT_MULTIPLIER,
    abilityHaste: bonus.abilityHaste,
    resource: at(base, 'resource', 'resource_growth', level) + bonus.mana,
    resourceRegen: at(base, 'resource_regen', 'resource_regen_growth', level),
  }
}

/** How many of the seven stats that define a champion's body are filled in (0 to 7). */
export function coreStatsFilled(base: Partial<BaseStats>): number {
  const keys: (keyof BaseStats)[] = ['health', 'armor', 'magic_resistance', 'attack_damage', 'attack_speed', 'movement_speed']
  return keys.filter(k => num(base[k] as number | undefined) > 0).length + (num(base.attack_range?.[0]) > 0 ? 1 : 0)
}
export const CORE_STAT_COUNT = 7

/** Which damage stat a champion's kit leans on. */
export type OffenseStat = 'ap' | 'ad'

// How much each part of the body counts. A champion whose damage comes from abilities gets little
// from auto-attack stats, so they count for much less there.
const BODY_WEIGHTS: Record<OffenseStat, { durability: number; autos: number; speed: number; reach: number }> = {
  ad: { durability: 0.5, autos: 0.3, speed: 0.1, reach: 0.1 },
  ap: { durability: 0.7, autos: 0.05, speed: 0.15, reach: 0.1 },
}

/**
 * One number for how sturdy and how hard-hitting a body is before abilities: durability against
 * both damage types, auto-attack damage per second (crits included), reach and speed, combined
 * as a weighted geometric mean so no single stat runs away with it.
 */
export function bodyIndex(c: Combatant, offense: OffenseStat): number {
  const w = BODY_WEIGHTS[offense]
  const durability = (c.health * (1 + c.armor / 100) + c.health * (1 + c.magicResist / 100)) / 2
  const critFactor = 1 + c.critChance * (c.critMultiplier - 1)
  const autoDps = c.attackDamage * Math.min(c.attackSpeed, 2.5) * critFactor
  const reach = 1 + Math.max(0, c.attackRange - 175) / 1000
  return (
    w.durability * Math.log(Math.max(durability, 1)) +
    w.autos * Math.log(Math.max(autoDps, 1)) +
    w.speed * Math.log(Math.max(c.moveSpeed, 1)) +
    w.reach * Math.log(reach)
  )
}
