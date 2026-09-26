import type { Champion } from '../champion/types'
import { useNumbers } from '../settings/useNumbers'
import './ChampionTile.css'

const PLACEHOLDER_COLORS = ['purple', 'teal', 'coral', 'blue', 'amber']

function getPlaceholderColor(id: string): string {
  return PLACEHOLDER_COLORS[id.charCodeAt(0) % PLACEHOLDER_COLORS.length]
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// Averaged over the parts that are shown: stats don't count while they are hidden.
function getCompletionPct(champion: Champion, showStats: boolean): number {
  const { identity, base_stats, abilities } = champion
  const storyPct = ((identity.name ? 1 : 0) + (identity.lore ? 1 : 0) + ((identity.role ?? []).length > 0 ? 1 : 0)) / 3
  const statKeys = ['health', 'attack_damage', 'armor', 'magic_resistance', 'movement_speed']
  const statsPct = statKeys.filter(k => base_stats[k as keyof typeof base_stats] != null).length / statKeys.length
  const slotKeys = ['passive', 'q', 'w', 'e', 'r'] as const
  const abilitiesPct = slotKeys.filter(s => abilities[s]?.name).length / slotKeys.length
  const parts = showStats ? [storyPct, statsPct, abilitiesPct] : [storyPct, abilitiesPct]
  return Math.round((parts.reduce((sum, p) => sum + p, 0) / parts.length) * 100)
}

function MistStrands() {
  return (
    <span className="mist" aria-hidden="true">
      <span className="mist-strand mist-strand-1" />
      <span className="mist-strand mist-strand-2" />
      <span className="mist-strand mist-strand-3" />
      <span className="mist-strand mist-strand-4" />
    </span>
  )
}

interface Props {
  champion: Champion
  onView: () => void
  onEdit: () => void
  onFavoriteToggle: () => void
  onDelete: () => void
}

export default function ChampionTile({ champion, onView, onEdit, onFavoriteToggle, onDelete }: Props) {
  const { identity, metadata } = champion
  const color      = getPlaceholderColor(metadata.id)
  const initials   = getInitials(identity.name)
  const laneLabel  = (identity.role ?? []).slice(0, 2).join(' · ')
  const classLabel = (identity.class ?? []).slice(0, 1).join('')
  const playstyle  = (identity as any).playstyle as string[] | undefined
  const numbers = useNumbers()
  const pct    = getCompletionPct(champion, numbers.stats)
  const r      = 11
  const circ   = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)

  return (
    <div className="tile">
      <div className="tile-image">
        <div
          className={`tile-fav-dot${metadata.is_favorite ? ' active' : ''}`}
          onClick={e => { e.stopPropagation(); onFavoriteToggle() }}
        />

        <svg className="tile-completion-ring" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r={r} fill="none" stroke="#141420" strokeWidth="2" />
          <circle
            cx="14" cy="14" r={r}
            fill="none"
            stroke={pct === 100 ? '#0bc4e3' : '#c89b3c'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '14px 14px', transition: 'stroke-dashoffset 0.4s' }}
          />
        </svg>

        {identity.image_path ? (
          <img
            className="tile-portrait"
            src={identity.image_path}
            alt={identity.name}
            style={{ objectPosition: `${(identity as any).image_position?.x ?? 50}% ${(identity as any).image_position?.y ?? 50}%` }}
          />
        ) : (
          <div className={`tile-placeholder placeholder-${color}`}>
            <span className="tile-initials">{initials}</span>
          </div>
        )}

        <div className="tile-gradient" />

        <div className="tile-bottom">
          <div className="tile-name">{identity.name}</div>
          {playstyle && playstyle.length > 0 ? (
            <div className="tile-playstyle">{playstyle.slice(0, 2).join(' · ')}</div>
          ) : (
            classLabel && <div className="tile-playstyle">{classLabel}</div>
          )}
          {laneLabel && (
            <div className="tile-lane-row">
              <span className="tile-lane-tag">{laneLabel}</span>
            </div>
          )}
          {(metadata.tags ?? []).length > 0 && (
            <div className="tile-tags">
              {metadata.tags.slice(0, 2).map(tag => (
                <span key={tag} className="tile-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="tile-footer">
          <button className="tile-action-btn" onClick={onView}>
            <MistStrands />
            <span className="tile-action-label">View</span>
          </button>
          <button className="tile-action-btn" onClick={onEdit}>
            <MistStrands />
            <span className="tile-action-label">Edit</span>
          </button>
        </div>

        <button
          className="tile-delete-btn"
          title={`Delete ${identity.name || 'champion'}`}
          aria-label={`Delete ${identity.name || 'champion'}`}
          onClick={e => { e.stopPropagation(); onDelete() }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </button>
      </div>
    </div>
  )
}