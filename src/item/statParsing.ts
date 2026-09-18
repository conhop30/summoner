import type { Item } from './types';

// Data Dragon's structured `stats` object only covers a small, fixed set of
// fields (confirmed by scanning a full synced catalog: 12 distinct keys).
// Most other stats an item grants — Mana Regen, Ability Haste, Tenacity,
// Heal and Shield Power, Omnivamp, etc. — are never put in `stats` at all;
// they only exist as text inside the item's `description` HTML, in a
// consistently-formatted `<stats><attention>VALUE</attention> Label<br>...`
// block. To surface "every stat field possible from items" (not just the
// dozen Data Dragon happens to structure), both sources are parsed and
// merged below.

export interface ParsedStat {
  label: string;
  value: number;
  /** true if `value` is a fraction (0.15 == 15%) — matches Data Dragon's own convention for structured percent fields, and text-parsed percents are normalized to match. */
  isPercent: boolean;
}

const STRUCTURED_STAT_META: Record<string, { label: string; isPercent: boolean }> = {
  FlatHPPoolMod:           { label: 'Health',                  isPercent: false },
  FlatHPRegenMod:          { label: 'Health Regen',             isPercent: false },
  FlatMPPoolMod:           { label: 'Mana',                     isPercent: false },
  FlatArmorMod:            { label: 'Armor',                    isPercent: false },
  FlatSpellBlockMod:       { label: 'Magic Resist',              isPercent: false },
  FlatPhysicalDamageMod:   { label: 'Attack Damage',            isPercent: false },
  FlatMagicDamageMod:      { label: 'Ability Power',            isPercent: false },
  FlatMovementSpeedMod:    { label: 'Move Speed',               isPercent: false },
  PercentMovementSpeedMod: { label: 'Move Speed',               isPercent: true },
  PercentAttackSpeedMod:   { label: 'Attack Speed',             isPercent: true },
  FlatCritChanceMod:       { label: 'Critical Strike Chance',   isPercent: true },
  PercentLifeStealMod:     { label: 'Life Steal',                isPercent: true },
};

export function structuredStatsFor(item: Item): ParsedStat[] {
  const out: ParsedStat[] = [];
  for (const [key, value] of Object.entries(item.stats)) {
    const meta = STRUCTURED_STAT_META[key];
    if (!meta || !value) continue;
    out.push({ label: meta.label, value, isPercent: meta.isPercent });
  }
  return out;
}

const STATS_BLOCK_RE = /<stats>([\s\S]*?)<\/stats>/;
const ATTENTION_LINE_RE = /<attention>([\d.]+)(%?)<\/attention>\s*([^<]+)/g;

export function descriptionStatsFor(item: Item): ParsedStat[] {
  const block = STATS_BLOCK_RE.exec(item.description ?? '')?.[1];
  if (!block) return [];

  const out: ParsedStat[] = [];
  for (const m of block.matchAll(ATTENTION_LINE_RE)) {
    const raw = parseFloat(m[1]);
    if (Number.isNaN(raw)) continue;
    const isPercent = m[2] === '%';
    const label = m[3].replace(/^Base\s+/, '').trim().replace(/\s+/g, ' ');
    if (!label) continue;
    out.push({ label, value: isPercent ? raw / 100 : raw, isPercent });
  }
  return out;
}

/** Every stat an item grants, from whichever source has it — structured
 *  `stats` preferred (machine-accurate), description text filling every
 *  gap structured data doesn't cover. */
export function allStatsFor(item: Item): ParsedStat[] {
  const structured = structuredStatsFor(item);
  const seen = new Set(structured.map(s => s.label));
  const fromText = descriptionStatsFor(item).filter(s => !seen.has(s.label));
  return [...structured, ...fromText];
}

/** Champion base-stat field a given (already-normalized) label corresponds
 *  to, where one obviously exists. Everything else (Ability Haste, Tenacity,
 *  Heal and Shield Power, Omnivamp, ...) has no champion-side equivalent in
 *  this app's data model, so it's shown as a bonus with no base to compare. */
export const CHAMP_KEY_BY_LABEL: Record<string, string> = {
  'Health':          'health',
  'Health Regen':    'health_regen',
  'Mana':            'resource',
  'Mana Regen':      'resource_regen',
  'Armor':           'armor',
  'Magic Resist':    'magic_resistance',
  'Attack Damage':   'attack_damage',
  'Attack Speed':    'attack_speed',
  'Move Speed':      'movement_speed',
};

// A rough "most people care about these first" ordering for the stat
// comparison table; anything not listed here (Ability Haste, Tenacity, a
// future item's brand-new stat, ...) sorts alphabetically after it.
export const PREFERRED_STAT_ORDER = [
  'Health', 'Health Regen', 'Mana', 'Mana Regen', 'Armor', 'Magic Resist',
  'Attack Damage', 'Attack Speed', 'Critical Strike Chance', 'Ability Power',
  'Ability Haste', 'Move Speed', 'Life Steal', 'Omnivamp', 'Heal and Shield Power', 'Tenacity',
];

export function compareStatLabels(a: string, b: string): number {
  const ia = PREFERRED_STAT_ORDER.indexOf(a);
  const ib = PREFERRED_STAT_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}
