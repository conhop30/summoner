// The Summoner interchange format, version 2 — the contract between Summoner (desktop) and
// Summoner Mobile. See contract/SPEC.md. This folder has NO imports from the rest of the app and
// no runtime dependencies: Summoner Mobile vendors an identical copy, so keep it that way.

export const FORMAT = 'summoner-export'
export const VERSION = 2

// 'concept'  — what a champion IS: identity, lore, splash art, and each ability's name, description
//              and icon. Both apps read and write it.
// 'full'     — concept plus the desktop-owned part: base stats, item builds, and every ability's
//              numbers, blocks and notes. Only desktop writes it.
export type Scope = 'concept' | 'full'

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp'

// Images travel inside the file, base64 encoded. Never a path or URL: a path on one machine
// means nothing (or something dangerous) on another.
export interface ImageRef {
  mime: ImageMime
  data: string
}

export type AbilitySlot = 'passive' | 'q' | 'w' | 'e' | 'r'
export const SLOTS: AbilitySlot[] = ['passive', 'q', 'w', 'e', 'r']

export interface RatioEntry { stat: string; values: number[] }

export interface Effect {
  type: string
  damage_type?: 'Physical' | 'Magic' | 'True'
  base?: number[]
  ratios?: RatioEntry[]
  duration?: number[]
  notes?: string
}

export interface RecastStruct {
  max_recasts: number
  recast_window: number
  recast_static_cooldown?: number
  recast_extends_on?: string
}

export interface AbilityBody {
  name?: string
  description?: string
  cooldown?: number[]
  cost?: number[]
  cost_type?: string
  effects?: Effect[]
}

export type BlockKind = 'passive' | 'alternate_form' | 'recast'

export interface AbilityBlock extends AbilityBody {
  kind: BlockKind
  recast?: RecastStruct
}

export interface JournalTab { id: string; name: string; content: string; created_at: string }

// The conceptual face of an ability: what the phone shows and edits.
export interface AbilityText {
  name?: string
  description?: string
  icon?: ImageRef
}

// Everything else about an ability. Desktop-owned; travels only in a 'full' file.
export interface AbilityDetails extends AbilityBody {
  max_rank: number
  extra?: { recast?: RecastStruct; [key: string]: string | number | boolean | RecastStruct | undefined }
  journal?: { tabs: JournalTab[] }
  blocks?: AbilityBlock[]
}

export interface IdentityRecord {
  name: string
  title?: string
  lore?: string
  class?: string[]
  role?: string[]
  attack_type?: string[]
  resource_type?: string
  playstyle?: string[]
  image_position?: { x: number; y: number }
  splash?: ImageRef
}

// The desktop-owned part. Present only when scope is 'full'. Summoner Mobile ignores it.
export interface DesktopSection {
  base_stats: Record<string, number | number[]>
  builds: { id: string; name: string; items: { item_id: string; count: number }[] }[]
  active_build_id?: string
  abilities: Record<AbilitySlot, AbilityDetails>
}

export interface ChampionRecord {
  id: string
  created_at: string
  // When the concept content (identity, ability names/descriptions/icons, tags) last changed. Decides who is newer on
  // import. Editing only desktop-owned data (stats, builds) does not move it.
  concept_updated_at: string
  tags: string[]
  identity: IdentityRecord
  abilities: Record<AbilitySlot, AbilityText>
  desktop?: DesktopSection
}

export interface ExportFile {
  format: typeof FORMAT
  version: typeof VERSION
  scope: Scope
  exported_at: string
  source?: { app: string; app_version?: string }
  champions: ChampionRecord[]
}

export interface ParsedFile {
  scope: Scope
  // The version the file was written as (1 = the original, pre-mobile desktop export).
  version: number
  records: ChampionRecord[]
  // One line per thing the importer dropped or trimmed. Shown to the user, never silent.
  warnings: string[]
}

export type ParseResult = { ok: true; file: ParsedFile } | { ok: false; error: string }
