import type { Item } from './types';
import type { StatIconKey } from '../champion/statIcons';

export const SUMMONERS_RIFT_MAP_ID = '11';

export type SortKey = 'cost' | 'name' | 'health' | 'armor' | 'magic_resist' | 'attack_damage' | 'ability_power' | 'attack_speed';
export type SortDir = 'asc' | 'desc';

// Stat sorts default to descending — items missing a given stat sort to 0
// for that key, so an ascending default would put every item that DOESN'T
// have the stat (e.g. Bami's Cinder under "Attack Speed") at the very top.
// Cost and Name are the exceptions: cheapest/A-first reads naturally.
// A stat's icon is the same one the rest of the app uses for it (statIcons.ts); Cost and Name are not stats and keep a plain mark.
export const SORT_OPTIONS: { key: SortKey; label: string; icon?: string; statIcon?: StatIconKey; defaultDir: SortDir }[] = [
  { key: 'cost',           label: 'Cost',           icon: '¤', defaultDir: 'asc' },
  { key: 'name',           label: 'Name',           icon: 'A', defaultDir: 'asc' },
  { key: 'health',         label: 'Health',         statIcon: 'health', defaultDir: 'desc' },
  { key: 'armor',          label: 'Armor',          statIcon: 'armor', defaultDir: 'desc' },
  { key: 'magic_resist',   label: 'Magic Resist',   statIcon: 'mr', defaultDir: 'desc' },
  { key: 'attack_damage',  label: 'Attack Damage',  statIcon: 'ad', defaultDir: 'desc' },
  { key: 'ability_power',  label: 'Ability Power',  statIcon: 'ap', defaultDir: 'desc' },
  { key: 'attack_speed',   label: 'Attack Speed',   statIcon: 'as', defaultDir: 'desc' },
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

export const STAT_SORT_KEYS = new Set<SortKey>([
  'health', 'armor', 'magic_resist', 'attack_damage', 'ability_power', 'attack_speed',
]);

// When sorting by a stat modifier, an item that doesn't have that stat at
// all isn't a meaningfully "sorted" result — it's noise. Cost/Name sorts
// aren't stat modifiers, so nothing gets excluded there.
export function hasStatFor(item: Item, key: SortKey): boolean {
  if (!STAT_SORT_KEYS.has(key)) return true;
  return (sortValue(item, key) as number) !== 0;
}

// Cost is always the dominant ordering — a selected stat modifier only
// breaks ties between items that cost the same (or close to it). Picking
// "Magic Resist" doesn't re-rank the whole catalog by MR; it nudges items
// of equal price so the ones with more of the stat come first among them.
export function compareItems(a: Item, b: Item, key: SortKey, dir: SortDir): number {
  if (STAT_SORT_KEYS.has(key)) {
    const costA = a.gold_total ?? 0;
    const costB = b.gold_total ?? 0;
    if (costA !== costB) return costA - costB;
    const av = sortValue(a, key) as number;
    const bv = sortValue(b, key) as number;
    const cmp = av - bv;
    return dir === 'asc' ? cmp : -cmp;
  }

  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  const cmp = av < bv ? -1 : av > bv ? 1 : 0;
  return dir === 'asc' ? cmp : -cmp;
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
  // Some ids Data Dragon reissues after an item rework (e.g. a rebalanced
  // Gargoyle Stoneplate) come back with no `depth` at all, which would
  // otherwise silently dump a 2500g item into "Basic". Cost is a reliable
  // enough stand-in for tier in that specific gap.
  if (item.depth == null) {
    const cost = item.gold_total ?? 0;
    if (cost >= 2000) return 'legendary';
    if (cost >= 800) return 'epic';
  }
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

