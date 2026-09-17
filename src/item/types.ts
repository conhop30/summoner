// ─── Item Types ──────────────────────────────────────────────────────────────
// Mirrors the shape of Riot's Data Dragon item data, trimmed to the fields
// Summoner actually uses. `stats` keeps Data Dragon's raw stat-mod keys
// (e.g. FlatHPPoolMod, PercentAttackSpeedMod) so a future champion-stat
// integration can read them without another schema migration.

export interface ItemStatMods {
  [key: string]: number;
}

export interface Item {
  id: string;
  ddragon_version: string;
  name: string;
  description?: string;
  plaintext?: string;
  image_full?: string;
  image_url?: string;
  gold_base?: number;
  gold_total?: number;
  gold_sell?: number;
  purchasable: boolean;
  tags: string[];
  stats: ItemStatMods;
  maps: Record<string, boolean>;
  depth?: number;
  stacks?: number;
  synced_at: string;
}

export interface ItemSyncResult {
  version: string;
  count: number;
  synced_at: string;
}

export interface ItemSyncStatus {
  version: string | null;
  synced_at: string | null;
}
