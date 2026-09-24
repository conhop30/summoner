import type { Database } from 'better-sqlite3';

export const SCHEMA_VERSION = '1.0';

export function initializeSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS champions (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      identity TEXT NOT NULL,
      base_stats TEXT NOT NULL,
      abilities TEXT NOT NULL,
      build_items TEXT NOT NULL DEFAULT '[]',
      builds TEXT NOT NULL DEFAULT '[]',
      active_build_id TEXT
    );

    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      ddragon_version TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      plaintext TEXT,
      image_full TEXT,
      gold_base INTEGER,
      gold_total INTEGER,
      gold_sell INTEGER,
      purchasable INTEGER NOT NULL DEFAULT 1,
      tags TEXT NOT NULL DEFAULT '[]',
      stats TEXT NOT NULL DEFAULT '{}',
      maps TEXT NOT NULL DEFAULT '{}',
      depth INTEGER,
      stacks INTEGER,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ddragon_champions (
      id TEXT PRIMARY KEY,
      ddragon_version TEXT NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      partype TEXT,
      stats TEXT NOT NULL DEFAULT '{}',
      image_full TEXT,
      synced_at TEXT NOT NULL
    );
  `);

  const itemColumns = new Set(
    (db.prepare(`PRAGMA table_info(items)`).all() as { name: string }[]).map(c => c.name)
  );
  if (!itemColumns.has('maps')) {
    db.exec(`ALTER TABLE items ADD COLUMN maps TEXT NOT NULL DEFAULT '{}'`);
  }
  if (!itemColumns.has('depth')) {
    db.exec(`ALTER TABLE items ADD COLUMN depth INTEGER`);
  }
  if (!itemColumns.has('stacks')) {
    db.exec(`ALTER TABLE items ADD COLUMN stacks INTEGER`);
  }

  const championColumns = new Set(
    (db.prepare(`PRAGMA table_info(champions)`).all() as { name: string }[]).map(c => c.name)
  );
  if (!championColumns.has('build_items')) {
    db.exec(`ALTER TABLE champions ADD COLUMN build_items TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!championColumns.has('builds')) {
    db.exec(`ALTER TABLE champions ADD COLUMN builds TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!championColumns.has('active_build_id')) {
    db.exec(`ALTER TABLE champions ADD COLUMN active_build_id TEXT`);
  }
  if (!championColumns.has('concept_updated_at')) {
    db.exec(`ALTER TABLE champions ADD COLUMN concept_updated_at TEXT`);
    db.exec(`UPDATE champions SET concept_updated_at = updated_at`);
  }

  const existing = db
    .prepare(`SELECT value FROM schema_meta WHERE key = 'version'`)
    .get() as { value: string } | undefined;

  if (!existing) {
    db.prepare(`INSERT INTO schema_meta (key, value) VALUES ('version', ?)`).run(
      SCHEMA_VERSION
    );
  }
}