import type { Database } from 'better-sqlite3';
import type { ChampionCatalogEntry, ChampionCatalogSyncResult, ChampionCatalogSyncStatus } from './types';
import type { DDragonChampionRaw } from './ddragon';
import { fetchLatestVersion, fetchChampions, championImageUrl } from './ddragon';
import { nowISO } from '../champion/utils';

function serialize(c: DDragonChampionRaw, version: string, syncedAt: string): Record<string, unknown> {
  return {
    id: c.id,
    ddragon_version: version,
    key: c.key,
    name: c.name,
    title: c.title ?? null,
    tags: JSON.stringify(c.tags),
    partype: c.partype ?? null,
    stats: JSON.stringify(c.stats),
    image_full: c.image_full ?? null,
    synced_at: syncedAt,
  };
}

function deserialize(row: Record<string, unknown>): ChampionCatalogEntry {
  const version = row.ddragon_version as string;
  const imageFull = row.image_full as string | null;
  return {
    id: row.id as string,
    ddragon_version: version,
    key: row.key as string,
    name: row.name as string,
    title: (row.title as string | null) ?? undefined,
    tags: JSON.parse(row.tags as string),
    partype: (row.partype as string | null) ?? undefined,
    stats: JSON.parse(row.stats as string),
    image_full: imageFull ?? undefined,
    image_url: imageFull ? championImageUrl(version, imageFull) : undefined,
    synced_at: row.synced_at as string,
  };
}

export async function syncChampionCatalog(db: Database): Promise<ChampionCatalogSyncResult> {
  const version = await fetchLatestVersion();
  const raw = await fetchChampions(version);
  const syncedAt = nowISO();

  const upsert = db.prepare(`
    INSERT INTO ddragon_champions (id, ddragon_version, key, name, title, tags, partype, stats, image_full, synced_at)
    VALUES (@id, @ddragon_version, @key, @name, @title, @tags, @partype, @stats, @image_full, @synced_at)
    ON CONFLICT(id) DO UPDATE SET
      ddragon_version = excluded.ddragon_version,
      key             = excluded.key,
      name            = excluded.name,
      title           = excluded.title,
      tags            = excluded.tags,
      partype         = excluded.partype,
      stats           = excluded.stats,
      image_full      = excluded.image_full,
      synced_at       = excluded.synced_at
  `);

  const insertAll = db.transaction((champs: DDragonChampionRaw[]) => {
    for (const c of champs) upsert.run(serialize(c, version, syncedAt));
  });
  insertAll(raw);

  const upsertMeta = db.prepare(`
    INSERT INTO schema_meta (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  upsertMeta.run({ key: 'ddragon_champion_version', value: version });
  upsertMeta.run({ key: 'ddragon_champion_synced_at', value: syncedAt });

  return { version, count: raw.length, synced_at: syncedAt };
}

export function getAllChampionCatalog(db: Database): ChampionCatalogEntry[] {
  const rows = db.prepare(`SELECT * FROM ddragon_champions ORDER BY name ASC`).all() as Record<string, unknown>[];
  return rows.map(deserialize);
}

export function getChampionCatalogSyncStatus(db: Database): ChampionCatalogSyncStatus {
  const version = db.prepare(`SELECT value FROM schema_meta WHERE key = 'ddragon_champion_version'`).get() as { value: string } | undefined;
  const syncedAt = db.prepare(`SELECT value FROM schema_meta WHERE key = 'ddragon_champion_synced_at'`).get() as { value: string } | undefined;
  return { version: version?.value ?? null, synced_at: syncedAt?.value ?? null };
}
