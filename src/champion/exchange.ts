// Turning champions into interchange records and back, and deciding what an import should do.
// Pure (no files, no database): the Electron main process supplies image bytes and writes results.
//
// The rule behind all of it: an import UPDATES, it never overwrites. A 'concept' file can only
// touch a champion's concept fields (identity, abilities, tags). Base stats, builds, theme audio
// and favorites are desktop-owned and stay exactly as they are.

import type { Champion, Abilities, Ability, BaseStats, Identity, NamedBuild } from './types'
import type { AbilitySlot, ChampionRecord, ImageRef, Scope } from '../interchange/types'
import { SLOTS } from '../interchange/types'
import { sanitizeRecord } from '../interchange/sanitize'
import { defaultBaseStats, generateId, nowISO } from './utils'
import { defaultBuilds } from '../item/buildLogic'
import { SCHEMA_VERSION } from '../db/schema'

export type ImageKind = 'splash' | 'icon'
// Supplied by the caller: reads the file behind an app-asset:// URL and returns it embedded.
export type ImageOf = (assetUrl: string, kind: ImageKind) => ImageRef | undefined

// ─── Concept change detection ────────────────────────────────────────────────

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort()
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

// The parts of a champion that belong to the concept side. Theme audio is excluded on purpose.
export function conceptSnapshot(champion: Champion): string {
  const identity: Partial<Identity> = { ...champion.identity }
  delete identity.theme_audio
  return stableStringify({ identity, abilities: champion.abilities, tags: champion.metadata.tags })
}

export function conceptStamp(champion: Champion): string {
  return champion.metadata.concept_updated_at ?? champion.metadata.updated_at
}

// ─── Champion → record ───────────────────────────────────────────────────────

export function championToRecord(champion: Champion, scope: Scope, imageOf: ImageOf): ChampionRecord | undefined {
  const { image_path, theme_audio: _themeAudio, ...identityRest } = champion.identity
  void _themeAudio
  const identity: Record<string, unknown> = { ...identityRest }
  const splash = image_path ? imageOf(image_path, 'splash') : undefined
  if (splash) identity.splash = splash

  const abilities: Record<string, unknown> = {}
  for (const slot of SLOTS) {
    const { icon_path, ...rest } = champion.abilities[slot]
    const icon = icon_path ? imageOf(icon_path, 'icon') : undefined
    abilities[slot] = icon ? { ...rest, icon } : { ...rest }
  }

  const raw: Record<string, unknown> = {
    id: champion.metadata.id,
    created_at: champion.metadata.created_at,
    concept_updated_at: conceptStamp(champion),
    tags: champion.metadata.tags,
    identity,
    abilities,
  }
  if (scope === 'full') {
    raw.desktop = {
      base_stats: champion.base_stats,
      builds: champion.builds,
      active_build_id: champion.active_build_id,
    }
  }
  // Same whitelist an importer applies: what we write is exactly what the format allows.
  return sanitizeRecord(raw, scope === 'full', () => {})
}

// ─── Import planning ─────────────────────────────────────────────────────────

export type ImportStatus = 'new' | 'update' | 'unchanged' | 'local-newer'
export type LocalNewerChoice = 'keep-mine' | 'take-theirs' | 'keep-both'
export type ImportAction = 'skip' | 'apply' | 'copy'

export function classify(local: Champion | undefined, record: ChampionRecord): ImportStatus {
  if (!local) return 'new'
  const incoming = Date.parse(record.concept_updated_at)
  const mine = Date.parse(conceptStamp(local))
  if (incoming === mine) return 'unchanged'
  return incoming > mine ? 'update' : 'local-newer'
}

export function actionFor(status: ImportStatus, choice: LocalNewerChoice): ImportAction {
  switch (status) {
    case 'new':
    case 'update':
      return 'apply'
    case 'unchanged':
      return 'skip'
    case 'local-newer':
      return choice === 'take-theirs' ? 'apply' : choice === 'keep-both' ? 'copy' : 'skip'
  }
}

// ─── Record → champion ───────────────────────────────────────────────────────

export interface ResolvedAssets {
  splash?: string
  icons: Partial<Record<AbilitySlot, string>>
}

export function recordToChampion(
  record: ChampionRecord,
  existing: Champion | null,
  assets: ResolvedAssets,
  options: { asCopy?: boolean } = {}
): Champion {
  const { splash: _splash, ...identityRest } = record.identity
  void _splash
  const identity: Identity = { ...identityRest }
  if (assets.splash) identity.image_path = assets.splash
  if (options.asCopy) identity.name = `${identity.name} (imported)`.slice(0, 80)
  // Theme audio is a local file that never travels; keep whatever this machine already has.
  if (existing?.identity.theme_audio && !options.asCopy) identity.theme_audio = existing.identity.theme_audio

  const abilities = {} as Abilities
  for (const slot of SLOTS) {
    const { icon: _icon, ...rest } = record.abilities[slot]
    void _icon
    const ability = { ...rest } as Ability
    const iconPath = assets.icons[slot]
    if (iconPath) ability.icon_path = iconPath
    abilities[slot] = ability
  }

  const keep = options.asCopy ? null : existing
  let base_stats: BaseStats = keep?.base_stats ?? (defaultBaseStats() as BaseStats)
  let builds: NamedBuild[] = keep?.builds ?? defaultBuilds()
  let active_build_id = keep?.active_build_id
  if (record.desktop) {
    base_stats = { ...(defaultBaseStats() as BaseStats), ...(record.desktop.base_stats as unknown as Partial<BaseStats>) }
    if (record.desktop.builds.length > 0) builds = record.desktop.builds
    active_build_id = record.desktop.active_build_id
  }
  if (!active_build_id || !builds.some(b => b.id === active_build_id)) active_build_id = builds[0].id

  const now = nowISO()
  return {
    identity,
    base_stats,
    abilities,
    builds,
    active_build_id,
    metadata: {
      id: options.asCopy ? generateId() : record.id,
      created_at: keep?.metadata.created_at ?? record.created_at,
      updated_at: now,
      concept_updated_at: record.concept_updated_at,
      version: SCHEMA_VERSION,
      is_favorite: keep?.metadata.is_favorite ?? false,
      tags: record.tags,
    },
  }
}
