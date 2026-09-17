import { net } from 'electron';

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

export interface DDragonItemRaw {
  id: string;
  name: string;
  description?: string;
  plaintext?: string;
  image_full?: string;
  gold_base?: number;
  gold_total?: number;
  gold_sell?: number;
  purchasable: boolean;
  tags: string[];
  stats: Record<string, number>;
  maps: Record<string, boolean>;
  depth?: number;
  stacks?: number;
}

export async function fetchLatestVersion(): Promise<string> {
  const res = await net.fetch(`${DDRAGON_BASE}/api/versions.json`);
  if (!res.ok) throw new Error(`Data Dragon versions request failed: ${res.status}`);
  const versions = (await res.json()) as string[];
  if (!versions?.length) throw new Error('Data Dragon returned no versions');
  return versions[0];
}

export async function fetchItems(version: string, locale = 'en_US'): Promise<DDragonItemRaw[]> {
  const res = await net.fetch(`${DDRAGON_BASE}/cdn/${version}/data/${locale}/item.json`);
  if (!res.ok) throw new Error(`Data Dragon item request failed: ${res.status}`);
  const json = (await res.json()) as { data: Record<string, any> };

  return Object.entries(json.data).map(([id, raw]) => ({
    id,
    name: raw.name,
    description: raw.description,
    plaintext: raw.plaintext,
    image_full: raw.image?.full,
    gold_base: raw.gold?.base,
    gold_total: raw.gold?.total,
    gold_sell: raw.gold?.sell,
    purchasable: raw.gold?.purchasable ?? true,
    tags: raw.tags ?? [],
    stats: raw.stats ?? {},
    maps: raw.maps ?? {},
    depth: raw.depth,
    stacks: raw.stacks,
  }));
}

export function itemImageUrl(version: string, imageFull: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/item/${imageFull}`;
}
