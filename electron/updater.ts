import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import type { UpdateState } from '../src/updater/types'

// electron-updater is CommonJS; load it the same way the rest of the main process
// loads native modules so the ESM bundle doesn't try to inline it.
const require = createRequire(import.meta.url)
const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')

// Test hook: point the updater at any generic feed (a folder served over HTTP holding
// latest.yml + the installer) instead of GitHub Releases. Unset in normal use.
const FEED_OVERRIDE = process.env.SUMMONER_UPDATE_FEED_URL

const enabled = app.isPackaged || !!FEED_OVERRIDE

let state: UpdateState = { status: enabled ? 'idle' : 'disabled' }
// Only surface a failed check when the user asked for it; a silent launch-time check
// that fails (offline, rate-limited, no release manifest yet) should never nag.
let manualCheck = false

function setState(next: UpdateState) {
  state = next
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('updater:state', state)
}

async function check(manual: boolean) {
  if (!enabled) return
  if (['checking', 'downloading', 'downloaded'].includes(state.status)) return
  manualCheck = manual
  try {
    await autoUpdater.checkForUpdates()
  } catch {
    // Already reported through the 'error' event below.
  }
}

export function initUpdater() {
  if (FEED_OVERRIDE) {
    autoUpdater.setFeedURL({ provider: 'generic', url: FEED_OVERRIDE })
    autoUpdater.forceDevUpdateConfig = true
  }
  // Nothing downloads until the user says so. Once they have, an update that's been
  // downloaded but not yet applied installs when the app is next closed.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setState({ status: 'checking' }))
  autoUpdater.on('update-not-available', () => setState({ status: manualCheck ? 'not-available' : 'idle' }))
  autoUpdater.on('update-available', info => setState({ status: 'available', version: info.version }))
  autoUpdater.on('download-progress', p =>
    setState({ status: 'downloading', version: state.version, percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', info => setState({ status: 'downloaded', version: info.version }))
  autoUpdater.on('error', err => {
    const raw = String(err?.message ?? err ?? '')
    console.warn('[updater]', raw)
    if (!manualCheck) return setState({ status: 'idle' })
    // A release with no latest.yml just means nothing updater-enabled has been published.
    if (/latest\.yml/.test(raw) && /404/.test(raw)) return setState({ status: 'not-available' })
    setState({ status: 'error', message: raw.split('\n')[0].slice(0, 160) || 'Update check failed' })
  })

  ipcMain.handle('updater:getVersion', () => app.getVersion())
  ipcMain.handle('updater:getState', () => state)
  ipcMain.handle('updater:check', () => check(true))
  ipcMain.handle('updater:download', async () => {
    if (state.status !== 'available') return
    manualCheck = true
    try {
      await autoUpdater.downloadUpdate()
    } catch {
      // Reported through the 'error' event.
    }
  })
  ipcMain.handle('updater:install', () => {
    if (state.status === 'downloaded') autoUpdater.quitAndInstall(true, true)
  })

  // Give the window a moment to finish loading so the banner isn't competing with startup.
  if (enabled) setTimeout(() => check(false), 3000)
}
