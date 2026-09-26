import { useState } from 'react'
import NumberField from './NumberField'
import RankValueField from './RankValueField'
import type { Effect, EffectFamily, EffectUnit, RatioEntry, RatioPart, StatChangeTarget } from '../champion/types'
import {
  CHANGEABLE_STATS, FAMILY_OPTIONS, TARGET_OPTIONS, UNIT_OPTIONS,
  describeEffect, effectKind, statChangeOf, takesDuration, unitSuffix,
} from '../champion/effects'
import { KIND_OPTIONS, applyOutcome, outcomeById, outcomeOf, outcomesFor, type OutcomeKind } from '../champion/outcomes'
import { PART_LABELS, PER_DEFAULT, RATIO_STATS, assumedUnits, ratioStatDef, resolveRatio } from '../champion/ratios'

// A scaler that is a value the user names themselves (stacks) rather than a stat.
const CUSTOM_RATIO = '__custom__'

// The unit shown inside an amount's boxes: none for a flat amount, since the box says what it is.
function unitSuffixShort(unit: EffectUnit): string | undefined {
  return unit === 'percent' ? '%' : unit === 'seconds' ? 's' : undefined
}

function setAt(values: number[] | undefined, index: number, value: number, length: number): number[] {
  const next = [...(values ?? Array(length).fill(0))]
  next[index] = value
  return next
}

// The stats a scaling can use, shared by every scaling's select.
function StatOptions() {
  return (
    <>
      {RATIO_STATS.filter(d => !d.id.startsWith('target_')).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
      <optgroup label="The target's">
        {RATIO_STATS.filter(d => d.id.startsWith('target_')).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
      </optgroup>
      <option value={CUSTOM_RATIO}>Custom value…</option>
    </>
  )
}

interface Props {
  effect: Effect
  /** What a description calls this effect, shown on the line so it can be written in. */
  tokenName: string
  maxRank: number
  open: boolean
  onToggle: () => void
  onChange: (next: Effect) => void
  onRemove: () => void
  /**
   * What an opened card shows. 'simple' is what the effect does and its numbers, with the rest under
   * a collapsed "More" (when `detailsInline`); 'details' is the rest on its own, for the Advanced tab.
   */
  part: 'simple' | 'details'
  detailsInline: boolean
}

// One effect. Collapsed it is a single line written like a tooltip. Opened, the simple part asks
// for the smallest thing that defines an effect: what kind of thing it is (Kind, then which one),
// and how much of it per rank. Scalings, who it affects, its name and its notes are the "more".
export default function EffectCard({ effect, tokenName, maxRank, open, onToggle, onChange, onRemove, part, detailsInline }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  // The custom name being typed. Its box stays until the user leaves it, even if what has been typed so
  // far happens to match a built-in type (the start of "shield wall").
  const [typingName, setTypingName] = useState(false)

  const outcome = outcomeOf(effect)
  const kind = effectKind(effect)
  const shownKind: OutcomeKind = typingName ? 'custom' : outcome.kind

  function chooseKind(next: OutcomeKind) {
    setTypingName(next === 'custom')
    onChange(applyOutcome(effect, next === 'custom' ? outcomeById('custom')! : outcomesFor(next)[0]))
  }

  const amountLabel = kind.unit === 'seconds' ? 'Lasts (seconds)' : `Amount${unitSuffix(kind.unit)}`
  const suffix = unitSuffixShort(kind.unit)

  return (
    <div className={`effect-card${open ? ' open' : ''}`}>
      <div className="effect-summary-row">
        <button className="effect-summary" aria-expanded={open} onClick={onToggle}>
          <span className="effect-summary-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className="effect-summary-text">{describeEffect(effect)}</span>
          <span className="effect-summary-token" title="Write this in the description to put this effect's numbers there">{`{${tokenName}}`}</span>
        </button>
        <button className="remove-effect-btn" onClick={onRemove} aria-label="Remove effect">×</button>
      </div>

      {open && part === 'simple' && (
        <>
          <div className="effect-row">
            <select className="effect-type-select" value={shownKind} onChange={e => chooseKind(e.target.value as OutcomeKind)} aria-label="Kind of effect">
              {KIND_OPTIONS.map(o => <option key={o.kind} value={o.kind} title={o.hint}>{o.label}</option>)}
            </select>
            {shownKind !== 'custom' ? (
              <select
                className="effect-type-select"
                value={outcome.id}
                onChange={e => onChange(applyOutcome(effect, outcomeById(e.target.value)!))}
                aria-label="Which one"
              >
                {outcomesFor(shownKind).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            ) : (
              <input
                className="effect-type-select effect-type-input"
                placeholder="Name it, e.g. sleep"
                value={effect.type}
                autoFocus={effect.type === ''}
                onFocus={() => setTypingName(true)}
                onChange={e => onChange({ ...effect, type: e.target.value })}
                onBlur={e => {
                  setTypingName(false)
                  if (!e.target.value.trim()) onChange(applyOutcome(effect, outcomesFor('damage')[0]))
                }}
              />
            )}
            {(outcome.id === 'stat_up' || outcome.id === 'stat_down') && (
              <select
                className="effect-type-select"
                value={statChangeOf(effect).stat}
                onChange={e => onChange({ ...effect, stat: e.target.value })}
                aria-label="Which stat"
              >
                {CHANGEABLE_STATS.map(id => <option key={id} value={id}>{ratioStatDef(id)!.label}</option>)}
              </select>
            )}
          </div>

          {shownKind === 'custom' && (
            <div className="effect-custom-row">
              <label className="effect-custom-field">
                <span>Behaves like</span>
                <select
                  className="effect-type-select"
                  value={kind.family}
                  onChange={e => onChange({ ...effect, family: e.target.value as EffectFamily, unit: undefined })}
                >
                  {FAMILY_OPTIONS.map(o => <option key={o.value} value={o.value} title={o.hint}>{o.label}</option>)}
                </select>
              </label>
              <label className="effect-custom-field">
                <span>Base is</span>
                <select
                  className="effect-type-select"
                  value={kind.unit}
                  onChange={e => onChange({ ...effect, unit: e.target.value as EffectUnit })}
                >
                  {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="effect-subfield">
            <div className="effect-subfield-header">
              <span className="effect-subfield-label">{amountLabel}</span>
            </div>
            <RankValueField
              values={effect.base}
              maxRank={maxRank}
              suffix={suffix}
              onChange={(rankIndex, value) => onChange({ ...effect, base: setAt(effect.base, rankIndex, value, maxRank) })}
              onBulkChange={values => onChange({ ...effect, base: values })}
            />
          </div>

          {takesDuration(effect) && kind.unit !== 'seconds' && (
            <div className="effect-subfield">
              <div className="effect-subfield-header">
                <span className="effect-subfield-label">Lasts (seconds)</span>
              </div>
              <RankValueField
                values={effect.duration}
                maxRank={maxRank}
                suffix="s"
                onChange={(rankIndex, value) => onChange({ ...effect, duration: setAt(effect.duration, rankIndex, value, maxRank) })}
                onBulkChange={values => onChange({ ...effect, duration: values })}
              />
            </div>
          )}

          {detailsInline && (
            <>
              <button className="effect-more-btn" aria-expanded={moreOpen} onClick={() => setMoreOpen(v => !v)}>
                <span aria-hidden="true">{moreOpen ? '▾' : '▸'}</span> More
              </button>
              {moreOpen && <EffectDetails effect={effect} maxRank={maxRank} onChange={onChange} />}
            </>
          )}
        </>
      )}

      {open && part === 'details' && <EffectDetails effect={effect} maxRank={maxRank} onChange={onChange} />}
    </div>
  )
}

// What an effect can say beyond what it is and how much: its name, notes, who a stat change is
// for, and what it scales with. None of it is needed for an effect to work.
function EffectDetails({ effect, maxRank, onChange }: { effect: Effect; maxRank: number; onChange: (next: Effect) => void }) {
  const kind = effectKind(effect)
  // The scaling whose custom name is being typed; the box stays until the user leaves it.
  const [typingValue, setTypingValue] = useState<number | null>(null)
  const ratios = effect.ratios ?? []

  function updateRatio(index: number, partial: Partial<RatioEntry>) {
    onChange({ ...effect, ratios: ratios.map((r, i) => (i === index ? { ...r, ...partial } : r)) })
  }

  // Changing the stat keeps the chosen part if the new stat has it, and falls back to the total if not.
  function changeRatioStat(index: number, stat: string) {
    const current = resolveRatio(ratios[index])
    const parts = ratioStatDef(stat)?.parts ?? ['total']
    updateRatio(index, { stat, part: current && parts.includes(current.part) ? current.part : 'total', assumed: undefined })
  }

  return (
    <div className="effect-details">
      <div className="effect-row">
        <label className="effect-name-field" title="What the description calls this effect: write {Name} there, or use Insert value">
          Name
          <input
            className="rank-input effect-name-input"
            value={effect.name ?? ''}
            placeholder="Its usual name"
            onChange={e => onChange({ ...effect, name: e.target.value || undefined })}
            aria-label="Name in the description"
          />
        </label>
        <input
          className="rank-input"
          placeholder="Notes"
          value={effect.notes ?? ''}
          onChange={e => onChange({ ...effect, notes: e.target.value })}
          style={{ flex: 1 }}
        />
      </div>

      {effect.type === 'stat_change' && (() => {
        const change = statChangeOf(effect)
        return (
          <div className="effect-custom-row stat-change-row">
            <span className="stat-change-word">Affects</span>
            <select className="effect-type-select" value={change.target} onChange={e => onChange({ ...effect, target: e.target.value as StatChangeTarget })} aria-label="Who it affects">
              {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="stat-change-word">Amount is</span>
            <select className="effect-type-select" value={kind.unit} onChange={e => onChange({ ...effect, unit: e.target.value as EffectUnit })} aria-label="Flat or percent">
              {UNIT_OPTIONS.filter(o => o.value !== 'seconds').map(o => <option key={o.value} value={o.value}>{o.value === 'flat' ? 'flat' : '%'}</option>)}
            </select>
          </div>
        )
      })()}

      <div className="effect-subfield">
        <div className="effect-subfield-header">
          <span className="effect-subfield-label">Scales with</span>
          <button
            className="add-effect-btn"
            onClick={() => onChange({ ...effect, ratios: [...ratios, { stat: 'ap', part: 'total', values: Array(maxRank).fill(0) }] })}
          >
            + Add scaling
          </button>
        </div>
        {ratios.map((ratio, ri) => {
          const resolved = resolveRatio(ratio)
          // A name that matches a known stat mid-typing keeps its name field until the user leaves it.
          const custom = !resolved || typingValue === ri
          const parts: RatioPart[] = resolved && !custom ? ratioStatDef(resolved.stat)!.parts : ['total']
          return (
            <div key={ri} className="ratio-row">
              <div className="ratio-row-head">
                <select
                  className="effect-type-select ratio-stat-select"
                  value={custom ? CUSTOM_RATIO : resolved!.stat}
                  onChange={e => {
                    if (e.target.value === CUSTOM_RATIO) {
                      setTypingValue(ri)
                      updateRatio(ri, { stat: '', part: undefined })
                    } else {
                      setTypingValue(null)
                      changeRatioStat(ri, e.target.value)
                    }
                  }}
                  aria-label="Scales with"
                >
                  <StatOptions />
                </select>
                {parts.length > 1 && (
                  <select
                    className="effect-type-select ratio-part-select"
                    value={resolved?.part ?? 'total'}
                    onChange={e => updateRatio(ri, { part: e.target.value as RatioPart })}
                    aria-label="Which part"
                  >
                    {parts.map(pt => <option key={pt} value={pt}>{PART_LABELS[pt]}</option>)}
                  </select>
                )}
                {custom && (
                  <>
                    <input
                      className="effect-type-select ratio-name-input"
                      placeholder="Name it, e.g. stacks"
                      value={ratio.stat}
                      autoFocus={ratio.stat === ''}
                      onFocus={() => setTypingValue(ri)}
                      onChange={e => updateRatio(ri, { stat: e.target.value, part: undefined })}
                      onBlur={e => {
                        setTypingValue(null)
                        if (!e.target.value.trim()) updateRatio(ri, { stat: 'ap', part: 'total', assumed: undefined })
                      }}
                    />
                    <label className="ratio-assume" title="How many of it to assume when the win rate is estimated">
                      assume
                      <NumberField
                        className="rank-input ratio-assume-input"
                        value={assumedUnits(ratio)}
                        placeholder="1"
                        onChange={n => updateRatio(ri, { assumed: n || undefined })}
                      />
                    </label>
                  </>
                )}
                {ratio.per === undefined ? (
                  <button className="ratio-per-btn" onClick={() => updateRatio(ri, { per: PER_DEFAULT })} title="Add this amount for every N of the stat, instead of taking a share of it">
                    per N
                  </button>
                ) : (
                  <span className="ratio-per">
                    per
                    <NumberField className="rank-input ratio-per-input" value={ratio.per} onChange={n => updateRatio(ri, { per: n })} />
                    <button className="ratio-per-off" onClick={() => updateRatio(ri, { per: undefined })} title="Back to a plain ratio" aria-label="Back to a plain ratio">↩</button>
                  </span>
                )}
                <button className="remove-effect-btn" onClick={() => onChange({ ...effect, ratios: ratios.filter((_, i) => i !== ri) })} aria-label="Remove this scaling">×</button>
              </div>
              <RankValueField
                values={ratio.values}
                maxRank={maxRank}
                percent={!custom && ratio.per === undefined}
                suffix={unitSuffixShort(kind.unit)}
                onChange={(rankIndex, value) => updateRatio(ri, { values: setAt(ratio.values, rankIndex, value, maxRank) })}
                onBulkChange={values => updateRatio(ri, { values })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
