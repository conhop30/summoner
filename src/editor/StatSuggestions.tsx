import { useEffect, useMemo, useRef, useState } from 'react'
import type { BaseStats, Champion } from '../champion/types'
import { useChampionCatalog } from '../championCatalog/useChampionCatalog'
import { computeClassAverages, getPresetsByClass, type ChampionPresetSuggestion } from '../championCatalog/suggestions'
import './StatSuggestions.css'

interface Props {
  champion: Champion
  onAccept: (stats: Partial<BaseStats>) => void
}

type Tab = 'averages' | 'champions'

// The few numbers that tell one champion's style from another's at a glance
// (a Braum, a Leona and a Thresh differ mostly in exactly these).
function summarize(stats: Partial<BaseStats>): string {
  const parts: string[] = []
  if (stats.health !== undefined) parts.push(`HP ${Math.round(stats.health)}`)
  if (stats.attack_damage !== undefined) parts.push(`AD ${Math.round(stats.attack_damage)}`)
  if (stats.armor !== undefined) parts.push(`AR ${Math.round(stats.armor)}`)
  if (stats.magic_resistance !== undefined) parts.push(`MR ${Math.round(stats.magic_resistance)}`)
  return parts.join(' · ')
}

// Click the ✨ button to open or close the pop-up; it stays open while you use it and
// closes on Escape, on a click anywhere outside it, or right after you accept a suggestion.
// Two tabs: per-class averages (computed live from the synced roster) and every synced
// champion grouped by class as one-click "use this champion's stats" presets.
// Never occupies permanent layout space.
export default function StatSuggestions({ champion, onAccept }: Props) {
  const { catalog, status, syncing, error, sync } = useChampionCatalog()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('averages')
  const [classTag, setClassTag] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const ownTags = champion.identity.class ?? []
  const classAverages = useMemo(() => computeClassAverages(catalog), [catalog])
  const presetGroups = useMemo(() => getPresetsByClass(catalog), [catalog])
  const ownAverages = classAverages.filter(a => ownTags.includes(a.tag))
  const otherAverages = classAverages.filter(a => !ownTags.includes(a.tag))

  // Default the champion list to the champion's own class, falling back to the first class.
  const activeTag =
    classTag && presetGroups.some(g => g.tag === classTag) ? classTag
    : presetGroups.find(g => ownTags.includes(g.tag))?.tag ?? presetGroups[0]?.tag ?? null

  const trimmed = query.trim().toLowerCase()
  const visiblePresets: ChampionPresetSuggestion[] = useMemo(() => {
    if (trimmed) {
      // Searching looks across every class, one row per champion.
      const seen = new Map<string, ChampionPresetSuggestion>()
      for (const g of presetGroups) for (const c of g.champions) seen.set(c.championId, c)
      return [...seen.values()]
        .filter(c => c.championName.toLowerCase().includes(trimmed))
        .sort((a, b) => a.championName.localeCompare(b.championName))
    }
    return presetGroups.find(g => g.tag === activeTag)?.champions ?? []
  }, [presetGroups, activeTag, trimmed])

  function accept(stats: Partial<BaseStats>) {
    onAccept(stats)
    setOpen(false)
  }

  function averageRow(a: { tag: string; sampleSize: number; stats: Partial<BaseStats> }) {
    return (
      <div key={a.tag} className="stat-suggest-row">
        <span className="stat-suggest-row-main">
          <span>{a.tag} average <em>({a.sampleSize} champions)</em></span>
          <span className="stat-suggest-row-sub">{summarize(a.stats)}</span>
        </span>
        <button className="stat-suggest-accept-btn" onClick={() => accept(a.stats)}>Accept</button>
      </div>
    )
  }

  return (
    <div className="stat-suggest-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`stat-suggest-trigger${open ? ' open' : ''}`}
        aria-label="Suggested stats"
        aria-expanded={open}
        title="Suggested stats"
        onClick={() => setOpen(o => !o)}
      >
        ✨
      </button>

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
              <div className="stat-suggest-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={tab === 'averages'}
                  className={`stat-suggest-tab${tab === 'averages' ? ' active' : ''}`}
                  onClick={() => setTab('averages')}
                >
                  Class averages
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'champions'}
                  className={`stat-suggest-tab${tab === 'champions' ? ' active' : ''}`}
                  onClick={() => setTab('champions')}
                >
                  Champions
                </button>
              </div>

              {tab === 'averages' && (
                <div className="stat-suggest-scroll">
                  {ownAverages.length > 0 && (
                    <div className="stat-suggest-section">
                      <div className="stat-suggest-section-label">Your class</div>
                      {ownAverages.map(averageRow)}
                    </div>
                  )}
                  {otherAverages.length > 0 && (
                    <div className="stat-suggest-section">
                      <div className="stat-suggest-section-label">By class</div>
                      {otherAverages.map(averageRow)}
                    </div>
                  )}
                </div>
              )}

              {tab === 'champions' && (
                <>
                  <input
                    className="stat-suggest-search"
                    placeholder="Search all champions"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                  {!trimmed && (
                    <div className="stat-suggest-chips">
                      {presetGroups.map(g => (
                        <button
                          key={g.tag}
                          className={`stat-suggest-chip${g.tag === activeTag ? ' active' : ''}`}
                          onClick={() => setClassTag(g.tag)}
                        >
                          {g.tag} <em>{g.champions.length}</em>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="stat-suggest-scroll">
                    {visiblePresets.length === 0 && (
                      <div className="stat-suggest-none">No champions match “{query}”.</div>
                    )}
                    {visiblePresets.map(p => (
                      <div key={p.championId} className="stat-suggest-row">
                        <span className="stat-suggest-row-main">
                          <span>{p.championName}</span>
                          <span className="stat-suggest-row-sub">{summarize(p.stats)}</span>
                        </span>
                        <button className="stat-suggest-accept-btn" onClick={() => accept(p.stats)}>Accept</button>
                      </div>
                    ))}
                  </div>
                </>
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
