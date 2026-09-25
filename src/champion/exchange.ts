// Turning champions into interchange records and back, and deciding what an import should do.
// Pure (no files, no database): the Electron main process supplies image bytes and writes results.
//
// The rule behind all of it: an import UPDATES, it never overwrites. A 'concept' file can only
// touch a champion's concept fields: identity, tags, and each ability's name, description and icon.
// Base stats, builds, ability numbers/blocks/notes, theme audio and favorites are desktop-owned and
// stay exactly as they are.

import type { Champion, Abilities, Ability, AbilityBlock, BaseStats, Identity, NamedBuild } from './types'
import type { AbilityDetails, AbilitySlot, AbilityText, BlockDetails, BlockText, ChampionRecord, Effect, ImageRef, Scope } from '../interchange/types'
import { SLOTS } from '../interchange/types'
import { sanitizeRecord } from '../interchange/sanitize'
import { blockFallbackId, defaultAbilities, defaultBaseStats, generateId, nowISO } from './utils'
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

// ─── Blocks ──────────────────────────────────────────────────────────────────

// Blocks saved before they had ids get a stable stand-in from their position.
const blockIdOf = (block: AbilityBlock, slot: AbilitySlot, index: number) => block.id ?? blockFallbackId(slot, index)

function blockConcept(block: AbilityBlock, slot: AbilitySlot, index: number): BlockText {
  return {
    id: blockIdOf(block, slot, index),
    kind: block.kind,
    name: block.name,
    description: block.description,
    condition: block.kind === 'recast' ? block.recast?.recast_extends_on : undefined,
  }
}

function blockDetails(block: AbilityBlock, slot: AbilitySlot, index: number): BlockDetails {
  const { kind: _kind, name: _name, description: _description, recast, id: _id, ...numbers } = block
  void _kind; void _name; void _description; void _id
  const details: BlockDetails = { ...numbers, id: blockIdOf(block, slot, index) }
  if (recast) {
    details.recast = { max_recasts: recast.max_recasts, recast_window: recast.recast_window, recast_static_cooldown: recast.recast_static_cooldown }
  }
  return details
}

interface Numbers {
  id?: string
  cooldown?: number[]
  cost?: number[]
  cost_type?: string
  effects?: Effect[]
  recast?: { max_recasts: number; recast_window: number; recast_static_cooldown?: number }
}

// Rebuilds an ability's blocks: the list, order, kind and text come from the file; each block's
// numbers come from the same-id block in `source` (the file's desktop section, or what is here).
function buildBlocks(texts: BlockText[] | undefined, source: Numbers[] | undefined): AbilityBlock[] | undefined {
  if (!texts || texts.length === 0) return undefined
  return texts.map(t => {
    const n = source?.find(candidate => candidate.id === t.id)
    const block: AbilityBlock = { id: t.id, kind: t.kind }
    if (t.name) block.name = t.name
    if (t.description) block.description = t.description
    if (n?.cooldown) block.cooldown = n.cooldown
    if (n?.cost) block.cost = n.cost
    if (n?.cost_type) block.cost_type = n.cost_type
    if (n?.effects) block.effects = n.effects
    if (t.kind === 'recast') {
      block.recast = {
        max_recasts: n?.recast?.max_recasts ?? 1,
        recast_window: n?.recast?.recast_window ?? 3,
        ...(n?.recast?.recast_static_cooldown !== undefined ? { recast_static_cooldown: n.recast.recast_static_cooldown } : {}),
        ...(t.condition ? { recast_extends_on: t.condition } : {}),
      }
    }
    return block
  })
}

// The parts of a champion that belong to the concept side. Theme audio is excluded on purpose, and
// of each ability only its text, icon, journal and the text of its blocks count: a cooldown tweak
// is not a concept edit.
export function conceptSnapshot(champion: Champion): string {
  const identity: Partial<Identity> = { ...champion.identity }
  delete identity.theme_audio
  const abilities: Record<string, unknown> = {}
  for (const slot of SLOTS) {
    const a = champion.abilities[slot]
    abilities[slot] = {
      name: a.name, description: a.description, icon_path: a.icon_path, journal: a.journal,
      blocks: a.blocks?.map((b, i) => blockConcept(b, slot, i)),
    }
  }
  return stableStringify({ identity, abilities, tags: champion.metadata.tags })
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
  const details: Record<string, unknown> = {}
  for (const slot of SLOTS) {
    const { icon_path, name, description, journal, blocks, ...rest } = champion.abilities[slot]
    const icon = icon_path ? imageOf(icon_path, 'icon') : undefined
    abilities[slot] = {
      name, description, journal, ...(icon ? { icon } : {}),
      ...(blocks?.length ? { blocks: blocks.map((b, i) => blockConcept(b, slot, i)) } : {}),
    }
    details[slot] = { ...rest, ...(blocks?.length ? { blocks: blocks.map((b, i) => blockDetails(b, slot, i)) } : {}) }
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
      abilities: details,
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

  const keep = options.asCopy ? null : existing
  let base_stats: BaseStats = keep?.base_stats ?? (defaultBaseStats() as BaseStats)
  let builds: NamedBuild[] = keep?.builds ?? defaultBuilds()
  let active_build_id = keep?.active_build_id
  const base = defaultAbilities() as Abilities
  // Each ability starts from what is already here (numbers, blocks, notes), then the file's text goes on top.
  const abilities = {} as Abilities
  for (const slot of SLOTS) abilities[slot] = { ...(keep?.abilities[slot] ?? base[slot]) }
  // Where each block's numbers come from: the file's desktop section if it has one, else what is here.
  const numberSource = {} as Record<AbilitySlot, Numbers[] | undefined>
  for (const slot of SLOTS) numberSource[slot] = keep?.abilities[slot].blocks as Numbers[] | undefined
  if (record.desktop) {
    base_stats = { ...(defaultBaseStats() as BaseStats), ...(record.desktop.base_stats as unknown as Partial<BaseStats>) }
    if (record.desktop.builds.length > 0) builds = record.desktop.builds
    active_build_id = record.desktop.active_build_id
    for (const slot of SLOTS) {
      const details: AbilityDetails = record.desktop.abilities[slot]
      abilities[slot] = { ...(details as unknown as Ability) }
      numberSource[slot] = details.blocks
    }
  }
  for (const slot of SLOTS) {
    const text: AbilityText = record.abilities[slot]
    const ability = abilities[slot]
    delete ability.name
    delete ability.description
    delete ability.icon_path
    delete ability.journal
    delete ability.blocks
    if (text.name) ability.name = text.name
    if (text.description) ability.description = text.description
    if (assets.icons[slot]) ability.icon_path = assets.icons[slot]
    if (text.journal) ability.journal = text.journal
    const blocks = buildBlocks(text.blocks, numberSource[slot])
    if (blocks) ability.blocks = blocks
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
