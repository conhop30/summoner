import type { AbilityBody, Effect } from './types'
import { canLast, describeStatChange, effectName } from './effects'
import { durationPhrase, effectPhrase } from './descriptionTokens'
import { outcomeOf, tagIcon, type Tone } from './outcomes'
import type { StatIconKey } from './statIcons'
import { rankList } from './ratios'

// What an ability's tooltip says apart from its description: the cooldown and cost line, and, when
// the reader asks for detail (holds Shift), one row for every effect. Pure text, so the editor's
// preview and the View page show exactly the same thing.

/** "7 / 6.5 / 6 s": each rank's cooldown, or one number when they are all the same. Empty when none is filled in. */
function spaced(values: number[] | undefined): string {
  const list = (values ?? []).filter(v => Number.isFinite(v))
  if (!list.some(v => v)) return ''
  return rankList(list).split('/').join(' / ')
}

export function cooldownText(body: Pick<AbilityBody, 'cooldown'>): string {
  const text = spaced(body.cooldown)
  return text ? `${text} s` : ''
}

export function costText(body: Pick<AbilityBody, 'cost' | 'cost_type'>): string {
  const text = spaced(body.cost)
  const type = body.cost_type ?? 'Mana'
  if (!text || type === 'None') return ''
  return `${text} ${type}`
}

export interface DetailRow {
  /** What the effect is, in the words of the outcome list: "Magic damage", "Armor shred". */
  label: string
  tone?: Tone
  icon?: StatIconKey
  /** Its numbers, written like a tooltip: "40/65/90 (+45% AP)". */
  value: string
  /** "for 4 s", when it lasts a while and says for how long. */
  lasts: string
  notes: string
}

export function detailRows(effects: Effect[] | undefined): DetailRow[] {
  return (effects ?? []).map(effect => {
    const outcome = outcomeOf(effect)
    const label = outcome.id === 'custom' ? effectName(effect.type)
      : outcome.id === 'stat_up' || outcome.id === 'stat_down' ? describeStatChange(effect)
      : outcome.label
    const lasting = canLast(effect) ? durationPhrase(effect) : ''
    return { label, tone: outcome.tone, icon: tagIcon(effect), value: effectPhrase(effect), lasts: lasting ? `for ${lasting}` : '', notes: effect.notes?.trim() ?? '' }
  })
}
