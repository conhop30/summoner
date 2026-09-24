import { app, BrowserWindow, ipcMain, protocol, net, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection', reason)
})

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

import { initUpdater } from './updater'
import { getDb } from '../src/db/connection'
import {
  createChampion,
  getChampion,
  getAllChampions,
  updateChampion,
  deleteChampion,
  upsertChampionRecord,
} from '../src/champion/crud'
import { syncItems, getAllItems, getItem, getSyncStatus } from '../src/item/crud'
import { syncChampionCatalog, getAllChampionCatalog, getChampionCatalogSyncStatus } from '../src/championCatalog/crud'
import { getSettings, updateSettings } from '../src/settings/crud'

const EXPORT_FORMAT = 'summoner-export'
const EXPORT_VERSION = 1

let win: BrowserWindow | null
let currentFrameless = false

function createWindow() {
  const db = getDb()
  const settings = getSettings(db)
  currentFrameless = settings.window_frameless

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(process.env.VITE_PUBLIC, 'summoner-logo.png'),
    frame: !settings.window_frameless,
    fullscreen: settings.window_fullscreen,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Fullscreen is chrome-free: the header hides its window buttons and shows in-app
  // navigation, and the native File/Edit/View/Window/Help menu bar goes too. Windowed mode
  // gets both back.
  const applyFullScreen = (on: boolean) => {
    win?.setMenuBarVisibility(!on)
    win?.webContents.send('window:fullscreenChanged', on)
  }
  win.on('enter-full-screen', () => applyFullScreen(true))
  win.on('leave-full-screen', () => applyFullScreen(false))
  // A window created fullscreen never fires enter-full-screen for its initial state.
  if (settings.window_fullscreen) win.setMenuBarVisibility(false)

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  const db = getDb()
  const fs = require('fs')

  ipcMain.handle('champion:saveImage', async (_event, sourcePath: string, championId: string) => {
    const imageDir = path.join(app.getPath('userData'), 'images')
    if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true })
    const ext = path.extname(sourcePath)
    const destPath = path.join(imageDir, `${championId}${ext}`)
    fs.copyFileSync(sourcePath, destPath)
    return `app-asset://${encodeURIComponent(destPath)}`
  })

  ipcMain.handle('champion:create', (_event, name: string, partial?) => {
    return createChampion(db, name, partial)
  })

  ipcMain.handle('champion:get', (_event, id: string) => {
    return getChampion(db, id)
  })

  ipcMain.handle('champion:getAll', () => {
    return getAllChampions(db)
  })

  ipcMain.handle('champion:update', (_event, id: string, updates) => {
    return updateChampion(db, id, updates)
  })

  ipcMain.handle('champion:delete', (_event, id: string) => {
    const deleted = deleteChampion(db, id)
    if (deleted && id) {
      // Splash art and ability icons are saved as `<championId>*` — drop them with the champion.
      const imageDir = path.join(app.getPath('userData'), 'images')
      try {
        for (const f of fs.readdirSync(imageDir)) {
          if (f.startsWith(id)) fs.unlinkSync(path.join(imageDir, f))
        }
      } catch {
        // No images folder, or a file is locked — leftover files are harmless.
      }
    }
    return deleted
  })

  ipcMain.handle('item:sync', async () => {
    return syncItems(db)
  })

  ipcMain.handle('item:getAll', () => {
    return getAllItems(db)
  })

  ipcMain.handle('item:get', (_event, id: string) => {
    return getItem(db, id)
  })

  ipcMain.handle('item:getSyncStatus', () => {
    return getSyncStatus(db)
  })

  ipcMain.handle('championCatalog:sync', async () => {
    return syncChampionCatalog(db)
  })

  ipcMain.handle('championCatalog:getAll', () => {
    return getAllChampionCatalog(db)
  })

  ipcMain.handle('championCatalog:getSyncStatus', () => {
    return getChampionCatalogSyncStatus(db)
  })

  ipcMain.handle('settings:getAll', () => {
    return getSettings(db)
  })

  ipcMain.handle('settings:update', (_event, partial) => {
    return updateSettings(db, partial)
  })

  // ── Background music ──
  // Built-in songs are whatever audio files ship in public/audio (dev) / dist/audio (packaged).
  const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac']
  const musicDir = () => path.join(app.getPath('userData'), 'music')

  ipcMain.handle('music:listBuiltIn', () => {
    const dir = path.join(process.env.VITE_PUBLIC, 'audio')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter((f: string) => AUDIO_EXTS.includes(path.extname(f).toLowerCase()))
      .sort()
      .map((f: string) => ({
        id: `builtin:${f}`,
        name: path.basename(f, path.extname(f)),
        src: `audio/${encodeURIComponent(f)}`,
      }))
  })

  // Copies the picked files into the app's data folder (same approach as splash art), so
  // they keep playing if the originals move. Returns the updated settings.
  ipcMain.handle('music:addCustom', async () => {
    if (!win) return getSettings(db)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Add music',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio', extensions: AUDIO_EXTS.map(e => e.slice(1)) }],
    })
    if (canceled || filePaths.length === 0) return getSettings(db)

    fs.mkdirSync(musicDir(), { recursive: true })
    const added = filePaths.map((p: string) => {
      const ext = path.extname(p)
      const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const dest = path.join(musicDir(), `${stamp}${ext}`)
      fs.copyFileSync(p, dest)
      return { id: `custom:${stamp}`, name: path.basename(p, ext), src: `app-asset://${encodeURIComponent(dest)}` }
    })
    const current = getSettings(db)
    return updateSettings(db, {
      music_custom_tracks: [...current.music_custom_tracks, ...added],
      music_track: added[0].id,
    })
  })

  ipcMain.handle('music:removeCustom', (_event, id: string) => {
    const current = getSettings(db)
    const track = current.music_custom_tracks.find(t => t.id === id)
    if (!track) return current
    try {
      fs.unlinkSync(decodeURIComponent(track.src.replace('app-asset://', '')))
    } catch {
      // File already gone — still drop the entry.
    }
    return updateSettings(db, {
      music_custom_tracks: current.music_custom_tracks.filter(t => t.id !== id),
      music_track: current.music_track === id ? '' : current.music_track,
    })
  })

  ipcMain.handle('window:isFrameless', () => {
    return currentFrameless
  })

  ipcMain.handle('window:minimize', () => {
    win?.minimize()
  })

  ipcMain.handle('window:toggleMaximize', () => {
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle('window:close', () => {
    win?.close()
  })

  ipcMain.handle('window:isFullScreen', () => {
    return win?.isFullScreen() ?? false
  })

  ipcMain.handle('window:toggleFullScreen', () => {
    if (!win) return
    win.setFullScreen(!win.isFullScreen())
  })

  ipcMain.handle('data:exportChampions', async () => {
    if (!win) return { ok: false, error: 'No window' }
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export champions',
      defaultPath: `summoner-champions-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { ok: false, error: 'Cancelled' }

    const champions = getAllChampions(db)
    const payload = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      champions,
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return { ok: true, path: filePath, count: champions.length }
  })

  ipcMain.handle('data:importChampions', async () => {
    if (!win) return { ok: false, error: 'No window' }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Import champions',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePaths[0]) return { ok: false, error: 'Cancelled' }

    let parsed: any
    try {
      parsed = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))
    } catch {
      return { ok: false, error: 'File is not valid JSON' }
    }

    const champions = Array.isArray(parsed) ? parsed : parsed?.champions
    if (parsed?.format && parsed.format !== EXPORT_FORMAT) {
      return { ok: false, error: `Unrecognized export format "${parsed.format}"` }
    }
    if (!Array.isArray(champions)) {
      return { ok: false, error: 'File does not contain a champions array' }
    }

    for (const champion of champions) {
      if (!champion?.metadata?.id || !champion?.identity?.name) continue
      upsertChampionRecord(db, champion)
    }

    return { ok: true, count: champions.length }
  })
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Audio elements only load from a custom scheme if it's declared streamable (they issue
// range requests); images never needed this. Deliberately not `standard`, so the existing
// app-asset:// URLs stored on champions keep parsing exactly as they do today.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-asset', privileges: { stream: true, supportFetchAPI: true } },
])

app.whenReady().then(() => {
  protocol.handle('app-asset', (request) => {
    const url = request.url.replace('app-asset://', '')
    return net.fetch('file://' + decodeURIComponent(url))
  })
  registerIpcHandlers()
  initUpdater()
  createWindow()
})
