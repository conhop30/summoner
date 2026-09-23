// ─── Champion Catalog Types ─────────────────────────────────────────────────
// Riot's reference champion roster, synced from Data Dragon — distinct from
// `champion/types.ts`'s `Champion`, which is the user's own designed champion.
// Used only to compute stat suggestions (class-tag averages, one-click presets).

export interface ChampionCatalogStats {
  hp?: number; hpperlevel?: number;
  mp?: number; mpperlevel?: number;
  movespeed?: number;
  armor?: number; armorperlevel?: number;
  spellblock?: number; spellblockperlevel?: number;
  attackrange?: number;
  hpregen?: number; hpregenperlevel?: number;
  mpregen?: number; mpregenperlevel?: number;
  crit?: number; critperlevel?: number;
  attackdamage?: number; attackdamageperlevel?: number;
  attackspeed?: number; attackspeedperlevel?: number;
  [key: string]: number | undefined;
}

export interface ChampionCatalogEntry {
  id: string; // Data Dragon id, e.g. "Aatrox"
  ddragon_version: string;
  key: string; // Data Dragon's numeric key
  name: string;
  title?: string;
  tags: string[]; // class tags, e.g. ["Fighter", "Tank"]
  partype?: string; // resource type label, e.g. "Mana", "Blood Well"
  stats: ChampionCatalogStats;
  image_full?: string;
  image_url?: string;
  synced_at: string;
}

export interface ChampionCatalogSyncResult {
  version: string;
  count: number;
  synced_at: string;
}

export interface ChampionCatalogSyncStatus {
  version: string | null;
  synced_at: string | null;
}
