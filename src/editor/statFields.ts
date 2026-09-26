import type { BaseStats } from '../champion/types'
import type { StatIconKey } from '../champion/statIcons'

export interface StatFieldDef {
  label: string
  icon: StatIconKey
  valueKey: keyof BaseStats
  growthKey?: keyof BaseStats
}

export const BASE_STATS: StatFieldDef[] = [
  { label: 'Health',         icon: 'health', valueKey: 'health',           growthKey: 'health_growth' },
  { label: 'Health Regen',   icon: 'health_regen', valueKey: 'health_regen',      growthKey: 'health_regen_growth' },
  { label: 'Resource',       icon: 'resource', valueKey: 'resource',          growthKey: 'resource_growth' },
  { label: 'Resource Regen', icon: 'resource_regen', valueKey: 'resource_regen',    growthKey: 'resource_regen_growth' },
  { label: 'Attack Damage',  icon: 'ad', valueKey: 'attack_damage',     growthKey: 'attack_damage_growth' },
  { label: 'Attack Speed',   icon: 'as', valueKey: 'attack_speed',      growthKey: 'attack_speed_growth' },
  { label: 'Armor',          icon: 'armor', valueKey: 'armor',             growthKey: 'armor_growth' },
  { label: 'Magic Resist',   icon: 'mr', valueKey: 'magic_resistance',  growthKey: 'magic_resistance_growth' },
  { label: 'Move Speed',     icon: 'ms', valueKey: 'movement_speed',    growthKey: 'movement_speed_growth' },
]

export const HIDDEN_STATS: StatFieldDef[] = [
  { label: 'Crit Multiplier', icon: 'crit', valueKey: 'crit_damage_multiplier' },
]
