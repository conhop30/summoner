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
  | string; // escape hatch for custom types

export type DamageType = 'Physical' | 'Magic' | 'True';

export interface RatioEntry {
  stat: string;
  values: number[];
}

export interface Effect {
  type: EffectType;
  damage_type?: DamageType;
  base?: number[];
  ratios?: RatioEntry[];
  duration?: number[];
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

export interface Ability {
  name?: string;
  description?: string;
  cooldown?: number[];
  cost?: number[];
  cost_type?: string;
  max_rank: number;
  effects?: Effect[];
  extra?: AbilityExtra;
  journal?: AbilityJournal;
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
  image_path?: string;
  image_position?: { x: number; y: number };
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