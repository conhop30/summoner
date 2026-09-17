import type { Database } from 'better-sqlite3';
import type { Item, ItemSyncResult, ItemSyncStatus } from './types';
import type { DDragonItemRaw } from './ddragon';
import { fetchLatestVersion, fetchItems, itemImageUrl } from './ddragon';
import { nowISO } from '../champion/utils';

function serialize(item: DDragonItemRaw, version: string, syncedAt: string): Record<string, unknown> {
  return {
    id: item.id,
    ddragon_version: version,
    name: item.name,
    description: item.description ?? null,
    plaintext: item.plaintext ?? null,
    image_full: item.image_full ?? null,
    gold_base: item.gold_base ?? null,
    gold_total: item.gold_total ?? null,
    gold_sell: item.gold_sell ?? null,
    purchasable: item.purchasable ? 1 : 0,
    tags: JSON.stringify(item.tags),
    stats: JSON.stringify(item.stats),
    maps: JSON.stringify(item.maps),
    depth: item.depth ?? null,
    stacks: item.stacks ?? null,
    synced_at: syncedAt,
  };
}

function deserialize(row: Record<string, unknown>): Item {
  const version = row.ddragon_version as string;
  const imageFull = row.image_full as string | null;
  return {
    id: row.id as string,
    ddragon_version: version,
    name: row.name as string,
    description: (row.description as string | null) ?? undefined,
    plaintext: (row.plaintext as string | null) ?? undefined,
    image_full: imageFull ?? undefined,
    image_url: imageFull ? itemImageUrl(version, imageFull) : undefined,
    gold_base: (row.gold_base as number | null) ?? undefined,
    gold_total: (row.gold_total as number | null) ?? undefined,
    gold_sell: (row.gold_sell as number | null) ?? undefined,
    purchasable: row.purchasable === 1,
    tags: JSON.parse(row.tags as string),
    stats: JSON.parse(row.stats as string),
    maps: JSON.parse((row.maps as string) ?? '{}'),
    depth: (row.depth as number | null) ?? undefined,
    stacks: (row.stacks as number | null) ?? undefined,
    synced_at: row.synced_at as string,
  };
}

export async function syncItems(db: Database): Promise<ItemSyncResult> {
  const version = await fetchLatestVersion();
  const raw = await fetchItems(version);
  const syncedAt = nowISO();

  const upsert = db.prepare(`
    INSERT INTO items (id, ddragon_version, name, description, plaintext, image_full, gold_base, gold_total, gold_sell, purchasable, tags, stats, maps, depth, stacks, synced_at)
    VALUES (@id, @ddragon_version, @name, @description, @plaintext, @image_full, @gold_base, @gold_total, @gold_sell, @purchasable, @tags, @stats, @maps, @depth, @stacks, @synced_at)
    ON CONFLICT(id) DO UPDATE SET
      ddragon_version = excluded.ddragon_version,
      name            = excluded.name,
      description     = excluded.description,
      plaintext       = excluded.plaintext,
      image_full      = excluded.image_full,
      gold_base       = excluded.gold_base,
      gold_total      = excluded.gold_total,
      gold_sell       = excluded.gold_sell,
      purchasable     = excluded.purchasable,
      tags            = excluded.tags,
      stats           = excluded.stats,
      maps            = excluded.maps,
      depth           = excluded.depth,
      stacks          = excluded.stacks,
      synced_at       = excluded.synced_at
  `);

  const insertAll = db.transaction((items: DDragonItemRaw[]) => {
    for (const item of items) upsert.run(serialize(item, version, syncedAt));
  });
  insertAll(raw);

  const upsertMeta = db.prepare(`
    INSERT INTO schema_meta (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  upsertMeta.run({ key: 'ddragon_version', value: version });
  upsertMeta.run({ key: 'ddragon_synced_at', value: syncedAt });

  return { version, count: raw.length, synced_at: syncedAt };
}

export function getAllItems(db: Database): Item[] {
  const rows = db.prepare(`SELECT * FROM items ORDER BY name ASC`).all() as Record<string, unknown>[];
  return rows.map(deserialize);
}

export function getItem(db: Database, id: string): Item | null {
  const row = db.prepare(`SELECT * FROM items WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? deserialize(row) : null;
}

export function getSyncStatus(db: Database): ItemSyncStatus {
  const version = db.prepare(`SELECT value FROM schema_meta WHERE key = 'ddragon_version'`).get() as { value: string } | undefined;
  const syncedAt = db.prepare(`SELECT value FROM schema_meta WHERE key = 'ddragon_synced_at'`).get() as { value: string } | undefined;
  return { version: version?.value ?? null, synced_at: syncedAt?.value ?? null };
}
