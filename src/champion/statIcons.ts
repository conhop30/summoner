// The small icons that go beside a kind of damage, a stat or a heal. Which icon a thing gets is
// decided here, as plain data, so the tooltip and anything else that shows one agree; how each is
// drawn is StatIcon's business.

export type StatIconKey = 'ad' | 'ap' | 'armor' | 'mr' | 'lethality' | 'heal' | 'shield' | 'ms' | 'as'

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
}

export function iconForStat(stat: string | undefined): StatIconKey | undefined {
  return stat ? BY_STAT[stat] : undefined
}
