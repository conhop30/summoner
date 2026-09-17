import type { Database } from 'better-sqlite3';
import type { AppSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

const KEY = 'app_settings';

export function getSettings(db: Database): AppSettings {
  const row = db.prepare(`SELECT value FROM schema_meta WHERE key = ?`).get(KEY) as { value: string } | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateSettings(db: Database, partial: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(db), ...partial };
  db.prepare(`
    INSERT INTO schema_meta (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run({ key: KEY, value: JSON.stringify(next) });
  return next;
}
