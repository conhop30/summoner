// The small icons that go beside a kind of damage, a stat or a heal. Which icon a thing gets is
// decided here, as plain data, so the tooltip and anything else that shows one agree; how each is
// drawn is StatIcon's business.

export type StatIconKey =
  | 'ad' | 'ap' | 'armor' | 'mr' | 'lethality' | 'heal' | 'shield' | 'ms' | 'as'
  | 'health' | 'health_regen' | 'resource' | 'resource_regen' | 'crit' | 'range'

export const STAT_ICON_LABELS: Record<StatIconKey, string> = {
  ad: 'Attack damage',
  ap: 'Ability power',
  armor: 'Armor',
  mr: 'Magic resist',
  lethality: 'Lethality',
  heal: 'Healing',
  shield: 'Shielding',
  ms: 'Movement speed',
  as: 'Attack speed',
  health: 'Health',
  health_regen: 'Health regen',
  resource: 'Resource',
  resource_regen: 'Resource regen',
  crit: 'Critical strike',
  range: 'Attack range',
}

// A stat id, as an effect or a scaling names it (see ratios.ts), and the icon that stands for it.
const BY_STAT: Record<string, StatIconKey> = {
  ad: 'ad',
  ap: 'ap',
  armor: 'armor',
  armor_pen: 'armor',
  magic_resist: 'mr',
  magic_pen: 'mr',
  lethality: 'lethality',
  attack_speed: 'as',
  move_speed: 'ms',
  health: 'health',
  health_regen: 'health_regen',
  resource: 'resource',
  resource_regen: 'resource_regen',
  crit_chance: 'crit',
}

export function iconForStat(stat: string | undefined): StatIconKey | undefined {
  return stat ? BY_STAT[stat] : undefined
}

// A champion's base stats, by their field name, and the same icons: a stat looks the same in the
// stats panel, the View page and the tooltip.
const BY_BASE_STAT: Record<string, StatIconKey> = {
  health: 'health',
  health_regen: 'health_regen',
  resource: 'resource',
  resource_regen: 'resource_regen',
  attack_damage: 'ad',
  attack_speed: 'as',
  armor: 'armor',
  magic_resistance: 'mr',
  movement_speed: 'ms',
  crit_damage_multiplier: 'crit',
  attack_range: 'range',
}

export function iconForBaseStat(field: string): StatIconKey | undefined {
  return BY_BASE_STAT[field]
}
