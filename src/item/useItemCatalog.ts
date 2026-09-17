import { useState, useEffect, useCallback } from 'react';
import type { Item, ItemSyncStatus } from './types';

export function useItemCatalog() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<ItemSyncStatus>({ version: null, synced_at: null });
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    window.summoner.item.getAll().then(setItems);
    window.summoner.item.getSyncStatus().then(setStatus);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await window.summoner.item.sync();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [load]);

  return { items, status, syncing, error, sync };
}
