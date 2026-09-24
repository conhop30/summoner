import type { Database } from 'better-sqlite3';
import type { Champion, Identity, BaseStats, Abilities, BuildEntry, NamedBuild } from './types';
import { generateId, nowISO, defaultAbilities, defaultBaseStats } from './utils';
import { defaultBuilds } from '../item/buildLogic';
import { SCHEMA_VERSION } from '../db/schema';
import { conceptSnapshot } from './exchange';

// Older saved data stored builds as a flat build_items: BuildEntry[] (or,
// earlier still, a plain string[] of item ids). Coerce any of those shapes
// into the current { item_id, count } shape.
function coerceBuildItems(raw: unknown): BuildEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(entry =>
    typeof entry === 'string' ? { item_id: entry, count: 1 } : entry as BuildEntry
  );
}

// Migrates whatever shape `builds`/`build_items` were saved in into the
// current NamedBuild[] shape, always returning at least one build.
function coerceBuilds(rawBuilds: unknown, legacyBuildItems: unknown): NamedBuild[] {
  if (Array.isArray(rawBuilds) && rawBuilds.length > 0) {
    return rawBuilds.map((b: any) => ({
      id: typeof b?.id === 'string' ? b.id : generateId(),
      name: typeof b?.name === 'string' ? b.name : 'Build 1',
      items: coerceBuildItems(b?.items),
    }));
  }
  const legacyItems = coerceBuildItems(legacyBuildItems);
  if (legacyItems.length > 0) {
    return [{ id: generateId(), name: 'Build 1', items: legacyItems }];
  }
  return defaultBuilds();
}

function resolveActiveBuildId(builds: NamedBuild[], rawActiveId: unknown): string {
  if (typeof rawActiveId === 'string' && builds.some(b => b.id === rawActiveId)) return rawActiveId;
  return builds[0].id;
}

// ─── Serialization ───────────────────────────────────────────────────────────

function serialize(champion: Champion): Record<string, unknown> {
  return {
    id: champion.metadata.id,
    version: champion.metadata.version,
    created_at: champion.metadata.created_at,
    updated_at: champion.metadata.updated_at,
    concept_updated_at: champion.metadata.concept_updated_at ?? champion.metadata.updated_at,
    is_favorite: champion.metadata.is_favorite ? 1 : 0,
    tags: JSON.stringify(champion.metadata.tags),
    identity: JSON.stringify(champion.identity),
    base_stats: JSON.stringify(champion.base_stats),
    abilities: JSON.stringify(champion.abilities),
    builds: JSON.stringify(champion.builds),
    active_build_id: champion.active_build_id,
  };
}

function deserialize(row: Record<string, unknown>): Champion {
  const builds = coerceBuilds(
    JSON.parse((row.builds as string) ?? '[]'),
    JSON.parse((row.build_items as string) ?? '[]')
  );
  return {
    identity: JSON.parse(row.identity as string),
    base_stats: JSON.parse(row.base_stats as string),
    abilities: JSON.parse(row.abilities as string),
    builds,
    active_build_id: resolveActiveBuildId(builds, row.active_build_id),
    metadata: {
      id: row.id as string,
      version: row.version as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      concept_updated_at: (row.concept_updated_at as string | null) ?? (row.updated_at as string),
      is_favorite: row.is_favorite === 1,
      tags: JSON.parse(row.tags as string),
    },
  };
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

export function createChampion(
  db: Database,
  name: string,
  partial?: {
    identity?: Partial<Omit<Identity, 'name'>>;
    base_stats?: Partial<BaseStats>;
    abilities?: Partial<Abilities>;
    builds?: NamedBuild[];
    active_build_id?: string;
  }
): Champion {
  const now = nowISO();
  const builds = partial?.builds?.length ? partial.builds : defaultBuilds();

  const champion: Champion = {
    identity: {
      name,
      ...partial?.identity,
    },
    base_stats: {
      ...defaultBaseStats(),
      ...partial?.base_stats,
    },
    abilities: {
      ...defaultAbilities(),
      ...partial?.abilities,
    } as Abilities,
    builds,
    active_build_id: resolveActiveBuildId(builds, partial?.active_build_id),
    metadata: {
      id: generateId(),
      created_at: now,
      updated_at: now,
      concept_updated_at: now,
      version: SCHEMA_VERSION,
      is_favorite: false,
      tags: [],
    },
  };

  db.prepare(`
    INSERT INTO champions (id, version, created_at, updated_at, concept_updated_at, is_favorite, tags, identity, base_stats, abilities, builds, active_build_id)
    VALUES (@id, @version, @created_at, @updated_at, @concept_updated_at, @is_favorite, @tags, @identity, @base_stats, @abilities, @builds, @active_build_id)
  `).run(serialize(champion));

  return champion;
}

export function getChampion(db: Database, id: string): Champion | null {
  const row = db
    .prepare(`SELECT * FROM champions WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;

  return row ? deserialize(row) : null;
}

export function getAllChampions(db: Database): Champion[] {
  const rows = db
    .prepare(`SELECT * FROM champions ORDER BY updated_at DESC`)
    .all() as Record<string, unknown>[];

  return rows.map(deserialize);
}

export function updateChampion(
  db: Database,
  id: string,
  updates: {
    identity?: Partial<Identity>;
    base_stats?: Partial<BaseStats>;
    abilities?: Partial<Abilities>;
    is_favorite?: boolean;
    tags?: string[];
    builds?: NamedBuild[];
    active_build_id?: string;
  }
): Champion | null {
  const existing = getChampion(db, id);
  if (!existing) return null;

  const builds = updates.builds ?? existing.builds;

  const updated: Champion = {
    identity: { ...existing.identity, ...updates.identity },
    base_stats: { ...existing.base_stats, ...updates.base_stats },
    abilities: { ...existing.abilities, ...updates.abilities },
    builds,
    active_build_id: resolveActiveBuildId(builds, updates.active_build_id ?? existing.active_build_id),
    metadata: {
      ...existing.metadata,
      is_favorite: updates.is_favorite ?? existing.metadata.is_favorite,
      tags: updates.tags ?? existing.metadata.tags,
      updated_at: nowISO(),
    },
  };
  // Only a change to the concept side (not stats, builds or theme audio) moves the concept stamp.
  if (conceptSnapshot(updated) !== conceptSnapshot(existing)) {
    updated.metadata.concept_updated_at = updated.metadata.updated_at;
  }

  db.prepare(`
    UPDATE champions
    SET version = @version,
        updated_at = @updated_at,
        concept_updated_at = @concept_updated_at,
        is_favorite = @is_favorite,
        tags = @tags,
        identity = @identity,
        base_stats = @base_stats,
        abilities = @abilities,
        builds = @builds,
        active_build_id = @active_build_id
    WHERE id = @id
  `).run(serialize(updated));

  return updated;
}

// Used by JSON import: writes a champion record as-is (preserving its id),
// overwriting whatever's already at that id. Unlike createChampion, this
// never mints a new id, so re-importing the same export file is idempotent.
export function upsertChampionRecord(db: Database, champion: Champion): void {
  const builds = coerceBuilds(champion.builds, (champion as any).build_items);
  db.prepare(`
    INSERT INTO champions (id, version, created_at, updated_at, concept_updated_at, is_favorite, tags, identity, base_stats, abilities, builds, active_build_id)
    VALUES (@id, @version, @created_at, @updated_at, @concept_updated_at, @is_favorite, @tags, @identity, @base_stats, @abilities, @builds, @active_build_id)
    ON CONFLICT(id) DO UPDATE SET
      version          = excluded.version,
      updated_at       = excluded.updated_at,
      concept_updated_at = excluded.concept_updated_at,
      is_favorite      = excluded.is_favorite,
      tags             = excluded.tags,
      identity         = excluded.identity,
      base_stats       = excluded.base_stats,
      abilities        = excluded.abilities,
      builds           = excluded.builds,
      active_build_id  = excluded.active_build_id
  `).run(serialize({
    ...champion,
    builds,
    active_build_id: resolveActiveBuildId(builds, champion.active_build_id),
  }));
}

export function deleteChampion(db: Database, id: string): boolean {
  const result = db
    .prepare(`DELETE FROM champions WHERE id = ?`)
    .run(id);

  return result.changes > 0;
}
