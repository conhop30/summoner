import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { initializeSchema, SCHEMA_VERSION } from './schema'

const columns = (db: Database.Database, table: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name)

describe('initializeSchema', () => {
  it('creates every table on a fresh database and records the schema version', () => {
    const db = new Database(':memory:')
    initializeSchema(db)
    const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map(t => t.name)
    expect(tables).toEqual(expect.arrayContaining(['champions', 'items', 'ddragon_champions', 'schema_meta']))
    expect((db.prepare(`SELECT value FROM schema_meta WHERE key = 'version'`).get() as { value: string }).value).toBe(SCHEMA_VERSION)
  })

  it('is safe to run again on every launch', () => {
    const db = new Database(':memory:')
    initializeSchema(db)
    db.prepare(`INSERT INTO schema_meta (key, value) VALUES ('keep', 'me')`).run()
    expect(() => initializeSchema(db)).not.toThrow()
    expect((db.prepare(`SELECT value FROM schema_meta WHERE key = 'keep'`).get() as { value: string }).value).toBe('me')
  })

  it('upgrades a database made by an older release without losing its champions', () => {
    const db = new Database(':memory:')
    // The champions table as it was before builds, and the items table before maps/depth/stacks.
    db.exec(`
      CREATE TABLE champions (
        id TEXT PRIMARY KEY, version TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0, tags TEXT NOT NULL DEFAULT '[]',
        identity TEXT NOT NULL, base_stats TEXT NOT NULL, abilities TEXT NOT NULL
      );
      CREATE TABLE items (
        id TEXT PRIMARY KEY, ddragon_version TEXT NOT NULL, name TEXT NOT NULL, description TEXT, plaintext TEXT,
        image_full TEXT, gold_base INTEGER, gold_total INTEGER, gold_sell INTEGER,
        purchasable INTEGER NOT NULL DEFAULT 1, tags TEXT NOT NULL DEFAULT '[]', stats TEXT NOT NULL DEFAULT '{}',
        synced_at TEXT NOT NULL
      );
      INSERT INTO champions (id, version, created_at, updated_at, identity, base_stats, abilities)
      VALUES ('old', '1.0', 'x', 'x', '{"name":"Old One"}', '{"attack_range":[0]}', '{}');
    `)
    initializeSchema(db)
    expect(columns(db, 'champions')).toEqual(expect.arrayContaining(['builds', 'build_items', 'active_build_id']))
    expect(columns(db, 'items')).toEqual(expect.arrayContaining(['maps', 'depth', 'stacks']))
    expect((db.prepare(`SELECT identity FROM champions WHERE id = 'old'`).get() as { identity: string }).identity).toBe('{"name":"Old One"}')
  })

  it('gives ability blocks saved before they had ids a stable id, without counting as an edit', () => {
    const db = new Database(':memory:')
    initializeSchema(db)
    const abilities = { q: { max_rank: 5, blocks: [{ kind: 'passive', name: 'A' }, { id: 'keep-me-1234', kind: 'recast' }, { kind: 'alternate_form' }] }, w: { max_rank: 5 } }
    db.prepare(`INSERT INTO champions (id, version, created_at, updated_at, concept_updated_at, identity, base_stats, abilities) VALUES ('c1', '1.0', 'x', '2026-02-02T00:00:00.000Z', '2026-02-02T00:00:00.000Z', '{"name":"C"}', '{}', ?)`).run(JSON.stringify(abilities))
    initializeSchema(db)
    const row = db.prepare(`SELECT abilities, updated_at FROM champions WHERE id = 'c1'`).get() as { abilities: string; updated_at: string }
    const blocks = JSON.parse(row.abilities).q.blocks
    expect(blocks.map((b: { id: string }) => b.id)).toEqual(['legacy-q-1', 'keep-me-1234', 'legacy-q-3'])
    expect(row.updated_at).toBe('2026-02-02T00:00:00.000Z')
    // Running it again changes nothing.
    initializeSchema(db)
    expect(JSON.parse((db.prepare(`SELECT abilities FROM champions WHERE id = 'c1'`).get() as { abilities: string }).abilities).q.blocks).toEqual(blocks)
  })

  it('gives champions saved before the concept stamp existed a stamp equal to their updated_at', () => {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE champions (
        id TEXT PRIMARY KEY, version TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0, tags TEXT NOT NULL DEFAULT '[]',
        identity TEXT NOT NULL, base_stats TEXT NOT NULL, abilities TEXT NOT NULL
      );
      INSERT INTO champions (id, version, created_at, updated_at, identity, base_stats, abilities)
      VALUES ('old', '1.0', '2026-01-01T00:00:00.000Z', '2026-02-02T00:00:00.000Z', '{"name":"Old One"}', '{"attack_range":[0]}', '{}');
    `)
    initializeSchema(db)
    const row = db.prepare(`SELECT concept_updated_at FROM champions WHERE id = 'old'`).get() as { concept_updated_at: string }
    expect(row.concept_updated_at).toBe('2026-02-02T00:00:00.000Z')
    // Running it again must not reset a stamp that has since moved.
    db.prepare(`UPDATE champions SET concept_updated_at = '2026-03-03T00:00:00.000Z'`).run()
    initializeSchema(db)
    expect((db.prepare(`SELECT concept_updated_at FROM champions`).get() as { concept_updated_at: string }).concept_updated_at).toBe('2026-03-03T00:00:00.000Z')
  })
})
