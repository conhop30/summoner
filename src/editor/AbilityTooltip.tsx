import type { AbilityBody, Effect } from '../champion/types'
import { resolveSegments } from '../champion/descriptionTokens'
import { cooldownText, costText, detailRows } from '../champion/tooltip'
import StatIcon from './StatIcon'
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
  className?: string
  /** False leaves out the numbers: the cooldown and cost, and the rows of detail beneath the description. */
  numbers?: boolean
}

// An ability as the game draws it: its name, what it costs and how often it can be used, and the
// description. In the description an effect's numbers are replaced by what it is ("magic damage",
// coloured for the kind, with its icon), so the sentence reads cleanly; the numbers themselves,
// and everything an effect scales with, are in the rows beneath it.
export default function AbilityTooltip({ name, label, description, effects, cooldown, cost, costType, empty, className, numbers = true }: Props) {
  const segments = resolveSegments(description, effects, { tags: true })
  const rows = numbers ? detailRows(effects) : []
  const cd = numbers ? cooldownText({ cooldown }) : ''
  const price = numbers ? costText({ cost, cost_type: costType }) : ''

  return (
    <div className={`ability-tip${className ? ` ${className}` : ''}`}>
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
          {segments.map((s, i) => s.tag
            ? <span key={i} className={`ability-tip-tag${s.tone ? ` tone-${s.tone}` : ''}`}>{s.tag.icon && <StatIcon name={s.tag.icon} size={13} />}{s.text}</span>
            : s.tone ? <span key={i} className={`tone-${s.tone}`}>{s.text}</span> : s.text)}
        </div>
      ) : (
        empty && <div className="ability-tip-empty">{empty}</div>
      )}
      {rows.length > 0 && (
        <ul className="ability-tip-details">
          {rows.map((r, i) => (
            <li key={i}>
              <span className={`ability-tip-label${r.tone ? ` tone-${r.tone}` : ''}`}>{r.icon && <StatIcon name={r.icon} size={13} />}{r.label}</span>
              <span className="ability-tip-value">{r.value || '—'}{r.lasts && <em> {r.lasts}</em>}</span>
              {r.notes && <span className="ability-tip-notes">{r.notes}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
