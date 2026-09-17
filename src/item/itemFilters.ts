import type { BaseStats } from '../champion/types';
import type { Item } from './types';

export const SUMMONERS_RIFT_MAP_ID = '11';

export type SortKey = 'cost' | 'name' | 'health' | 'armor' | 'magic_resist' | 'attack_damage' | 'ability_power' | 'attack_speed';
export type SortDir = 'asc' | 'desc';

// Stat sorts default to descending — items missing a given stat sort to 0
// for that key, so an ascending default would put every item that DOESN'T
// have the stat (e.g. Bami's Cinder under "Attack Speed") at the very top.
// Cost and Name are the exceptions: cheapest/A-first reads naturally.
export const SORT_OPTIONS: { key: SortKey; label: string; icon: string; defaultDir: SortDir }[] = [
  { key: 'cost',           label: 'Cost',           icon: '¤', defaultDir: 'asc' },
  { key: 'name',           label: 'Name',           icon: 'A', defaultDir: 'asc' },
  { key: 'health',         label: 'Health',         icon: '♥', defaultDir: 'desc' },
  { key: 'armor',          label: 'Armor',          icon: '🛡', defaultDir: 'desc' },
  { key: 'magic_resist',   label: 'Magic Resist',   icon: '✦', defaultDir: 'desc' },
  { key: 'attack_damage',  label: 'Attack Damage',  icon: '⚔', defaultDir: 'desc' },
  { key: 'ability_power',  label: 'Ability Power',  icon: '◈', defaultDir: 'desc' },
  { key: 'attack_speed',   label: 'Attack Speed',   icon: '⚡', defaultDir: 'desc' },
];

export function sortValue(item: Item, key: SortKey): number | string {
  switch (key) {
    case 'cost':          return item.gold_total ?? 0;
    case 'name':          return item.name.toLowerCase();
    case 'health':        return item.stats.FlatHPPoolMod ?? 0;
    case 'armor':         return item.stats.FlatArmorMod ?? 0;
    case 'magic_resist':  return item.stats.FlatSpellBlockMod ?? 0;
    case 'attack_damage': return item.stats.FlatPhysicalDamageMod ?? 0;
    case 'ability_power': return item.stats.FlatMagicDamageMod ?? 0;
    case 'attack_speed':  return item.stats.PercentAttackSpeedMod ?? 0;
  }
}

export type Category = 'all' | 'basic' | 'epic' | 'legendary' | 'boots' | 'consumables' | 'trinkets';

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all',          label: 'All Items' },
  { key: 'basic',        label: 'Basic' },
  { key: 'epic',         label: 'Epic' },
  { key: 'legendary',    label: 'Legendary' },
  { key: 'boots',        label: 'Boots' },
  { key: 'consumables',  label: 'Consumables' },
  { key: 'trinkets',     label: 'Trinkets' },
];

export function categoryOf(item: Item): Category {
  if (item.tags.includes('Trinket')) return 'trinkets';
  if (item.tags.includes('Consumable')) return 'consumables';
  if (item.tags.includes('Boots')) return 'boots';
  if (item.depth === 3) return 'legendary';
  if (item.depth === 2) return 'epic';
  return 'basic';
}

// Riot's item.json double-lists most Arena-tier reworks of an item under the
// same name, and still flags several of them "maps.11": true even though
// they're not the Summoner's Rift version. There's no explicit flag to
// distinguish them, but empirically the real SR item is always the one with
// the lowest numeric id (the Arena variants live at a shifted id range).
export function dedupeByName(list: Item[]): Item[] {
  const byName = new Map<string, Item>();
  for (const item of list) {
    const existing = byName.get(item.name);
    if (!existing || Number(item.id) < Number(existing.id)) byName.set(item.name, item);
  }
  return [...byName.values()];
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export interface BuildStatDef {
  key: string;
  label: string;
  ddragonKey: string;
  champKey?: keyof BaseStats;
  isPercent?: boolean;
}

export const BUILD_STATS: BuildStatDef[] = [
  { key: 'health',         label: 'Health',        ddragonKey: 'FlatHPPoolMod',         champKey: 'health' },
  { key: 'armor',          label: 'Armor',         ddragonKey: 'FlatArmorMod',          champKey: 'armor' },
  { key: 'magic_resist',   label: 'Magic Resist',  ddragonKey: 'FlatSpellBlockMod',     champKey: 'magic_resistance' },
  { key: 'attack_damage',  label: 'Attack Damage', ddragonKey: 'FlatPhysicalDamageMod', champKey: 'attack_damage' },
  { key: 'ability_power',  label: 'Ability Power',  ddragonKey: 'FlatMagicDamageMod' },
  { key: 'attack_speed',   label: 'Attack Speed',  ddragonKey: 'PercentAttackSpeedMod', champKey: 'attack_speed', isPercent: true },
];
