import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from './useSettings'
import type { ThemeMode } from './types'
import './SettingsPage.css'

const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'system', label: 'System' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { settings, update } = useSettings()
  const [dataStatus, setDataStatus] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)

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
          <div className="settings-section-desc">
            Background music while you work. Drop an audio file at{' '}
            <code>public/audio/theme.mp3</code> to enable playback — nothing plays until that file exists.
          </div>
          <label className="settings-toggle-row">
            <input
              type="checkbox"
              checked={settings.music_enabled}
              onChange={e => update({ music_enabled: e.target.checked })}
            />
            Enable music
          </label>
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
      </div>
    </div>
  )
}
