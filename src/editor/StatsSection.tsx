import type { Champion, BaseStats } from '../champion/types'
import './StatsSection.css'

interface Props {
  champion: Champion
  onChange: (c: Champion) => void
}

interface StatFieldProps {
  label: string
  icon: string
  valueKey: keyof BaseStats
  growthKey?: keyof BaseStats
  champion: Champion
  onChange: (c: Champion) => void
}

function StatField({ label, icon, valueKey, growthKey, champion, onChange }: StatFieldProps) {
  const stats = champion.base_stats

  function updateStat(key: keyof BaseStats, raw: string) {
    const val = raw === '' ? undefined : parseFloat(raw)
    onChange({
      ...champion,
      base_stats: { ...stats, [key]: val }
    })
  }

  return (
    <div className="stat-field">
      <div className="stat-field-header">
        <span className="stat-icon">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-inputs">
        <input
          className="stat-input"
          type="number"
          placeholder="Base"
          value={
            typeof stats[valueKey] === 'number'
              ? stats[valueKey]
              : Array.isArray(stats[valueKey])
              ? (stats[valueKey] as number[])[0] ?? ''
              : ''
          }
          onChange={e => updateStat(valueKey, e.target.value)}
        />
        {growthKey && (
          <input
            className="stat-input stat-input-growth"
            type="number"
            placeholder="+/lvl"
            value={typeof stats[growthKey] === 'number' ? stats[growthKey] : ''}
            onChange={e => updateStat(growthKey, e.target.value)}
          />
        )}
      </div>
    </div>
  )
}

const BASE_STAT_FIELDS: Omit<StatFieldProps, 'champion' | 'onChange'>[] = [
  { label: 'Health',            icon: '♥', valueKey: 'health',            growthKey: 'health_growth' },
  { label: 'Health Regen',      icon: '✚', valueKey: 'health_regen',       growthKey: 'health_regen_growth' },
  { label: 'Resource',          icon: '◈', valueKey: 'resource',           growthKey: 'resource_growth' },
  { label: 'Resource Regen',    icon: '◇', valueKey: 'resource_regen',     growthKey: 'resource_regen_growth' },
  { label: 'Attack Damage',     icon: '⚔', valueKey: 'attack_damage',      growthKey: 'attack_damage_growth' },
  { label: 'Attack Speed',      icon: '⚡', valueKey: 'attack_speed',       growthKey: 'attack_speed_growth' },
  { label: 'Armor',             icon: '🛡', valueKey: 'armor',              growthKey: 'armor_growth' },
  { label: 'Magic Resist',      icon: '✦', valueKey: 'magic_resistance',   growthKey: 'magic_resistance_growth' },
  { label: 'Movement Speed',    icon: '➢', valueKey: 'movement_speed',     growthKey: 'movement_speed_growth' },
]

const HIDDEN_STAT_FIELDS: Omit<StatFieldProps, 'champion' | 'onChange'>[] = [
  { label: 'Crit Multiplier',   icon: '◆', valueKey: 'crit_damage_multiplier' },
]

export default function StatsSection({ champion, onChange }: Props) {
  const stats = champion.base_stats

  function updateAttackRange(raw: string) {
    const val = raw === '' ? 0 : parseFloat(raw)
    onChange({
      ...champion,
      base_stats: { ...stats, attack_range: [val] }
    })
  }

  return (
    <div className="stats-root">
      <div className="stats-panel">
        <div className="stats-group">
          <div className="stats-group-title">Base Stats</div>
          <div className="stats-grid">
            {BASE_STAT_FIELDS.map(f => (
              <StatField key={f.valueKey} {...f} champion={champion} onChange={onChange} />
            ))}
            <div className="stat-field">
              <div className="stat-field-header">
                <span className="stat-icon">◎</span>
                <span className="stat-label">Attack Range</span>
              </div>
              <div className="stat-inputs">
                <input
                  className="stat-input"
                  type="number"
                  placeholder="Range"
                  value={stats.attack_range?.[0] ?? ''}
                  onChange={e => updateAttackRange(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="stats-group">
          <div className="stats-group-title">Hidden Stats</div>
          <div className="stats-grid">
            {HIDDEN_STAT_FIELDS.map(f => (
              <StatField key={f.valueKey} {...f} champion={champion} onChange={onChange} />
            ))}
          </div>
        </div>
      </div>

      <div className="stats-statlab-placeholder">
        <div className="statlab-label">Stat Lab</div>
        <div className="statlab-hint">Available in Milestone 7</div>
      </div>
    </div>
  )
}