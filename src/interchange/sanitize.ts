// Validation and sanitizing for the interchange format (contract/SPEC.md).
//
// The rule: nothing from a file reaches the app except through a whitelist here. Every field is
// read by name and rebuilt into a fresh object, so unknown keys, `__proto__`, oversized text and
// bad numbers can't get through. Problems inside one champion trim or skip that champion and are
// reported as warnings; only a file that isn't a Summoner export at all is refused outright.

import type {
  AbilityBlock, AbilityBody, AbilityRecord, AbilitySlot, ChampionRecord, DesktopSection, Effect,
  IdentityRecord, ImageRef, JournalTab, ParseResult, ParsedFile, RecastStruct, Scope,
} from './types'
import { FORMAT, SLOTS, VERSION } from './types'

export const LIMITS = {
  fileBytes: 100 * 1024 * 1024,
  champions: 500,
  imageBase64: 4_500_000, // ≈ 3.3 MB once decoded
  name: 80,
  title: 120,
  lore: 20_000,
  abilityName: 80,
  description: 4_000,
  notes: 500,
  short: 40,
  effects: 20,
  ratios: 10,
  blocks: 20,
  journalTabs: 50,
  journalContent: 20_000,
  tags: 50,
  listItems: 20,
  builds: 10,
  buildItems: 12,
  number: 1_000_000,
  rankEntries: 12,
} as const

export interface ParseOptions {
  // Summoner Mobile passes false: it has no use for stats or builds, so they are dropped, not stored.
  includeDesktop?: boolean
  maxBytes?: number
}

type Warn = (message: string) => void
type Obj = Record<string, unknown>

// Deliberate: strips control characters (everything below space except tab and newline).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const DAMAGE_TYPES = ['Physical', 'Magic', 'True'] as const
const BLOCK_KINDS = ['passive', 'alternate_form', 'recast'] as const

const DESKTOP_STAT_KEYS = [
  'health', 'health_growth', 'health_regen', 'health_regen_growth',
  'resource', 'resource_growth', 'resource_regen', 'resource_regen_growth',
  'attack_damage', 'attack_damage_growth', 'attack_speed', 'attack_speed_growth',
  'armor', 'armor_growth', 'magic_resistance', 'magic_resistance_growth',
  'movement_speed', 'movement_speed_growth', 'crit_damage_multiplier',
] as const

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function text(v: unknown, max: number, warn: Warn, label: string): string | undefined {
  if (typeof v !== 'string') return undefined
  let s = v.replace(CONTROL_CHARS, '')
  if (s.length > max) {
    s = s.slice(0, max)
    warn(`${label} was longer than ${max} characters and was shortened`)
  }
  return s === '' ? undefined : s
}

function num(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  return Math.max(-LIMITS.number, Math.min(LIMITS.number, v))
}

function int(v: unknown, min: number, max: number): number | undefined {
  const n = num(v)
  return n === undefined ? undefined : Math.max(min, Math.min(max, Math.round(n)))
}

function stringList(v: unknown, maxItems: number, maxLen: number, warn: Warn, label: string): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: string[] = []
  for (const item of v.slice(0, maxItems)) {
    const s = text(item, maxLen, warn, label)
    if (s !== undefined && !out.includes(s)) out.push(s)
  }
  return out.length > 0 ? out : undefined
}

function isoDate(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 40) return undefined
  const ms = Date.parse(v)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined
}

// A per-rank array always ends up exactly `maxRank` long, padded with its last value (the same
// rule the desktop editor uses when the rank count changes).
function rankArray(v: unknown, maxRank: number): number[] | undefined {
  if (!Array.isArray(v)) return undefined
  const values = v.slice(0, LIMITS.rankEntries).map(n => num(n) ?? 0)
  if (values.length === 0) return undefined
  if (values.length >= maxRank) return values.slice(0, maxRank)
  const last = values[values.length - 1]
  return [...values, ...Array(maxRank - values.length).fill(last)]
}

// ─── Images ──────────────────────────────────────────────────────────────────

// Checks the first bytes against the declared type, so a file can't claim to be a PNG and be
// something else.
function magicMatches(mime: string, base64: string): boolean {
  let head: string
  try {
    head = atob(base64.slice(0, 16))
  } catch {
    return false
  }
  if (mime === 'image/png') return head.startsWith('\x89PNG')
  if (mime === 'image/jpeg') return head.startsWith('\xFF\xD8\xFF')
  if (mime === 'image/webp') return head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP'
  return false
}

export function sanitizeImage(v: unknown, warn: Warn, label: string): ImageRef | undefined {
  if (v === undefined || v === null) return undefined
  if (!isObj(v) || typeof v.mime !== 'string' || typeof v.data !== 'string') {
    warn(`${label} was dropped: not a valid embedded image`)
    return undefined
  }
  const { mime, data } = v
  if (mime !== 'image/png' && mime !== 'image/jpeg' && mime !== 'image/webp') {
    warn(`${label} was dropped: unsupported image type`)
    return undefined
  }
  if (data.length < 16 || data.length > LIMITS.imageBase64) {
    warn(`${label} was dropped: image is empty or too large`)
    return undefined
  }
  if (data.length % 4 !== 0 || !BASE64_PATTERN.test(data) || !magicMatches(mime, data)) {
    warn(`${label} was dropped: the data is not a real ${mime.slice(6).toUpperCase()} image`)
    return undefined
  }
  return { mime, data }
}

// ─── Abilities ───────────────────────────────────────────────────────────────

function sanitizeRecast(v: unknown, warn: Warn, label: string): RecastStruct | undefined {
  if (!isObj(v)) return undefined
  const recast: RecastStruct = {
    max_recasts: int(v.max_recasts, 0, 99) ?? 1,
    recast_window: Math.max(0, Math.min(3600, num(v.recast_window) ?? 3)),
  }
  const staticCd = num(v.recast_static_cooldown)
  if (staticCd !== undefined) recast.recast_static_cooldown = Math.max(0, staticCd)
  const extendsOn = text(v.recast_extends_on, 200, warn, `${label} recast condition`)
  if (extendsOn) recast.recast_extends_on = extendsOn
  return recast
}

function sanitizeEffect(v: unknown, maxRank: number, warn: Warn, label: string): Effect | undefined {
  if (!isObj(v)) return undefined
  const type = text(v.type, LIMITS.short, warn, `${label} effect type`)
  if (!type) return undefined
  const effect: Effect = { type }
  if ((DAMAGE_TYPES as readonly unknown[]).includes(v.damage_type)) effect.damage_type = v.damage_type as Effect['damage_type']
  const base = rankArray(v.base, maxRank)
  if (base) effect.base = base
  const duration = rankArray(v.duration, maxRank)
  if (duration) effect.duration = duration
  const notes = text(v.notes, LIMITS.notes, warn, `${label} effect notes`)
  if (notes) effect.notes = notes
  if (Array.isArray(v.ratios)) {
    const ratios = []
    for (const r of v.ratios.slice(0, LIMITS.ratios)) {
      if (!isObj(r)) continue
      const stat = text(r.stat, LIMITS.short, warn, `${label} ratio stat`)
      if (stat) ratios.push({ stat, values: rankArray(r.values, maxRank) ?? Array(maxRank).fill(0) })
    }
    if (ratios.length > 0) effect.ratios = ratios
  }
  return effect
}

function sanitizeBody(v: Obj, maxRank: number, warn: Warn, label: string): AbilityBody {
  const body: AbilityBody = {}
  const name = text(v.name, LIMITS.abilityName, warn, `${label} name`)
  if (name) body.name = name
  const description = text(v.description, LIMITS.description, warn, `${label} description`)
  if (description) body.description = description
  const cooldown = rankArray(v.cooldown, maxRank)
  if (cooldown) body.cooldown = cooldown
  const cost = rankArray(v.cost, maxRank)
  if (cost) body.cost = cost
  const costType = text(v.cost_type, LIMITS.short, warn, `${label} cost type`)
  if (costType) body.cost_type = costType
  if (Array.isArray(v.effects)) {
    const effects: Effect[] = []
    for (const e of v.effects.slice(0, LIMITS.effects)) {
      const clean = sanitizeEffect(e, maxRank, warn, label)
      if (clean) effects.push(clean)
    }
    if (effects.length > 0) body.effects = effects
  }
  return body
}

function sanitizeExtra(v: unknown, warn: Warn, label: string): AbilityRecord['extra'] {
  if (!isObj(v)) return undefined
  const extra: NonNullable<AbilityRecord['extra']> = {}
  let count = 0
  for (const key of Object.keys(v)) {
    if (UNSAFE_KEYS.has(key) || key.length > LIMITS.short || count >= LIMITS.listItems) continue
    const value = v[key]
    if (key === 'recast') {
      const recast = sanitizeRecast(value, warn, label)
      if (recast) { extra.recast = recast; count++ }
    } else if (typeof value === 'string') {
      const s = text(value, LIMITS.notes, warn, `${label} extra "${key}"`)
      if (s !== undefined) { extra[key] = s; count++ }
    } else if (typeof value === 'boolean') {
      extra[key] = value; count++
    } else if (typeof value === 'number') {
      const n = num(value)
      if (n !== undefined) { extra[key] = n; count++ }
    }
  }
  return count > 0 ? extra : undefined
}

function sanitizeJournal(v: unknown, warn: Warn, label: string): AbilityRecord['journal'] {
  if (!isObj(v) || !Array.isArray(v.tabs)) return undefined
  const tabs: JournalTab[] = []
  const seen = new Set<string>()
  for (const t of v.tabs.slice(0, LIMITS.journalTabs)) {
    if (!isObj(t)) continue
    let id = typeof t.id === 'string' && ID_PATTERN.test(t.id) ? t.id : `tab-${tabs.length + 1}`
    if (seen.has(id)) id = `${id}-${tabs.length + 1}`
    seen.add(id)
    tabs.push({
      id,
      name: text(t.name, 60, warn, `${label} journal tab name`) ?? `Note ${tabs.length + 1}`,
      content: (typeof t.content === 'string' ? text(t.content, LIMITS.journalContent, warn, `${label} journal note`) : undefined) ?? '',
      created_at: isoDate(t.created_at) ?? new Date(0).toISOString(),
    })
  }
  return tabs.length > 0 ? { tabs } : undefined
}

function sanitizeBlock(v: unknown, maxRank: number, warn: Warn, label: string): AbilityBlock | undefined {
  if (!isObj(v)) return undefined
  if (!(BLOCK_KINDS as readonly unknown[]).includes(v.kind)) return undefined
  const block: AbilityBlock = { kind: v.kind as AbilityBlock['kind'], ...sanitizeBody(v, maxRank, warn, label) }
  if (block.kind === 'recast') block.recast = sanitizeRecast(v.recast, warn, label) ?? { max_recasts: 1, recast_window: 3 }
  return block
}

function sanitizeAbility(v: unknown, slot: AbilitySlot, warn: Warn): AbilityRecord {
  const label = slot === 'passive' ? 'Passive' : slot.toUpperCase()
  const raw: Obj = isObj(v) ? v : {}
  const maxRank = int(raw.max_rank, 1, 6) ?? (slot === 'r' ? 3 : 5)
  const ability: AbilityRecord = { max_rank: maxRank, ...sanitizeBody(raw, maxRank, warn, label) }

  const extra = sanitizeExtra(raw.extra, warn, label)
  if (extra) ability.extra = extra
  const journal = sanitizeJournal(raw.journal, warn, label)
  if (journal) ability.journal = journal
  if (Array.isArray(raw.blocks)) {
    const blocks: AbilityBlock[] = []
    for (const b of raw.blocks.slice(0, LIMITS.blocks)) {
      const clean = sanitizeBlock(b, maxRank, warn, `${label} block`)
      if (clean) blocks.push(clean)
    }
    if (blocks.length > 0) ability.blocks = blocks
  }
  const icon = sanitizeImage(raw.icon, warn, `${label} icon`)
  if (icon) ability.icon = icon
  return ability
}

// ─── Identity ────────────────────────────────────────────────────────────────

function sanitizeIdentity(v: unknown, warn: Warn): IdentityRecord | undefined {
  if (!isObj(v)) return undefined
  const name = text(v.name, LIMITS.name, warn, 'Name')?.trim()
  if (!name) return undefined
  const identity: IdentityRecord = { name }
  const title = text(v.title, LIMITS.title, warn, 'Title')
  if (title) identity.title = title
  const lore = text(v.lore, LIMITS.lore, warn, 'Lore')
  if (lore) identity.lore = lore
  const cls = stringList(v.class, 10, 30, warn, 'Class')
  if (cls) identity.class = cls
  const role = stringList(v.role, 10, 30, warn, 'Lane')
  if (role) identity.role = role
  const attack = stringList(v.attack_type, 4, 30, warn, 'Attack type')
  if (attack) identity.attack_type = attack
  const resource = text(v.resource_type, 30, warn, 'Resource')
  if (resource) identity.resource_type = resource
  const playstyle = stringList(v.playstyle, LIMITS.listItems, LIMITS.short, warn, 'Playstyle')
  if (playstyle) identity.playstyle = playstyle
  if (isObj(v.image_position)) {
    const x = num(v.image_position.x)
    const y = num(v.image_position.y)
    if (x !== undefined && y !== undefined) {
      identity.image_position = { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
    }
  }
  const splash = sanitizeImage(v.splash, warn, 'Splash art')
  if (splash) identity.splash = splash
  return identity
}

// ─── Desktop-owned section ───────────────────────────────────────────────────

function sanitizeDesktop(v: unknown, warn: Warn): DesktopSection | undefined {
  if (!isObj(v)) return undefined
  const base_stats: DesktopSection['base_stats'] = {}
  if (isObj(v.base_stats)) {
    for (const key of DESKTOP_STAT_KEYS) {
      const n = num(v.base_stats[key])
      if (n !== undefined) base_stats[key] = n
    }
    if (Array.isArray(v.base_stats.attack_range)) {
      const ranges = v.base_stats.attack_range.slice(0, 6).map(n => num(n)).filter((n): n is number => n !== undefined)
      base_stats.attack_range = ranges.length > 0 ? ranges : [0]
    }
  }
  const builds: DesktopSection['builds'] = []
  if (Array.isArray(v.builds)) {
    for (const b of v.builds.slice(0, LIMITS.builds)) {
      if (!isObj(b)) continue
      const id = typeof b.id === 'string' && ID_PATTERN.test(b.id) ? b.id : `build-${builds.length + 1}-${Date.now().toString(36)}`
      const items: { item_id: string; count: number }[] = []
      if (Array.isArray(b.items)) {
        for (const entry of b.items.slice(0, LIMITS.buildItems)) {
          const raw = isObj(entry) ? entry.item_id : entry
          const itemId = typeof raw === 'string' && /^[A-Za-z0-9_:-]{1,30}$/.test(raw) ? raw : undefined
          if (!itemId) continue
          items.push({ item_id: itemId, count: isObj(entry) ? (int(entry.count, 1, 99) ?? 1) : 1 })
        }
      }
      builds.push({ id, name: text(b.name, 60, warn, 'Build name') ?? `Build ${builds.length + 1}`, items })
    }
  }
  const section: DesktopSection = { base_stats, builds }
  if (typeof v.active_build_id === 'string' && builds.some(b => b.id === v.active_build_id)) {
    section.active_build_id = v.active_build_id
  }
  return section
}

// ─── Records and files ───────────────────────────────────────────────────────

export function sanitizeRecord(raw: unknown, includeDesktop: boolean, warnFile: Warn): ChampionRecord | undefined {
  if (!isObj(raw)) { warnFile('An entry that is not a champion was skipped'); return undefined }
  const rawName = isObj(raw.identity) && typeof raw.identity.name === 'string' ? raw.identity.name : ''
  const who = rawName ? `"${rawName.slice(0, 40)}"` : 'a champion'
  const warn: Warn = message => warnFile(`${who}: ${message}`)

  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) { warnFile(`Skipped ${who}: it has no valid id`); return undefined }
  const identity = sanitizeIdentity(raw.identity, warn)
  if (!identity) { warnFile(`Skipped ${who}: it has no name`); return undefined }
  const concept_updated_at = isoDate(raw.concept_updated_at) ?? isoDate(raw.created_at)
  if (!concept_updated_at) { warnFile(`Skipped ${who}: it has no valid date`); return undefined }

  const abilitiesRaw: Obj = isObj(raw.abilities) ? raw.abilities : {}
  const abilities = {} as Record<AbilitySlot, AbilityRecord>
  for (const slot of SLOTS) abilities[slot] = sanitizeAbility(abilitiesRaw[slot], slot, warn)

  const tags = stringList(raw.tags, LIMITS.tags, LIMITS.short, warn, 'Tag') ?? []

  const record: ChampionRecord = {
    id: raw.id,
    created_at: isoDate(raw.created_at) ?? concept_updated_at,
    concept_updated_at,
    tags,
    identity,
    abilities,
  }
  if (includeDesktop && raw.desktop !== undefined) {
    const desktop = sanitizeDesktop(raw.desktop, warn)
    if (desktop) record.desktop = desktop
  }
  return record
}

// The original (version 1) export wrote raw desktop records with their machine-local image paths.
// Lift those into the current shape; the paths and theme audio are dropped, since they point at
// files on another computer.
function fromLegacy(raw: unknown): unknown {
  if (!isObj(raw)) return raw
  const meta = isObj(raw.metadata) ? raw.metadata : {}
  const identity = isObj(raw.identity) ? raw.identity : {}
  const keptIdentity: Obj = { ...identity }
  delete keptIdentity.image_path
  delete keptIdentity.theme_audio
  return {
    id: meta.id,
    created_at: meta.created_at,
    concept_updated_at: meta.updated_at,
    tags: meta.tags,
    identity: keptIdentity,
    abilities: raw.abilities,
    desktop: { base_stats: raw.base_stats, builds: raw.builds, active_build_id: raw.active_build_id },
  }
}

function legacyHadFiles(raw: unknown): boolean {
  if (!isObj(raw)) return false
  const identity = isObj(raw.identity) ? raw.identity : {}
  if (identity.image_path || identity.theme_audio) return true
  const abilities = isObj(raw.abilities) ? raw.abilities : {}
  return SLOTS.some(s => isObj(abilities[s]) && !!(abilities[s] as Obj).icon_path)
}

export function parseInterchange(raw: unknown, options: ParseOptions = {}): ParseResult {
  const includeDesktop = options.includeDesktop ?? true
  const warnings: string[] = []
  const warn: Warn = message => { if (warnings.length < 200) warnings.push(message) }

  let scope: Scope
  let version: number
  let entries: unknown[]

  if (Array.isArray(raw)) {
    version = 1; scope = 'full'; entries = raw
  } else if (isObj(raw)) {
    if (raw.format !== undefined && raw.format !== FORMAT) return { ok: false, error: 'This file is not a Summoner export' }
    if (raw.format === undefined && !Array.isArray(raw.champions)) return { ok: false, error: 'This file is not a Summoner export' }
    version = raw.version === undefined ? 1 : (raw.version as number)
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { ok: false, error: 'This file has an unreadable version number' }
    if (version > VERSION) return { ok: false, error: 'This file was made by a newer version of Summoner. Update the app and try again' }
    if (version === 1) {
      scope = 'full'
    } else if (raw.scope === 'concept' || raw.scope === 'full') {
      scope = raw.scope
    } else {
      return { ok: false, error: 'This file does not say what it contains' }
    }
    if (!Array.isArray(raw.champions)) return { ok: false, error: 'This file does not contain a champions list' }
    entries = raw.champions
  } else {
    return { ok: false, error: 'This file is not a Summoner export' }
  }

  if (entries.length > LIMITS.champions) {
    return { ok: false, error: `This file has ${entries.length} champions; the limit is ${LIMITS.champions}` }
  }

  const records: ChampionRecord[] = []
  const seen = new Set<string>()
  let legacyFiles = false
  for (const entry of entries) {
    if (version === 1 && legacyHadFiles(entry)) legacyFiles = true
    const record = sanitizeRecord(version === 1 ? fromLegacy(entry) : entry, includeDesktop && scope === 'full', warn)
    if (!record) continue
    if (seen.has(record.id)) { warn(`"${record.identity.name}": a second copy with the same id was skipped`); continue }
    seen.add(record.id)
    if (scope === 'concept') delete record.desktop
    records.push(record)
  }
  if (legacyFiles) warn('This is an older export file: splash art, ability icons and theme audio are not in it')

  const file: ParsedFile = { scope, version, records, warnings }
  return { ok: true, file }
}

export function parseInterchangeText(source: string, options: ParseOptions = {}): ParseResult {
  if (source.length > (options.maxBytes ?? LIMITS.fileBytes)) return { ok: false, error: 'This file is too large to import' }
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    return { ok: false, error: 'This file is not valid JSON' }
  }
  return parseInterchange(raw, options)
}
