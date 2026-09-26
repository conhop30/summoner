import type { Champion, BaseStats } from '../champion/types'
import { BASE_STATS, HIDDEN_STATS, type StatFieldDef } from './statFields'
import Workbench, { type WorkbenchView } from './Workbench'
import StatSuggestions from './StatSuggestions'
import StatLookup from './StatLookup'
import type { CatalogState } from '../championCatalog/useChampionCatalog'
import { parseStatInput, normalizeBaseStats, inputStep, statSpecFor } from '../champion/statSpec'
import './StatsPanel.css'

interface Props {
  champion: Champion
  onChange: (c: Champion) => void
  workbench: WorkbenchView
  onWorkbench: (v: WorkbenchView) => void
  /** The synced champion roster, loaded once by the editor page and shared with the win-rate banner. */
  catalogState: CatalogState
}

interface StatFieldProps extends StatFieldDef {
  champion: Champion
  onChange: (c: Champion) => void
}

function StatField({ label, icon, valueKey, growthKey, champion, onChange }: StatFieldProps) {
  const stats = champion.base_stats

  function updateStat(key: keyof BaseStats, raw: string) {
    onChange({ ...champion, base_stats: { ...stats, [key]: parseStatInput(key, raw) } })
  }

  return (
    <div className="sp-field">
      <div className="sp-field-header">
        <span className="sp-icon">{icon}</span>
        <span className="sp-label">{label}</span>
      </div>
      <div className="sp-inputs">
        <input className="sp-input" type="number" placeholder="Base" step={inputStep(valueKey)}
          value={typeof stats[valueKey] === 'number' ? stats[valueKey] : ''} onChange={e => updateStat(valueKey, e.target.value)} />
        {growthKey && (
          <input className="sp-input sp-growth" type="number" step={inputStep(growthKey)}
            placeholder={statSpecFor(valueKey)?.spec.growthUnit === 'percent' ? '+%/lvl' : '+/lvl'}
            value={typeof stats[growthKey] === 'number' ? stats[growthKey] : ''} onChange={e => updateStat(growthKey, e.target.value)} />
        )}
      </div>
    </div>
  )
}

export default function StatsPanel({ champion, onChange, workbench, onWorkbench, catalogState }: Props) {
  const stats = champion.base_stats

  function updateAttackRange(raw: string) {
    onChange({ ...champion, base_stats: { ...stats, attack_range: [parseStatInput('attack_range', raw) ?? 0] } })
  }

  function acceptSuggestion(suggested: Partial<BaseStats>) {
    onChange({ ...champion, base_stats: { ...stats, ...normalizeBaseStats(suggested) } })
  }

  return (
    <div className="stats-panel">
      <div className="sp-group">
        <div className="sp-group-title-row">
          <div className="sp-group-title">Base stats</div>
          <StatSuggestions champion={champion} catalogState={catalogState} onAccept={acceptSuggestion} />
        </div>
        <StatLookup catalogState={catalogState} />
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

      <Workbench champion={champion} onChange={onChange} view={workbench} onView={onWorkbench} />
    </div>
  )
}