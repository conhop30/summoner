// JSON export and import (the interchange format in contract/SPEC.md), main-process side.
// The pure logic lives in src/interchange and src/champion/exchange; this file only does what
// needs Electron: file dialogs, reading and writing files, and shrinking images.

import { app, dialog, ipcMain, nativeImage, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Database } from 'better-sqlite3'
import { getAllChampions, getChampion, upsertChampionRecord } from '../src/champion/crud'
import {
  actionFor, championToRecord, classify, recordToChampion,
  type ImageKind, type ImportStatus, type LocalNewerChoice, type ResolvedAssets,
} from '../src/champion/exchange'
import { LIMITS, parseInterchangeText } from '../src/interchange/sanitize'
import { FORMAT, SLOTS, VERSION, type ChampionRecord, type ExportFile, type ImageRef, type Scope } from '../src/interchange/types'
import type { Champion } from '../src/champion/types'
import type { ImportPlanSummary, PlanItem } from '../src/champion/importTypes'

const IMAGE_LIMITS: Record<ImageKind, { maxSide: number }> = {
  splash: { maxSide: 1920 },
  icon: { maxSide: 256 },
}
const MAX_DECODED_BYTES = 3 * 1024 * 1024
const MIME_BY_EXT: Record<string, ImageRef['mime']> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
}
const EXT_BY_MIME: Record<ImageRef['mime'], string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
}

function imagesDir(): string {
  const dir = path.join(app.getPath('userData'), 'images')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// app-asset:// URLs point at files under userData/images. Anything else is refused, so a hand-edited
// champion can't make an export read (or an import delete) some other file.
function localImagePath(assetUrl: string): string | undefined {
  try {
    const file = path.resolve(decodeURIComponent(assetUrl.replace('app-asset://', '')))
    const dir = path.resolve(imagesDir()) + path.sep
    const inside = process.platform === 'win32' ? file.toLowerCase().startsWith(dir.toLowerCase()) : file.startsWith(dir)
    return inside && fs.existsSync(file) ? file : undefined
  } catch {
    return undefined
  }
}

function encodeImage(file: string, kind: ImageKind): ImageRef | undefined {
  const { maxSide } = IMAGE_LIMITS[kind]
  let image = nativeImage.createFromPath(file)
  if (!image.isEmpty()) {
    const { width, height } = image.getSize()
    const scale = Math.min(1, maxSide / Math.max(width, height))
    if (scale < 1) image = image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' })
    // Splash art is photographic (JPEG); icons may have transparency (PNG).
    const attempts = kind === 'splash' ? [88, 75, 60] : [0]
    for (const quality of attempts) {
      const buffer = kind === 'splash' ? image.toJPEG(quality) : image.toPNG()
      if (buffer.length <= MAX_DECODED_BYTES) {
        return { mime: kind === 'splash' ? 'image/jpeg' : 'image/png', data: buffer.toString('base64') }
      }
    }
    return undefined
  }
  // nativeImage can't decode WebP; embed those untouched when they're small enough.
  const mime = MIME_BY_EXT[path.extname(file).toLowerCase()]
  const raw = fs.readFileSync(file)
  return mime && raw.length <= MAX_DECODED_BYTES ? { mime, data: raw.toString('base64') } : undefined
}

function imageOf(assetUrl: string, kind: ImageKind): ImageRef | undefined {
  const file = localImagePath(assetUrl)
  return file ? encodeImage(file, kind) : undefined
}

function writeImage(ref: ImageRef, name: string): string {
  const dest = path.join(imagesDir(), `${name}${EXT_BY_MIME[ref.mime]}`)
  fs.writeFileSync(dest, Buffer.from(ref.data, 'base64'))
  return `app-asset://${encodeURIComponent(dest)}`
}

function removeLocalImage(assetUrl: string | undefined) {
  const file = assetUrl ? localImagePath(assetUrl) : undefined
  if (file) fs.rmSync(file, { force: true })
}

// ─── Import plan ─────────────────────────────────────────────────────────────

interface Pending {
  id: string
  scope: Scope
  records: ChampionRecord[]
  statuses: ImportStatus[]
}

let pending: Pending | null = null

function materialize(record: ChampionRecord): ResolvedAssets {
  const stamp = Date.now()
  const assets: ResolvedAssets = { icons: {} }
  if (record.identity.splash) assets.splash = writeImage(record.identity.splash, `${record.id}_${stamp}`)
  for (const slot of SLOTS) {
    const icon = record.abilities[slot].icon
    if (icon) assets.icons[slot] = writeImage(icon, `${record.id}_${slot}_icon_${stamp}`)
  }
  return assets
}

export function registerDataHandlers(db: Database, getWindow: () => BrowserWindow | null) {
  ipcMain.handle('data:exportChampions', async (_event, scopeArg: unknown) => {
    const win = getWindow()
    if (!win) return { ok: false, error: 'No window' }
    const scope: Scope = scopeArg === 'concept' ? 'concept' : 'full'

    const champions = getAllChampions(db)
    if (champions.length === 0) return { ok: false, error: 'There are no champions to export yet' }

    const stamp = new Date().toISOString().slice(0, 10)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: scope === 'concept' ? 'Export for Summoner Mobile' : 'Export backup',
      defaultPath: scope === 'concept' ? `summoner-for-mobile-${stamp}.json` : `summoner-backup-${stamp}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { ok: false, error: 'Cancelled' }

    const records = champions
      .map(c => championToRecord(c, scope, imageOf))
      .filter((r): r is ChampionRecord => r !== undefined)
    const payload: ExportFile = {
      format: FORMAT,
      version: VERSION,
      scope,
      exported_at: new Date().toISOString(),
      source: { app: 'summoner-desktop', app_version: app.getVersion() },
      champions: records,
    }
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf-8')
    return { ok: true, path: filePath, count: records.length }
  })

  // Step 1: choose a file and work out what importing it would do. Nothing is written yet.
  ipcMain.handle('data:importPick', async () => {
    const win = getWindow()
    if (!win) return { ok: false, error: 'No window' }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Import champions',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePaths[0]) return { ok: false, error: 'Cancelled' }

    const file = filePaths[0]
    if (fs.statSync(file).size > LIMITS.fileBytes) return { ok: false, error: 'This file is too large to import' }
    const parsed = parseInterchangeText(fs.readFileSync(file, 'utf-8'))
    if (!parsed.ok) return { ok: false, error: parsed.error }

    const { records, scope, warnings } = parsed.file
    if (records.length === 0) {
      return { ok: false, error: warnings.length > 0 ? warnings[0] : 'This file has no champions in it' }
    }
    const statuses = records.map(r => classify(getChampion(db, r.id) ?? undefined, r))
    pending = { id: randomUUID(), scope, records, statuses }

    const items: PlanItem[] = records.map((r, i) => ({
      id: r.id,
      name: r.identity.name,
      status: statuses[i],
      incomingAt: r.concept_updated_at,
      localAt: getChampion(db, r.id)?.metadata.concept_updated_at ?? undefined,
    }))
    const summary: ImportPlanSummary = { ok: true, planId: pending.id, fileName: path.basename(file), scope, items, warnings }
    return summary
  })

  // Step 2: do it. `choice` only matters for champions that are newer here than in the file.
  ipcMain.handle('data:importApply', async (_event, planId: unknown, choiceArg: unknown) => {
    if (!pending || pending.id !== planId) return { ok: false, error: 'That import is no longer available. Choose the file again' }
    const choice: LocalNewerChoice = choiceArg === 'take-theirs' || choiceArg === 'keep-both' ? choiceArg : 'keep-mine'
    const plan = pending
    pending = null

    const result = { ok: true as const, added: 0, updated: 0, copies: 0, skipped: 0 }
    const writes: Champion[] = []
    const replacedImages: (string | undefined)[] = []
    try {
      plan.records.forEach((record, i) => {
        const action = actionFor(plan.statuses[i], choice)
        if (action === 'skip') { result.skipped++; return }
        const existing = getChampion(db, record.id)
        const asCopy = action === 'copy'
        const assets = materialize(record)
        if (!asCopy && existing) {
          replacedImages.push(existing.identity.image_path)
          for (const slot of SLOTS) replacedImages.push(existing.abilities[slot].icon_path)
        }
        writes.push(recordToChampion(record, asCopy ? null : existing, assets, { asCopy }))
        if (asCopy) result.copies++
        else if (existing) result.updated++
        else result.added++
      })
      db.transaction(() => { for (const champion of writes) upsertChampionRecord(db, champion) })()
      // Only once the database has the new champions: drop the image files they replaced.
      for (const old of replacedImages) removeLocalImage(old)
    } catch (err) {
      console.error('[main] import failed', err)
      return { ok: false, error: 'The import failed part-way; nothing was changed in your library' }
    }
    return result
  })

  ipcMain.handle('data:importCancel', () => { pending = null })
}
