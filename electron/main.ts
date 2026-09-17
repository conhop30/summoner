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
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    frame: !settings.window_frameless,
    fullscreen: settings.window_fullscreen,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

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
    return deleteChampion(db, id)
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

  ipcMain.handle('settings:getAll', () => {
    return getSettings(db)
  })

  ipcMain.handle('settings:update', (_event, partial) => {
    return updateSettings(db, partial)
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

app.whenReady().then(() => {
  protocol.handle('app-asset', (request) => {
    const url = request.url.replace('app-asset://', '')
    return net.fetch('file://' + decodeURIComponent(url))
  })
  registerIpcHandlers()
  createWindow()
})
