// ─── Effect Types ────────────────────────────────────────────────────────────

export type EffectType =
  | 'damage'
  | 'heal'
  | 'shield'
  | 'slow'
  | 'stun'
  | 'knock_up'
  | 'knock_back'
  | 'charm'
  | 'fear'
  | 'silence'
  | 'speed_boost'
  | 'armor_modifier'
  | 'magic_resistance_modifier'
  | 'dash'
  | 'stat_change'
  | string; // escape hatch for custom types

export type DamageType = 'Physical' | 'Magic' | 'True';

// Which part of a stat a ratio scales with: what the champion has on its own, what items and
// effects add, or both together. See ratios.ts.
export type RatioPart = 'base' | 'bonus' | 'total';

export interface RatioEntry {
  // A stat id from ratios.ts ("ad", "armor"...), or free text from before the picker existed.
  stat: string;
  part?: RatioPart;
  // "Per N": each N of the stat adds `values` (in the effect's own unit), continuously, instead
  // of `values` being a fraction of the stat. Unset means a plain ratio.
  per?: number;
  // For a custom value the app can't know (stacks, enemies hit): what to assume when estimating.
  assumed?: number;
  values: number[];
}

// What a custom effect behaves like, and what its base number measures. Built-in types have both
// fixed; see effects.ts.
export type EffectFamily = 'damage' | 'hard_control' | 'soft_control' | 'sustain' | 'utility';
export type EffectUnit = 'seconds' | 'percent' | 'flat';

// A 'stat_change' effect raises or lowers one stat of someone: "-30% armor on the enemy for 4 s".
export type StatChangeDirection = 'raise' | 'lower';
export type StatChangeTarget = 'self' | 'ally' | 'enemy';

export interface Effect {
  type: EffectType;
  // What a description calls this effect: {Name}. Unset, it is the type's name ("Damage"); see
  // descriptionTokens.ts.
  name?: string;
  family?: EffectFamily;
  unit?: EffectUnit;
  damage_type?: DamageType;
  base?: number[];
  ratios?: RatioEntry[];
  duration?: number[];
  // Only a 'stat_change' effect has these. The amount is the effect's usual base and ratios, in
  // `unit` (flat, or percent). A change with none of them set reads as "raise armor, on self".
  stat?: string;
  direction?: StatChangeDirection;
  target?: StatChangeTarget;
  notes?: string;
}

// ─── Extra / Struct Library ──────────────────────────────────────────────────

export interface RecastStruct {
  max_recasts: number;
  recast_window: number;
  recast_static_cooldown?: number;
  recast_extends_on?: string;
}

export interface AbilityExtra {
  recast?: RecastStruct;
  [key: string]: unknown; // loose key-value pairs
}

// ─── Abilities ───────────────────────────────────────────────────────────────

export type AbilitySlot = 'passive' | 'q' | 'w' | 'e' | 'r';

// Shared by the primary ability and every appended block — a "block" is, structurally,
// just another one of these under the same key. See AbilityBlock below.
export interface AbilityBody {
  name?: string;
  description?: string;
  cooldown?: number[];
  cost?: number[];
  cost_type?: string;
  effects?: Effect[];
}

export interface Ability extends AbilityBody {
  max_rank: number;
  extra?: AbilityExtra;
  journal?: AbilityJournal;
  // Custom icon for this key (app-asset:// URL, same storage as splash art). Lives on
  // the slot rather than AbilityBody — blocks under a key share the key's icon.
  icon_path?: string;
  // "+"-appended modular blocks under this same key: extra passives, full alternate
  // ability bodies (stance/form swaps), or condition-unlocked recasts. Additive —
  // the fields above remain the slot's primary ability definition.
  blocks?: AbilityBlock[];
}

export type AbilityBlockKind = 'passive' | 'alternate_form' | 'recast';

export interface AbilityBlock extends AbilityBody {
  // Stable identity, so the phone app and the desktop can tell which block is which. Older
  // saved blocks have none; they are given one when the database opens.
  id?: string;
  kind: AbilityBlockKind;
  // Trigger/window for this block, when kind === 'recast'. Reuses the same struct as
  // AbilityExtra.recast (a lighter-weight "this ability recasts itself" flag) since
  // both describe the same recast-condition shape.
  recast?: RecastStruct;
}

export type Abilities = Record<AbilitySlot, Ability>;

// ─── Controlled Vocabularies ─────────────────────────────────────────────────

export type ChampionClass =
  | 'Assassin'
  | 'Fighter'
  | 'Mage'
  | 'Marksman'
  | 'Support'
  | 'Tank'
  | string;

export type ChampionRole =
  | 'Top'
  | 'Jungle'
  | 'Mid'
  | 'Bot'
  | 'Support'
  | string;

export type AttackType = 'Melee' | 'Ranged' | string;

export type ResourceType =
  | 'Mana'
  | 'Energy'
  | 'Fury'
  | 'Heat'
  | 'Grit'
  | 'Ferocity'
  | 'Bloodthirst'
  | 'Shield'
  | 'None'
  | string;

// ─── Identity ────────────────────────────────────────────────────────────────

export interface Identity {
  name: string;
  title?: string;
  lore?: string;
  class?: ChampionClass[];
  role?: ChampionRole[];
  attack_type?: AttackType[];
  resource_type?: ResourceType;
  playstyle?: string[];
  image_path?: string;
  image_position?: { x: number; y: number };
  // Optional "champion theme": an audio file copied into the app's data folder (same storage
  // idea as splash art) and referenced by an app-asset:// URL. Playing it replaces the
  // background music until it ends or is stopped.
  theme_audio?: { name: string; src: string };
}

// ─── Base Stats ──────────────────────────────────────────────────────────────

export interface BaseStats {
  health?: number;
  health_growth?: number;
  health_regen?: number;
  health_regen_growth?: number;
  resource?: number;
  resource_growth?: number;
  resource_regen?: number;
  resource_regen_growth?: number;
  attack_damage?: number;
  attack_damage_growth?: number;
  attack_speed?: number;
  attack_speed_growth?: number;
  attack_range: number[];
  armor?: number;
  armor_growth?: number;
  magic_resistance?: number;
  magic_resistance_growth?: number;
  movement_speed?: number;
  movement_speed_growth?: number;
  crit_damage_multiplier?: number;
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export interface Metadata {
  id: string;
  created_at: string;
  updated_at: string;
  // When identity, abilities or tags last changed (stats, builds and theme audio don't move it).
  // Decides which copy is newer when champions are imported. Absent on old records: use updated_at.
  concept_updated_at?: string;
  version: string;
  is_favorite: boolean;
  tags: string[];
}

// ─── Champion (Full Record) ───────────────────────────────────────────────────

export interface BuildEntry {
  item_id: string;
  count: number;
}

export interface NamedBuild {
  id: string;
  name: string;
  items: BuildEntry[];
}

export interface Champion {
  identity: Identity;
  base_stats: BaseStats;
  abilities: Abilities;
  metadata: Metadata;
  builds: NamedBuild[];
  active_build_id: string;
}

// ─── Journal ─────────────────────────────────────────────────────────────────

export interface JournalTab {
  id: string;
  name: string;
  content: string;
  created_at: string;
}

export interface AbilityJournal {
  tabs: JournalTab[];
}