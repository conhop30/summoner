import type { BaseStats } from '../champion/types';
import type { ChampionCatalogEntry, ChampionCatalogStats } from './types';

// Data Dragon's per-champion `stats` object uses its own key names; map the
// ones that line up with our BaseStats fields. attack_range is DDragon's
// single `attackrange` number wrapped in an array to match our tuple shape.
// crit_damage_multiplier and *_regen aren't in DDragon's summary stats, so
// they're left out — never suggested, never overwritten.
export function mapDDragonStats(stats: ChampionCatalogStats): Partial<BaseStats> {
  const mapped: Partial<BaseStats> = {};
  if (stats.hp !== undefined) mapped.health = stats.hp;
  if (stats.hpperlevel !== undefined) mapped.health_growth = stats.hpperlevel;
  if (stats.hpregen !== undefined) mapped.health_regen = stats.hpregen;
  if (stats.hpregenperlevel !== undefined) mapped.health_regen_growth = stats.hpregenperlevel;
  if (stats.mp !== undefined) mapped.resource = stats.mp;
  if (stats.mpperlevel !== undefined) mapped.resource_growth = stats.mpperlevel;
  if (stats.mpregen !== undefined) mapped.resource_regen = stats.mpregen;
  if (stats.mpregenperlevel !== undefined) mapped.resource_regen_growth = stats.mpregenperlevel;
  if (stats.attackdamage !== undefined) mapped.attack_damage = stats.attackdamage;
  if (stats.attackdamageperlevel !== undefined) mapped.attack_damage_growth = stats.attackdamageperlevel;
  if (stats.attackspeed !== undefined) mapped.attack_speed = stats.attackspeed;
  if (stats.attackspeedperlevel !== undefined) mapped.attack_speed_growth = stats.attackspeedperlevel;
  if (stats.armor !== undefined) mapped.armor = stats.armor;
  if (stats.armorperlevel !== undefined) mapped.armor_growth = stats.armorperlevel;
  if (stats.spellblock !== undefined) mapped.magic_resistance = stats.spellblock;
  if (stats.spellblockperlevel !== undefined) mapped.magic_resistance_growth = stats.spellblockperlevel;
  if (stats.movespeed !== undefined) mapped.movement_speed = stats.movespeed;
  if (stats.attackrange !== undefined) mapped.attack_range = [stats.attackrange];
  return mapped;
}

const AVERAGED_KEYS: (keyof BaseStats)[] = [
  'health', 'health_growth', 'health_regen', 'health_regen_growth',
  'resource', 'resource_growth', 'resource_regen', 'resource_regen_growth',
  'attack_damage', 'attack_damage_growth', 'attack_speed', 'attack_speed_growth',
  'armor', 'armor_growth', 'magic_resistance', 'magic_resistance_growth',
  'movement_speed',
];

// Averages are shown as whole numbers. The exceptions are stats whose real values are all
// tiny (attack speed ~0.65, per-level regen ~0.6), where rounding to a whole number would
// change them by 50%+ or more.
const AVERAGE_DECIMALS: Partial<Record<keyof BaseStats, number>> = {
  attack_speed: 2,
  health_regen_growth: 1,
  resource_regen_growth: 1,
};

function roundAverage(key: keyof BaseStats, n: number): number {
  const factor = 10 ** (AVERAGE_DECIMALS[key] ?? 0);
  return Math.round(n * factor) / factor;
}

export interface ClassStatSuggestion {
  tag: string;
  sampleSize: number;
  stats: Partial<BaseStats>;
}

// Averages every synced champion's mapped stats, grouped by class tag — a
// champion with multiple tags (e.g. Fighter/Tank) contributes to each.
export function computeClassAverages(catalog: ChampionCatalogEntry[]): ClassStatSuggestion[] {
  const byTag = new Map<string, Partial<BaseStats>[]>();
  for (const entry of catalog) {
    const mapped = mapDDragonStats(entry.stats);
    for (const tag of entry.tags) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(mapped);
    }
  }

  const results: ClassStatSuggestion[] = [];
  for (const [tag, samples] of byTag) {
    const stats: Partial<BaseStats> = {};
    for (const key of AVERAGED_KEYS) {
      const values = samples.map(s => s[key]).filter((v): v is number => typeof v === 'number');
      if (values.length === 0) continue;
      (stats as any)[key] = roundAverage(key, values.reduce((a, b) => a + b, 0) / values.length);
    }
    results.push({ tag, sampleSize: samples.length, stats });
  }
  return results.sort((a, b) => a.tag.localeCompare(b.tag));
}

export interface ChampionPresetSuggestion {
  championId: string;
  championName: string;
  stats: Partial<BaseStats>;
}

export interface ClassPresetGroup {
  tag: string;
  champions: ChampionPresetSuggestion[];
}

// One-click "use this champion's stats" presets: every synced champion, grouped under each of
// its class tags (a Fighter/Tank appears in both), so one class can offer a real range of
// styles — e.g. Tank spans Braum, Leona and Thresh, whose stats differ a lot.
export function getPresetsByClass(catalog: ChampionCatalogEntry[]): ClassPresetGroup[] {
  const byTag = new Map<string, ChampionPresetSuggestion[]>();
  for (const entry of catalog) {
    const preset: ChampionPresetSuggestion = {
      championId: entry.id,
      championName: entry.name,
      stats: mapDDragonStats(entry.stats),
    };
    for (const tag of entry.tags) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(preset);
    }
  }
  return [...byTag.entries()]
    .map(([tag, champions]) => ({
      tag,
      champions: champions.sort((a, b) => a.championName.localeCompare(b.championName)),
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}
