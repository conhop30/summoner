import type { BuildEntry, NamedBuild } from '../champion/types';
import { generateId } from '../champion/utils';
import type { Item } from './types';

export const MAX_BUILD_SLOTS = 6;
export const MAX_BUILDS = 4;

// Real-game special case: Control Ward is hard-capped at its stack size (2)
// with no overflow into a second slot, unlike potions which spill into a
// fresh slot once one stack is full. Data Dragon doesn't expose this
// distinction, so it's the one thing we hardcode by id.
const HARD_CAP_ITEM_IDS = new Set(['2055']);

export function maxStackFor(item: Item): number {
  return item.stacks && item.stacks > 1 ? item.stacks : 1;
}

/** Adds one unit of `item` to `build`, respecting stack size, hard caps, and the slot limit. */
export function addToBuild(build: BuildEntry[], item: Item): BuildEntry[] {
  const maxStack = maxStackFor(item);

  const openSlotIndex = build.findIndex(e => e.item_id === item.id && e.count < maxStack);
  if (openSlotIndex !== -1) {
    const next = [...build];
    next[openSlotIndex] = { ...next[openSlotIndex], count: next[openSlotIndex].count + 1 };
    return next;
  }

  if (HARD_CAP_ITEM_IDS.has(item.id) && build.some(e => e.item_id === item.id)) {
    return build; // already at this item's hard total cap
  }

  if (build.length >= MAX_BUILD_SLOTS) return build;
  return [...build, { item_id: item.id, count: 1 }];
}

/** Removes one unit from the last slot holding this item (clicking a filled slot to sell one copy). */
export function removeOneFromBuild(build: BuildEntry[], itemId: string): BuildEntry[] {
  const index = build.map(e => e.item_id).lastIndexOf(itemId);
  if (index === -1) return build;
  const entry = build[index];
  if (entry.count > 1) {
    const next = [...build];
    next[index] = { ...entry, count: entry.count - 1 };
    return next;
  }
  return build.filter((_, i) => i !== index);
}

export interface ResolvedBuildEntry {
  entry: BuildEntry;
  item: Item;
}

export function resolveBuild(build: BuildEntry[], catalog: Item[]): ResolvedBuildEntry[] {
  return build
    .map(entry => ({ entry, item: catalog.find(i => i.id === entry.item_id) }))
    .filter((x): x is ResolvedBuildEntry => !!x.item);
}

export function buildGoldTotal(resolved: ResolvedBuildEntry[]): number {
  return resolved.reduce((sum, { entry, item }) => sum + (item.gold_total ?? 0) * entry.count, 0);
}

export function buildStatBonus(resolved: ResolvedBuildEntry[], ddragonKey: string): number {
  return resolved.reduce((sum, { entry, item }) => sum + (item.stats[ddragonKey] ?? 0) * entry.count, 0);
}

// ─── Multiple named builds per champion ─────────────────────────────────────

export function createNamedBuild(name: string): NamedBuild {
  return { id: generateId(), name, items: [] };
}

export function defaultBuilds(): NamedBuild[] {
  return [createNamedBuild('Build 1')];
}

/** Returns the active build, falling back to the first build if the id doesn't match (e.g. stale/deleted). */
export function getActiveBuild(builds: NamedBuild[], activeId: string): NamedBuild {
  return builds.find(b => b.id === activeId) ?? builds[0];
}

export function addNamedBuild(builds: NamedBuild[]): NamedBuild[] {
  if (builds.length >= MAX_BUILDS) return builds;
  return [...builds, createNamedBuild(`Build ${builds.length + 1}`)];
}

export function renameNamedBuild(builds: NamedBuild[], id: string, name: string): NamedBuild[] {
  return builds.map(b => b.id === id ? { ...b, name } : b);
}

/** Never deletes the last remaining build — a champion always has at least one. */
export function deleteNamedBuild(builds: NamedBuild[], id: string): NamedBuild[] {
  if (builds.length <= 1) return builds;
  return builds.filter(b => b.id !== id);
}

export function updateBuildItems(builds: NamedBuild[], id: string, items: BuildEntry[]): NamedBuild[] {
  return builds.map(b => b.id === id ? { ...b, items } : b);
}
