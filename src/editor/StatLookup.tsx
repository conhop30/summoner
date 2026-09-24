import { useMemo, useState } from 'react'
import type { BaseStats, Champion } from '../champion/types'
import type { ChampionCatalogEntry } from '../championCatalog/types'
import type { CatalogState } from '../championCatalog/useChampionCatalog'
import { mapDDragonStats } from '../championCatalog/suggestions'
import { BASE_STATS } from './statFields'
import './StatLookup.css'

interface Props {
  champion: Champion
  catalogState: CatalogState
  onApply: (stats: Partial<BaseStats>) => void
}

interface LookupStat {
  label: string
  icon: string
  keys: (keyof BaseStats)[]   // the value, plus its per-level growth where it has one
}

// One row per stat as the form shows it: a stat's value and growth are picked together.
const LOOKUP_STATS: LookupStat[] = [
  ...BASE_STATS.map(f => ({ label: f.label, icon: f.icon, keys: f.growthKey ? [f.valueKey, f.growthKey] : [f.valueKey] })),
  { label: 'Attack Range', icon: '◎', keys: ['attack_range'] as (keyof BaseStats)[] },
]

const MAX_MATCHES = 8

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000)
}

function readNumber(stats: Partial<BaseStats>, key: keyof BaseStats): number | undefined {
  const v = stats[key]
  return Array.isArray(v) ? v[0] : v
}

// "610 (+104/lvl)" — a value with its growth, or just the value; null when there isn't one.
function describe(stats: Partial<BaseStats>, keys: (keyof BaseStats)[]): string | null {
  const value = readNumber(stats, keys[0])
  if (value === undefined) return null
  const growth = keys[1] ? readNumber(stats, keys[1]) : undefined
  return growth !== undefined ? `${fmt(value)} (+${fmt(growth)}/lvl)` : fmt(value)
}

// Look up any synced champion by name and copy over just the stats you tick — e.g. Poppy's
// health and armor but Rakan's attack range. The result window collapses out of the way.
export default function StatLookup({ champion, catalogState, onApply }: Props) {
  const { catalog, status, syncing, error, sync } = catalogState
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [entryId, setEntryId] = useState<string | null>(null)
  const [open, setOpen] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [note, setNote] = useState<string | null>(null)

  const entry = catalog.find(c => c.id === entryId) ?? null
  const looked = useMemo(() => (entry ? mapDDragonStats(entry.stats) : null), [entry])

  const matches = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    const starts: ChampionCatalogEntry[] = []
    const contains: ChampionCatalogEntry[] = []
    for (const c of catalog) {
      const n = normalize(c.name)
      if (n.startsWith(q)) starts.push(c)
      else if (n.includes(q)) contains.push(c)
    }
    const byName = (a: ChampionCatalogEntry, b: ChampionCatalogEntry) => a.name.localeCompare(b.name)
    return [...starts.sort(byName), ...contains.sort(byName)].slice(0, MAX_MATCHES)
  }, [catalog, query])

  function pick(c: ChampionCatalogEntry) {
    setEntryId(c.id)
    setQuery(c.name)
    setFocused(false)
    setOpen(true)
    setChecked(new Set())
    setNote(null)
  }

  function clear() {
    setEntryId(null)
    setQuery('')
    setChecked(new Set())
    setNote(null)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault()
      setFocused(true)
      setHighlight(h => (h + 1) % matches.length)
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault()
      setHighlight(h => (h - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter' && focused && matches[highlight]) {
      e.preventDefault()
      pick(matches[highlight])
    } else if (e.key === 'Escape') {
      setFocused(false)
    }
  }

  const available = looked ? LOOKUP_STATS.filter(s => describe(looked, s.keys) !== null) : []

  function toggle(label: string) {
    setNote(null)
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function apply() {
    if (!looked || !entry) return
    const picked = LOOKUP_STATS.filter(s => checked.has(s.label))
    const stats: Partial<BaseStats> = {}
    for (const s of picked) {
      for (const k of s.keys) if (looked[k] !== undefined) (stats as Record<string, unknown>)[k] = looked[k]
    }
    onApply(stats)
    setNote(`Applied ${picked.map(s => s.label).join(', ')} from ${entry.name}`)
    setChecked(new Set())
  }

  const showList = focused && matches.length > 0 && normalize(query) !== normalize(entry?.name ?? '')

  return (
    <div className="stat-lookup">
      <div className="stat-lookup-search">
        <span className="stat-lookup-icon" aria-hidden="true">⌕</span>
        <input
          className="stat-lookup-input"
          placeholder={status.version ? 'Look up a champion’s stats — e.g. Rakan' : 'Sync the champion roster to look up stats'}
          value={query}
          disabled={!status.version}
          onChange={e => { setQuery(e.target.value); setHighlight(0); setFocused(true) }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
        />
        {query && <button className="stat-lookup-clear" onClick={clear} aria-label="Clear the lookup" title="Clear">×</button>}

        {showList && (
          <ul className="stat-lookup-list" role="listbox">
            {matches.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={i === highlight}
                className={`stat-lookup-option${i === highlight ? ' highlighted' : ''}`}
                onMouseDown={e => { e.preventDefault(); pick(c) }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span>{c.name}</span>
                <em>{c.tags.join(' · ')}</em>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!status.version && (
        <div className="stat-lookup-sync">
          <button className="stat-suggest-sync-btn" onClick={sync} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync champions'}</button>
          {error && <span className="stat-suggest-error">{error}</span>}
        </div>
      )}

      {entry && looked && (
        <div className="stat-lookup-window">
          <div className="stat-lookup-head">
            <button className="stat-lookup-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
              <span className="stat-lookup-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
              <span className="stat-lookup-name">{entry.name}</span>
              <em>{entry.tags.join(' · ')}</em>
            </button>
            {checked.size > 0 && !open && <span className="stat-lookup-count">{checked.size} ticked</span>}
          </div>

          {open && (
            <>
              <div className="stat-lookup-cols" aria-hidden="true">
                <span>Tick the stats to copy</span>
                <span>{entry.name}</span>
                <span>Yours</span>
              </div>
              <div className="stat-lookup-rows">
                {available.map(s => (
                  <label key={s.label} className={`stat-lookup-row${checked.has(s.label) ? ' checked' : ''}`}>
                    <span className="stat-lookup-label">
                      <input type="checkbox" checked={checked.has(s.label)} onChange={() => toggle(s.label)} />
                      <span className="sp-icon">{s.icon}</span>
                      {s.label}
                    </span>
                    <span className="stat-lookup-theirs">{describe(looked, s.keys)}</span>
                    <span className="stat-lookup-yours">{describe(champion.base_stats, s.keys) ?? '—'}</span>
                  </label>
                ))}
              </div>
              <div className="stat-lookup-footer">
                <span className="stat-lookup-note">{note ?? ''}</span>
                <button className="stat-lookup-link" onClick={() => setChecked(new Set(available.map(s => s.label)))}>All</button>
                <button className="stat-lookup-link" onClick={() => setChecked(new Set())} disabled={checked.size === 0}>None</button>
                <button className="stat-suggest-accept-btn" onClick={apply} disabled={checked.size === 0}>
                  Apply{checked.size > 0 ? ` ${checked.size}` : ''}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
