import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from './useSettings'
import { useMusicTracks } from './useMusicTracks'
import { useUpdater } from '../updater/useUpdater'
import type { ThemeMode } from './types'
import type { ImportPlanSummary } from '../champion/importTypes'
import ImportPanel from './ImportPanel'
import './SettingsPage.css'

const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'system', label: 'System' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { settings, update, apply } = useSettings()
  const { tracks, current, builtInIds } = useMusicTracks()
  const [dataStatus, setDataStatus] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)
  const [importPlan, setImportPlan] = useState<ImportPlanSummary | null>(null)
  const { state: updateState, currentVersion } = useUpdater()

  // The volume slider moves in 1% steps, so a drag fires a lot of changes. Show and apply each
  // one instantly (local value + optimistic store update so playback follows the thumb) but only
  // write to the database once the slider settles.
  const [volume, setVolume] = useState(settings.music_volume)
  const volumeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (volumeSaveTimer.current) clearTimeout(volumeSaveTimer.current) }, [])
  function handleVolume(v: number) {
    setVolume(v)
    apply({ ...settings, music_volume: v })
    if (volumeSaveTimer.current) clearTimeout(volumeSaveTimer.current)
    volumeSaveTimer.current = setTimeout(() => window.summoner.settings.update({ music_volume: v }), 250)
  }
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

  async function handleExport(scope: 'full' | 'concept') {
    setDataStatus(null)
    setDataError(null)
    const result = await window.summoner.data.exportChampions(scope)
    if (result.ok) setDataStatus(`Exported ${result.count} champion${result.count === 1 ? '' : 's'} to ${result.path}`)
    else if (result.error !== 'Cancelled') setDataError(result.error ?? 'Export failed')
  }

  async function handleImport() {
    setDataStatus(null)
    setDataError(null)
    const result = await window.summoner.data.importPick()
    if (result.ok) setImportPlan(result)
    else if (result.error !== 'Cancelled') setDataError(result.error)
  }

  function cancelImport() {
    setImportPlan(null)
    window.summoner.data.importCancel()
  }

  return (
    <div className="settings-root">
      <div className="settings-top-bar">
        {/* Back returns to whatever screen opened Settings (an editor, the store, …); the
            gallery is only the fallback when Settings was the first screen. */}
        <button
          className="settings-back-btn"
          onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/'))}
        >
          ← Back
        </button>
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
          <div className="settings-section-title">Abilities</div>
          <div className="settings-section-desc">
            Each effect asks only what it does and how much. Its extras (what it scales with, its name, notes, who it affects) can sit in a
            collapsed More under the effect, or have a tab of their own.
          </div>
          <div className="settings-btn-row">
            {([['inline', 'Under each effect'], ['tab', 'On an Advanced tab']] as const).map(([key, label]) => (
              <button
                key={key}
                className={`settings-option-btn${settings.effect_details === key ? ' active' : ''}`}
                onClick={() => update({ effect_details: key })}
              >
                {label}
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
                  step={0.01}
                  value={volume}
                  onChange={e => handleVolume(parseFloat(e.target.value))}
                />
                <span className="settings-slider-value">{Math.round(volume * 100)}%</span>
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
            A backup holds everything. The mobile export holds only what Summoner Mobile uses: story, identity, and each
            ability's icon, name, description, notes and blocks (without their numbers). Importing updates champions it
            recognises and never replaces your stats, builds or ability numbers.
          </div>
          <div className="settings-btn-row">
            <button className="settings-secondary-btn" onClick={() => handleExport('full')}>Export backup…</button>
            <button className="settings-secondary-btn" onClick={() => handleExport('concept')}>Export for mobile…</button>
            <button className="settings-secondary-btn" onClick={handleImport} disabled={importPlan !== null}>Import…</button>
          </div>
          {importPlan && (
            <ImportPanel
              plan={importPlan}
              onCancel={cancelImport}
              onDone={message => { setImportPlan(null); setDataStatus(message) }}
              onError={message => { setImportPlan(null); setDataError(message) }}
            />
          )}
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
