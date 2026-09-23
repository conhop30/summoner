import { useState, useEffect, useCallback } from 'react';
import type { ChampionCatalogEntry, ChampionCatalogSyncStatus } from './types';

export function useChampionCatalog() {
  const [catalog, setCatalog] = useState<ChampionCatalogEntry[]>([]);
  const [status, setStatus] = useState<ChampionCatalogSyncStatus>({ version: null, synced_at: null });
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    window.summoner.championCatalog.getAll().then(setCatalog);
    window.summoner.championCatalog.getSyncStatus().then(setStatus);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await window.summoner.championCatalog.sync();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [load]);

  return { catalog, status, syncing, error, sync };
}
