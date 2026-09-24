import type { Champion } from '../champion/types'
import { BASE_STATS } from './statFields'
import './StatBlock.css'

interface Props {
  champion: Champion
  onEdit: () => void
}

// Condensed stat readout — mirrors the in-game "show stats" HUD block (icon + value only, no
// labels or growth). It sits beside the ability keys on the Abilities tab, in two rows; clicking
// it goes back to the Stats tab to edit.
export default function StatBlock({ champion, onEdit }: Props) {
  const stats = champion.base_stats

  return (
    <button className="stat-block" onClick={onEdit} title="Click to edit the base stats">
      {BASE_STATS.map(f => {
        const value = stats[f.valueKey]
        return (
          <span key={f.valueKey} className="stat-chip">
            <span className="stat-chip-icon">{f.icon}</span>
            <span className="stat-chip-value">{typeof value === 'number' ? value : '—'}</span>
          </span>
        )
      })}
      <span className="stat-block-hint">Edit</span>
    </button>
  )
}
