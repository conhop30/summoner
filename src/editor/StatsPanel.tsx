import type { Champion, BaseStats } from '../champion/types'
import { BASE_STATS, HIDDEN_STATS, type StatFieldDef } from './statFields'
import ItemLoadoutPanel from './ItemLoadoutPanel'
import StatSuggestions from './StatSuggestions'
import StatLookup from './StatLookup'
import { useChampionCatalog } from '../championCatalog/useChampionCatalog'
import './StatsPanel.css'

interface Props {
  champion: Champion
  onChange: (c: Champion) => void
}

interface StatFieldProps extends StatFieldDef {
  champion: Champion
  onChange: (c: Champion) => void
}

function StatField({ label, icon, valueKey, growthKey, champion, onChange }: StatFieldProps) {
  const stats = champion.base_stats

  function updateStat(key: keyof BaseStats, raw: string) {
    const val = raw === '' ? undefined : parseFloat(raw)
    onChange({ ...champion, base_stats: { ...stats, [key]: val } })
  }

  return (
    <div className="sp-field">
      <div className="sp-field-header">
        <span className="sp-icon">{icon}</span>
        <span className="sp-label">{label}</span>
      </div>
      <div className="sp-inputs">
        <input className="sp-input" type="number" placeholder="Base"
          value={typeof stats[valueKey] === 'number' ? stats[valueKey] : ''} onChange={e => updateStat(valueKey, e.target.value)} />
        {growthKey && (
          <input className="sp-input sp-growth" type="number" placeholder="+/lvl"
            value={typeof stats[growthKey] === 'number' ? stats[growthKey] : ''} onChange={e => updateStat(growthKey, e.target.value)} />
        )}
      </div>
    </div>
  )
}

export default function StatsPanel({ champion, onChange }: Props) {
  const stats = champion.base_stats
  // One shared roster for the suggestions pop-up and the lookup, so syncing in one updates both.
  const catalogState = useChampionCatalog()

  function updateAttackRange(raw: string) {
    const val = raw === '' ? 0 : parseFloat(raw)
    onChange({ ...champion, base_stats: { ...stats, attack_range: [val] } })
  }

  function acceptSuggestion(suggested: Partial<BaseStats>) {
    onChange({ ...champion, base_stats: { ...stats, ...suggested } })
  }

  return (
    <div className="stats-panel">
      <div className="sp-group">
        <div className="sp-group-title-row">
          <div className="sp-group-title">Base stats</div>
          <StatSuggestions champion={champion} catalogState={catalogState} onAccept={acceptSuggestion} />
        </div>
        <StatLookup champion={champion} catalogState={catalogState} onApply={acceptSuggestion} />
        <div className="sp-grid">
          {BASE_STATS.map(f => (
            <StatField key={f.valueKey} {...f} champion={champion} onChange={onChange} />
          ))}
          <div className="sp-field">
            <div className="sp-field-header">
              <span className="sp-icon">◎</span>
              <span className="sp-label">Attack Range</span>
            </div>
            <div className="sp-inputs">
              <input className="sp-input" type="number" placeholder="Range"
                value={stats.attack_range?.[0] ?? ''} onChange={e => updateAttackRange(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="sp-group">
        <div className="sp-group-title">Hidden stats</div>
        <div className="sp-grid">
          {HIDDEN_STATS.map(f => (
            <StatField key={f.valueKey} {...f} champion={champion} onChange={onChange} />
          ))}
        </div>
      </div>

      <div className="sp-group">
        <div className="sp-group-title">Item build</div>
        <ItemLoadoutPanel champion={champion} onChange={onChange} />
      </div>
    </div>
  )
}