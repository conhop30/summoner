import { net } from 'electron';
import type { ChampionCatalogStats } from './types';

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

export interface DDragonChampionRaw {
  id: string;
  key: string;
  name: string;
  title?: string;
  tags: string[];
  partype?: string;
  stats: ChampionCatalogStats;
  image_full?: string;
}

export async function fetchLatestVersion(): Promise<string> {
  const res = await net.fetch(`${DDRAGON_BASE}/api/versions.json`);
  if (!res.ok) throw new Error(`Data Dragon versions request failed: ${res.status}`);
  const versions = (await res.json()) as string[];
  if (!versions?.length) throw new Error('Data Dragon returned no versions');
  return versions[0];
}

// The champion.json summary already carries full base+growth stats and class
// tags for every champion in one request — no need to fetch per-champion detail.
export async function fetchChampions(version: string, locale = 'en_US'): Promise<DDragonChampionRaw[]> {
  const res = await net.fetch(`${DDRAGON_BASE}/cdn/${version}/data/${locale}/champion.json`);
  if (!res.ok) throw new Error(`Data Dragon champion request failed: ${res.status}`);
  const json = (await res.json()) as { data: Record<string, any> };

  return Object.values(json.data).map((raw: any) => ({
    id: raw.id,
    key: raw.key,
    name: raw.name,
    title: raw.title,
    tags: raw.tags ?? [],
    partype: raw.partype,
    stats: raw.stats ?? {},
    image_full: raw.image?.full,
  }));
}

export function championImageUrl(version: string, imageFull: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${imageFull}`;
}
