import { useState } from 'react'
import type { BaseStats, Champion } from '../champion/types'
import { useChampionCatalog } from '../championCatalog/useChampionCatalog'
import { computeClassAverages, getPresetSuggestions } from '../championCatalog/suggestions'
import './StatSuggestions.css'

interface Props {
  champion: Champion
  onAccept: (stats: Partial<BaseStats>) => void
}

// Hover pop-up off a small icon — never occupies permanent layout space.
// Offers per-class-tag averages (computed live from the synced roster) and a
// few one-click "use this champion's stats" presets.
export default function StatSuggestions({ champion, onAccept }: Props) {
  const { catalog, status, syncing, error, sync } = useChampionCatalog()
  const [open, setOpen] = useState(false)

  const ownTags = champion.identity.class ?? []
  const classAverages = computeClassAverages(catalog)
  const ownAverages = classAverages.filter(a => ownTags.includes(a.tag))
  const otherAverages = classAverages.filter(a => !ownTags.includes(a.tag))
  const presets = getPresetSuggestions(catalog)

  return (
    <div
      className="stat-suggest-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button type="button" className="stat-suggest-trigger" aria-label="Suggested stats">✨</button>

      {open && (
        <div className="stat-suggest-popup">
          <div className="stat-suggest-popup-title">Suggested Stats</div>

          {!status.version ? (
            <div className="stat-suggest-empty">
              <p>Sync the champion roster from Data Dragon to see class averages and presets.</p>
              <button className="stat-suggest-sync-btn" onClick={sync} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync champions'}
              </button>
              {error && <div className="stat-suggest-error">{error}</div>}
            </div>
          ) : (
            <>
              {ownAverages.length > 0 && (
                <div className="stat-suggest-section">
                  <div className="stat-suggest-section-label">Your class</div>
                  {ownAverages.map(a => (
                    <div key={a.tag} className="stat-suggest-row">
                      <span>{a.tag} average <em>({a.sampleSize} champions)</em></span>
                      <button className="stat-suggest-accept-btn" onClick={() => onAccept(a.stats)}>Accept</button>
                    </div>
                  ))}
                </div>
              )}

              {otherAverages.length > 0 && (
                <div className="stat-suggest-section">
                  <div className="stat-suggest-section-label">By class</div>
                  {otherAverages.map(a => (
                    <div key={a.tag} className="stat-suggest-row">
                      <span>{a.tag} average <em>({a.sampleSize} champions)</em></span>
                      <button className="stat-suggest-accept-btn" onClick={() => onAccept(a.stats)}>Accept</button>
                    </div>
                  ))}
                </div>
              )}

              {presets.length > 0 && (
                <div className="stat-suggest-section">
                  <div className="stat-suggest-section-label">Presets</div>
                  {presets.map(p => (
                    <div key={p.championId} className="stat-suggest-row">
                      <span>{p.championName}'s stats</span>
                      <button className="stat-suggest-accept-btn" onClick={() => onAccept(p.stats)}>Accept</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="stat-suggest-footer">
                <span>Synced {status.version}</span>
                <button className="stat-suggest-resync-btn" onClick={sync} disabled={syncing}>
                  {syncing ? 'Syncing…' : 'Re-sync'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
