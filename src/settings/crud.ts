import type { Database } from 'better-sqlite3';
import type { AppSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

const KEY = 'app_settings';

export function getSettings(db: Database): AppSettings {
  const row = db.prepare(`SELECT value FROM schema_meta WHERE key = ?`).get(KEY) as { value: string } | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return withDefaults(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// Fill in anything a stored settings blob lacks. Themes used to play at the background music's
// volume, so a blob saved before theme_volume existed inherits music_volume — nobody's themes
// suddenly jump to a different loudness after updating.
export function withDefaults(stored: Partial<AppSettings>): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  if (stored.theme_volume === undefined && typeof stored.music_volume === 'number') {
    merged.theme_volume = stored.music_volume;
  }
  return merged;
}

export function updateSettings(db: Database, partial: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(db), ...partial };
  db.prepare(`
    INSERT INTO schema_meta (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run({ key: KEY, value: JSON.stringify(next) });
  return next;
}
