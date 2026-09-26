import type { AbilityBody, Effect } from '../champion/types'
import { resolveSegments } from '../champion/descriptionTokens'
import { cooldownText, costText, detailRows } from '../champion/tooltip'
import { useShiftHover } from '../shared/useShiftHover'
import './AbilityTooltip.css'

interface Props {
  name?: string
  /** "Q", "Passive": which key it is. */
  label?: string
  description?: string
  effects?: Effect[]
  cooldown?: AbilityBody['cooldown']
  cost?: AbilityBody['cost']
  costType?: string
  /** Shown in place of the description when it is empty. */
  empty?: string
  /** Extra classes, and the props that let a wider area (the icon row above it) count as hovering. */
  className?: string
  hoverProps?: { onMouseEnter: () => void; onMouseLeave: () => void }
  detailed?: boolean
}

// An ability as the game shows it: its name, what it costs and how often it can be used, and the
// description with the kind of damage in its own colour. Holding Shift while pointing at it opens
// the detail the game keeps behind the same key: every effect on its own row, named for what it does,
// with its numbers. Without a `detailed` from the caller it watches Shift over itself.
export default function AbilityTooltip({ name, label, description, effects, cooldown, cost, costType, empty, className, hoverProps, detailed }: Props) {
  const own = useShiftHover()
  const showDetail = detailed ?? own.detailed
  const props = hoverProps ?? own.hoverProps

  const segments = resolveSegments(description, effects)
  const rows = detailRows(effects)
  const cd = cooldownText({ cooldown })
  const price = costText({ cost, cost_type: costType })

  return (
    <div className={`ability-tip${className ? ` ${className}` : ''}`} {...props}>
      {(name || label) && (
        <div className="ability-tip-head">
          <span className="ability-tip-name">{name || '—'}</span>
          {label && <span className="ability-tip-key">{label}</span>}
        </div>
      )}
      {(cd || price) && (
        <div className="ability-tip-meta">
          {cd && <span><b>Cooldown</b> {cd}</span>}
          {price && <span><b>Cost</b> {price}</span>}
        </div>
      )}
      {segments.length > 0 ? (
        <div className="ability-tip-body">
          {segments.map((s, i) => (s.tone ? <span key={i} className={`tone-${s.tone}`}>{s.text}</span> : s.text))}
        </div>
      ) : (
        empty && <div className="ability-tip-empty">{empty}</div>
      )}
      {showDetail && rows.length > 0 && (
        <ul className="ability-tip-details">
          {rows.map((r, i) => (
            <li key={i}>
              <span className={`ability-tip-label${r.tone ? ` tone-${r.tone}` : ''}`}>{r.label}</span>
              <span className="ability-tip-value">{r.value || '—'}{r.lasts && <em> {r.lasts}</em>}</span>
              {r.notes && <span className="ability-tip-notes">{r.notes}</span>}
            </li>
          ))}
        </ul>
      )}
      {!showDetail && rows.length > 0 && <div className="ability-tip-hint">Hold Shift for details</div>}
    </div>
  )
}
