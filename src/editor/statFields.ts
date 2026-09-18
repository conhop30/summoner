import type { BaseStats } from '../champion/types'

export interface StatFieldDef {
  label: string
  icon: string
  valueKey: keyof BaseStats
  growthKey?: keyof BaseStats
}

export const BASE_STATS: StatFieldDef[] = [
  { label: 'Health',         icon: '♥', valueKey: 'health',           growthKey: 'health_growth' },
  { label: 'Health Regen',   icon: '✚', valueKey: 'health_regen',      growthKey: 'health_regen_growth' },
  { label: 'Resource',       icon: '◈', valueKey: 'resource',          growthKey: 'resource_growth' },
  { label: 'Resource Regen', icon: '◇', valueKey: 'resource_regen',    growthKey: 'resource_regen_growth' },
  { label: 'Attack Damage',  icon: '⚔', valueKey: 'attack_damage',     growthKey: 'attack_damage_growth' },
  { label: 'Attack Speed',   icon: '⚡', valueKey: 'attack_speed',      growthKey: 'attack_speed_growth' },
  { label: 'Armor',          icon: '🛡', valueKey: 'armor',             growthKey: 'armor_growth' },
  { label: 'Magic Resist',   icon: '✦', valueKey: 'magic_resistance',  growthKey: 'magic_resistance_growth' },
  { label: 'Move Speed',     icon: '➢', valueKey: 'movement_speed',    growthKey: 'movement_speed_growth' },
]

export const HIDDEN_STATS: StatFieldDef[] = [
  { label: 'Crit Multiplier', icon: '◆', valueKey: 'crit_damage_multiplier' },
]
