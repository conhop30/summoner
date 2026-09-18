import type { Champion } from '../champion/types'
import { BASE_STATS } from './statFields'
import './StatBlock.css'

interface Props {
  champion: Champion
}

// Condensed, read-only stat display — mirrors the in-game "show stats" HUD
// block (icon + value only, no labels/growth) that replaces StatsPanel's
// full editable grid while the Abilities tab is active.
export default function StatBlock({ champion }: Props) {
  const stats = champion.base_stats

  return (
    <div className="stat-block">
      {BASE_STATS.map(f => {
        const value = stats[f.valueKey]
        return (
          <div key={f.valueKey} className="stat-chip">
            <span className="stat-chip-icon">{f.icon}</span>
            <span className="stat-chip-value">{typeof value === 'number' ? value : '—'}</span>
          </div>
        )
      })}
      <span className="stat-block-hint">Click to edit</span>
    </div>
  )
}
