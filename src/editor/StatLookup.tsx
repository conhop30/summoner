import { useMemo, useState } from 'react'
import type { BaseStats } from '../champion/types'
import type { ChampionCatalogEntry } from '../championCatalog/types'
import type { CatalogState } from '../championCatalog/useChampionCatalog'
import { mapDDragonStats } from '../championCatalog/suggestions'
import { BASE_STATS } from './statFields'
import { formatStat, formatGrowth } from '../champion/statSpec'
import './StatLookup.css'

interface Props {
  catalogState: CatalogState
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

function readNumber(stats: Partial<BaseStats>, key: keyof BaseStats): number | undefined {
  const v = stats[key]
  return Array.isArray(v) ? v[0] : v
}

// "610 (+104/lvl)" or "0.658 (+2%/lvl)" — a value with its growth in its own unit, or just the
// value; null when there isn't one.
function describe(stats: Partial<BaseStats>, keys: (keyof BaseStats)[]): string | null {
  const value = readNumber(stats, keys[0])
  if (value === undefined) return null
  const growth = keys[1] ? readNumber(stats, keys[1]) : undefined
  return growth !== undefined ? `${formatStat(keys[0], value)} (${formatGrowth(keys[0], growth)}/lvl)` : formatStat(keys[0], value)
}

// Look up any synced champion by name and compare the one or two stats you care about — e.g. Rakan's
// attack range while building Poppy. It only reads: nothing is written into the stat fields, and the
// compared stats sit on the champion's line so they stay in view once the picker is collapsed.
export default function StatLookup({ catalogState }: Props) {
  const { catalog, status, syncing, error, sync } = catalogState
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [entryId, setEntryId] = useState<string | null>(null)
  const [open, setOpen] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [compared, setCompared] = useState<string[]>([])

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
    setCompared([])
  }

  function clear() {
    setEntryId(null)
    setQuery('')
    setChecked(new Set())
    setCompared([])
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
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  // Pin the ticked stats to the champion's line and fold the picker away.
  function compare() {
    setCompared(available.filter(s => checked.has(s.label)).map(s => s.label))
    setOpen(false)
  }

  const shown = available.filter(s => compared.includes(s.label))

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
            {shown.length > 0 && (
              <span className="stat-lookup-compared">
                {shown.map(s => (
                  <span key={s.label} className="stat-lookup-chip">
                    <span className="stat-lookup-chip-name">{s.label}</span>
                    <span className="stat-lookup-chip-value">{describe(looked, s.keys)}</span>
                  </span>
                ))}
              </span>
            )}
          </div>

          {open && (
            <>
              <div className="stat-lookup-cols" aria-hidden="true">
                <span>Tick the stats to compare</span>
                <span>{entry.name}</span>
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
                  </label>
                ))}
              </div>
              <div className="stat-lookup-footer">
                <button className="stat-lookup-link" onClick={() => setChecked(new Set())} disabled={checked.size === 0}>None</button>
                <button className="stat-suggest-accept-btn" onClick={compare} disabled={checked.size === 0}>Compare</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
