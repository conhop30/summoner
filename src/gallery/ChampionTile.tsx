import type { Champion } from '../champion/types'
import './ChampionTile.css'

const PLACEHOLDER_COLORS = ['purple', 'teal', 'coral', 'blue', 'amber']

function getPlaceholderColor(id: string): string {
  return PLACEHOLDER_COLORS[id.charCodeAt(0) % PLACEHOLDER_COLORS.length]
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getCompletionPct(champion: Champion): number {
  const { identity, base_stats, abilities } = champion
  const storyPct = ((identity.name ? 1 : 0) + (identity.lore ? 1 : 0) + ((identity.role ?? []).length > 0 ? 1 : 0)) / 3
  const statKeys = ['health', 'attack_damage', 'armor', 'magic_resistance', 'movement_speed']
  const statsPct = statKeys.filter(k => base_stats[k as keyof typeof base_stats] != null).length / statKeys.length
  const slotKeys = ['passive', 'q', 'w', 'e', 'r'] as const
  const abilitiesPct = slotKeys.filter(s => abilities[s]?.name).length / slotKeys.length
  return Math.round(((storyPct + statsPct + abilitiesPct) / 3) * 100)
}

interface Props {
  champion: Champion
  onView: () => void
  onEdit: () => void
  onFavoriteToggle: () => void
}

export default function ChampionTile({ champion, onView, onEdit, onFavoriteToggle }: Props) {
  const { identity, metadata } = champion
  const color      = getPlaceholderColor(metadata.id)
  const initials   = getInitials(identity.name)
  const laneLabel  = (identity.role ?? []).slice(0, 2).join(' · ')
  const classLabel = (identity.class ?? []).slice(0, 1).join('')
  const playstyle  = (identity as any).playstyle as string[] | undefined
  const pct    = getCompletionPct(champion)
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
      </div>

      <div className="tile-footer">
        <button className="tile-action-btn" onClick={onView}>View</button>
        <button className="tile-action-btn" onClick={onEdit}>Edit</button>
      </div>
    </div>
  )
}