import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from './useSettings'
import { useMusicTracks } from './useMusicTracks'
import { useUpdater } from '../updater/useUpdater'
import type { ThemeMode } from './types'
import './SettingsPage.css'

const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'system', label: 'System' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { settings, update, apply } = useSettings()
  const { tracks, current, builtInIds } = useMusicTracks()
  const [dataStatus, setDataStatus] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)
  const { state: updateState, currentVersion } = useUpdater()
  const updateBusy = ['checking', 'downloading', 'downloaded'].includes(updateState.status)
  const updateMessage = {
    disabled: 'Updates are only available in the installed app, not when running from source.',
    'not-available': "You're on the latest version.",
    available: `Version ${updateState.version} is available.`,
    downloading: `Downloading ${updateState.version}… ${updateState.percent ?? 0}%`,
    downloaded: `Version ${updateState.version} is downloaded and ready to install.`,
    error: updateState.message,
    idle: '',
    checking: '',
  }[updateState.status]

  async function handleExport() {
    setDataStatus(null)
    setDataError(null)
    const result = await window.summoner.data.exportChampions()
    if (result.ok) setDataStatus(`Exported ${result.count} champion${result.count === 1 ? '' : 's'} to ${result.path}`)
    else if (result.error !== 'Cancelled') setDataError(result.error ?? 'Export failed')
  }

  async function handleImport() {
    setDataStatus(null)
    setDataError(null)
    const result = await window.summoner.data.importChampions()
    if (result.ok) setDataStatus(`Imported ${result.count} champion${result.count === 1 ? '' : 's'}`)
    else if (result.error !== 'Cancelled') setDataError(result.error ?? 'Import failed')
  }

  return (
    <div className="settings-root">
      <div className="settings-top-bar">
        <button className="settings-back-btn" onClick={() => navigate('/')}>← Gallery</button>
        <span className="settings-title">Settings</span>
      </div>

      <div className="settings-body">
        <section className="settings-section">
          <div className="settings-section-title">Appearance</div>
          <div className="settings-section-desc">Choose how Summoner looks.</div>
          <div className="settings-btn-row">
            {THEME_OPTIONS.map(o => (
              <button
                key={o.key}
                className={`settings-option-btn${settings.theme === o.key ? ' active' : ''}`}
                onClick={() => update({ theme: o.key })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-title">Music</div>
          <label className="settings-toggle-row music-master-toggle">
            <input
              type="checkbox"
              checked={settings.music_enabled}
              onChange={e => update({ music_enabled: e.target.checked })}
            />
            Play background music
          </label>
          {!settings.music_enabled && (
            <div className="settings-section-desc">Music is off. Turn it on to pick a song or add your own.</div>
          )}
          {settings.music_enabled && (
            <>
              <div className="settings-section-desc">
                Pick a song to loop, or add your own — added files are copied into Summoner, so they keep
                working if you move the originals.
              </div>
              <div className="music-track-list" role="radiogroup" aria-label="Background music track">
                {tracks.length === 0 && <div className="music-track-empty">No songs yet. Add one below.</div>}
                {tracks.map(t => {
                  const isBuiltIn = builtInIds.has(t.id)
                  const selected = current?.id === t.id
                  return (
                    <div key={t.id} className={`music-track${selected ? ' selected' : ''}`}>
                      <button
                        className="music-track-pick"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => update({ music_track: t.id })}
                      >
                        <span className="music-track-name">{t.name}</span>
                        <span className="music-track-tag">{isBuiltIn ? 'Built-in' : 'Yours'}</span>
                      </button>
                      {!isBuiltIn && (
                        <button
                          className="music-track-remove"
                          title="Remove this song"
                          onClick={async () => apply(await window.summoner.music.removeCustom(t.id))}
                        >×</button>
                      )}
                    </div>
                  )
                })}
              </div>
              <button
                className="settings-secondary-btn"
                onClick={async () => apply(await window.summoner.music.addCustom())}
              >
                Add music…
              </button>
              <label className="settings-slider-row">
                <span>Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.music_volume}
                  onChange={e => update({ music_volume: parseFloat(e.target.value) })}
                />
                <span className="settings-slider-value">{Math.round(settings.music_volume * 100)}%</span>
              </label>
            </>
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section-title">Window</div>
          <div className="settings-section-desc">Changes to these take effect the next time you launch Summoner.</div>
          <label className="settings-toggle-row">
            <input
              type="checkbox"
              checked={settings.window_fullscreen}
              onChange={e => update({ window_fullscreen: e.target.checked })}
            />
            Launch fullscreen
          </label>
          <label className="settings-toggle-row">
            <input
              type="checkbox"
              checked={settings.window_frameless}
              onChange={e => update({ window_frameless: e.target.checked })}
            />
            Frameless window (hide the title bar)
          </label>
          <button
            className="settings-secondary-btn"
            onClick={() => window.summoner.windowControls.toggleFullScreen()}
          >
            Toggle fullscreen now
          </button>
        </section>

        <section className="settings-section">
          <div className="settings-section-title">Data</div>
          <div className="settings-section-desc">
            Export your champions to a JSON file, or import one — handy for moving your work to another computer.
          </div>
          <div className="settings-btn-row">
            <button className="settings-secondary-btn" onClick={handleExport}>Export to JSON…</button>
            <button className="settings-secondary-btn" onClick={handleImport}>Import from JSON…</button>
          </div>
          {dataStatus && <div className="settings-data-status">{dataStatus}</div>}
          {dataError && <div className="settings-data-error">{dataError}</div>}
        </section>

        <section className="settings-section">
          <div className="settings-section-title">Updates</div>
          <div className="settings-section-desc">
            Summoner checks for a newer version each time it launches. Version {currentVersion || '…'}.
          </div>
          <div className="settings-btn-row">
            <button
              className="settings-secondary-btn"
              onClick={() => window.summoner.updater.check()}
              disabled={updateBusy || updateState.status === 'disabled'}
            >
              {updateState.status === 'checking' ? 'Checking…' : 'Check for updates'}
            </button>
            {updateState.status === 'available' && (
              <button className="settings-secondary-btn" onClick={() => window.summoner.updater.download()}>
                Download {updateState.version}
              </button>
            )}
            {updateState.status === 'downloaded' && (
              <button className="settings-secondary-btn" onClick={() => window.summoner.updater.install()}>
                Restart to install {updateState.version}
              </button>
            )}
          </div>
          {updateMessage && <div className={updateState.status === 'error' ? 'settings-data-error' : 'settings-data-status'}>{updateMessage}</div>}
        </section>
      </div>
    </div>
  )
}
