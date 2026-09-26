import { useRef, useState } from 'react'
import AbilityJournalPanel from './AbilityJournal'
import StatBlock from './StatBlock'
import type { Champion, Ability, AbilityBody, AbilityBlock, AbilityBlockKind, AbilitySlot, DamageType, Effect, EffectFamily, EffectUnit, RatioEntry, RatioPart, RecastStruct, AbilityJournal, StatChangeDirection, StatChangeTarget } from '../champion/types'
import { BUILT_IN_EFFECT_TYPES, CHANGEABLE_STATS, DIRECTION_OPTIONS, FAMILY_OPTIONS, STAT_CHANGE, STAT_CHANGE_DEFAULTS, TARGET_OPTIONS, UNIT_OPTIONS, describeEffect, effectKind, effectTypeLabel, isBuiltInEffect, statChangeOf, takesDuration, unitSuffix } from '../champion/effects'
import DescriptionField from './DescriptionField'
import NumberField from './NumberField'
import { effectTokenNames, renamesBetween, retargetTokens } from '../champion/descriptionTokens'
import { addStatPart, flatToStat, hasFlatPart, removeFlatPart, statToFlat } from '../champion/terms'
import { PART_LABELS, PER_DEFAULT, RATIO_STATS, assumedUnits, percentToRatio, ratioStatDef, ratioToPercent, resolveRatio } from '../champion/ratios'
import { normalizeRankArray } from '../champion/disclosure'
import { generateId } from '../champion/utils'
import './AbilitiesSection.css'

// The dropdown's entry for an effect that isn't one of the built-in types.
const CUSTOM_EFFECT = '__custom__'
// The same for a scaler that is a value the user names themselves (stacks) rather than a stat.
const CUSTOM_RATIO = '__custom__'
const FLAT_SOURCE = '__flat__'

// The stats an amount part can scale with, shared by every part's source select.
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

// The unit shown inside an amount's boxes: none for a flat amount, since the box says what it is.
function unitSuffixShort(unit: EffectUnit): string | undefined {
  return unit === 'percent' ? '%' : unit === 'seconds' ? 's' : undefined
}

const COST_TYPES = ['Mana', 'Energy', 'Health', 'Fury', 'None']

const BLOCK_KINDS: { value: AbilityBlockKind; label: string }[] = [
  { value: 'passive', label: 'Passive' },
  { value: 'alternate_form', label: 'Alternate Form' },
  { value: 'recast', label: 'Recast' },
]

// One box per rank. After the first two ranks are filled in, suggest the arithmetic step between
// them as the scaling rule for the rest — the user accepts or keeps typing manually. `percent` is for
// a ratio (a share of a stat): the person types 45 and 0.45 is what is kept. `suffix` puts a unit
// inside each box.
function RankValueField({ values, maxRank, onChange, onBulkChange, percent = false, suffix }: {
  values: number[] | undefined
  maxRank: number
  onChange: (rankIndex: number, value: number) => void
  onBulkChange: (newValues: number[]) => void
  percent?: boolean
  suffix?: string
}) {
  const rankIndices = Array.from({ length: maxRank }, (_, i) => i)
  // Everything below works in what is shown in the boxes; `store` turns it back into what is kept.
  const show = (v: number | undefined) => (v === undefined ? undefined : percent ? ratioToPercent(v) : v)
  const store = (n: number) => (percent ? percentToRatio(n) : n)
  const shown = rankIndices.map(i => show(values?.[i]))
  const v0 = shown[0]
  const v1 = shown[1]
  // A second rank left blank (which is stored as 0) isn't a step to continue.
  const hasStep = maxRank > 2 && v0 !== undefined && v1 !== undefined && v1 !== 0
  const step = hasStep ? Math.round((v1! - v0!) * 100) / 100 : 0
  const projected = hasStep
    ? rankIndices.map(i => (i < 2 ? shown[i]! : Math.round((v0! + step * i) * 100) / 100))
    : []
  const suggestionApplicable = hasStep && rankIndices.slice(2).some(i => (shown[i] ?? 0) !== projected[i])

  // A single bulk update, not N sequential onChange calls — the latter would each
  // read the same pre-update `ability` prop and clobber one another (only the last wins).
  function acceptSuggestion() {
    onBulkChange(rankIndices.map(i => store(i < 2 ? (shown[i] ?? 0) : projected[i])))
  }

  return (
    <div className="rank-value-field">
      <div className="rank-inputs">
        {rankIndices.map(i => (
          <NumberField
            key={i}
            value={shown[i]}
            suffix={percent ? '%' : suffix}
            onChange={n => onChange(i, store(n))}
          />
        ))}
      </div>
      {suggestionApplicable && (
        <button className="rank-suggestion-chip" onClick={acceptSuggestion}>
          Suggest {step >= 0 ? '+' : ''}{step}{percent ? '%' : ''} per rank — Accept
        </button>
      )}
    </div>
  )
}

// The primary ability and every appended block share the exact same body shape
// (name/description/cooldown/cost/effects), so they share this editor too.
function AbilityBodyEditor({ body, maxRank, onUpdate, showNameDescription = true }: {
  body: AbilityBody
  maxRank: number
  onUpdate: (partial: Partial<AbilityBody>) => void
  showNameDescription?: boolean
}) {
  const rankIndices = Array.from({ length: maxRank }, (_, i) => i)
  const tokenNames = effectTokenNames(body.effects)
  // Effects are one tidy line each until opened; a freshly added one opens so it can be filled in.
  const [openEffects, setOpenEffects] = useState<Set<number>>(() => new Set())
  // The effect whose custom name is being typed. Its name field stays until the user leaves it, even
  // if what they have typed so far happens to match a built-in type (the start of "shield wall").
  const [typingName, setTypingName] = useState<number | null>(null)
  // The same for a custom value's name in a scaler, as "effect:scaler".
  const [typingValue, setTypingValue] = useState<string | null>(null)

  function toggleEffect(index: number) {
    setOpenEffects(prev => {
      const next = new Set(prev)
      if (!next.delete(index)) next.add(index)
      return next
    })
  }

  function updateRankArray(key: 'cooldown' | 'cost', index: number, value: number) {
    const current = body[key] ?? Array(maxRank).fill(0)
    const updated = [...current]
    updated[index] = value
    onUpdate({ [key]: updated })
  }

  // Every change to the list of effects goes through here, so the {tokens} in the description
  // follow an effect when its name (or the name its type gives it) changes.
  function commitEffects(next: Effect[], removedIndex?: number) {
    const description = retargetTokens(body.description, renamesBetween(body.effects, next, removedIndex))
    onUpdate(description !== body.description ? { effects: next, description } : { effects: next })
  }

  function addEffect() {
    const index = (body.effects ?? []).length
    commitEffects([...(body.effects ?? []), { type: 'damage' } as Effect])
    setOpenEffects(prev => new Set(prev).add(index))
  }

  function updateEffect(index: number, partial: Partial<Effect>) {
    const effects = [...(body.effects ?? [])]
    effects[index] = { ...effects[index], ...partial }
    commitEffects(effects)
  }

  // Picking a built-in type clears any family and unit left over from a custom label, since a
  // built-in has its own. A stat change starts as "raise armor, on self", and any other type
  // drops the stat-change settings it may have had.
  function changeEffectType(index: number, type: string) {
    const noStatChange = { stat: undefined, direction: undefined, target: undefined }
    if (type === STAT_CHANGE) updateEffect(index, { type, family: undefined, ...STAT_CHANGE_DEFAULTS })
    else if (isBuiltInEffect(type)) updateEffect(index, { type, family: undefined, unit: undefined, ...noStatChange })
    else updateEffect(index, { type, ...noStatChange })
  }

  function removeEffect(index: number) {
    commitEffects((body.effects ?? []).filter((_, i) => i !== index), index)
    // Later effects move up one place, and their open/closed state goes with them.
    setOpenEffects(prev => new Set([...prev].filter(i => i !== index).map(i => (i > index ? i - 1 : i))))
    setTypingName(null)
    setTypingValue(null)
  }

  function updateEffectBase(effectIndex: number, rankIndex: number, value: number) {
    const effects = [...(body.effects ?? [])]
    const effect = effects[effectIndex]
    const current = effect.base ?? Array(maxRank).fill(0)
    const updated = [...current]
    updated[rankIndex] = value
    effects[effectIndex] = { ...effect, base: updated }
    onUpdate({ effects })
  }

  function updateEffectBaseAll(effectIndex: number, values: number[]) {
    const effects = [...(body.effects ?? [])]
    effects[effectIndex] = { ...effects[effectIndex], base: values }
    onUpdate({ effects })
  }

  function updateEffectDuration(effectIndex: number, rankIndex: number, value: number) {
    const effect = (body.effects ?? [])[effectIndex]
    const updated = [...(effect.duration ?? Array(maxRank).fill(0))]
    updated[rankIndex] = value
    updateEffect(effectIndex, { duration: updated })
  }

  function replaceEffect(effectIndex: number, next: Effect) {
    const effects = [...(body.effects ?? [])]
    effects[effectIndex] = next
    onUpdate({ effects })
  }

  function addRatio(effectIndex: number) {
    replaceEffect(effectIndex, addStatPart((body.effects ?? [])[effectIndex], { stat: 'ap', part: 'total', values: Array(maxRank).fill(0) }))
  }

  // The source select on the flat row: a stat moves the flat numbers into a scaler on it.
  function changeFlatSource(effectIndex: number, source: string) {
    const effect = (body.effects ?? [])[effectIndex]
    if (source === CUSTOM_RATIO) {
      setTypingValue(`${effectIndex}:${(effect.ratios ?? []).length}`)
      replaceEffect(effectIndex, flatToStat(effect, '', maxRank))
    } else {
      replaceEffect(effectIndex, flatToStat(effect, source, maxRank))
    }
  }

  function updateRatio(effectIndex: number, ratioIndex: number, partial: Partial<RatioEntry>) {
    const effects = [...(body.effects ?? [])]
    const effect = effects[effectIndex]
    const ratios = [...(effect.ratios ?? [])]
    ratios[ratioIndex] = { ...ratios[ratioIndex], ...partial }
    effects[effectIndex] = { ...effect, ratios }
    onUpdate({ effects })
  }

  // Changing the stat keeps the chosen part if the new stat has it, and falls back to the total if not.
  function changeRatioStat(effectIndex: number, ratioIndex: number, stat: string) {
    const current = resolveRatio((body.effects ?? [])[effectIndex].ratios![ratioIndex])
    const parts = ratioStatDef(stat)?.parts ?? ['total']
    updateRatio(effectIndex, ratioIndex, { stat, part: current && parts.includes(current.part) ? current.part : 'total', assumed: undefined })
  }

  function updateRatioValue(effectIndex: number, ratioIndex: number, rankIndex: number, value: number) {
    const effects = [...(body.effects ?? [])]
    const effect = effects[effectIndex]
    const ratios = [...(effect.ratios ?? [])]
    const ratio = ratios[ratioIndex]
    const current = ratio.values ?? Array(maxRank).fill(0)
    const updated = [...current]
    updated[rankIndex] = value
    ratios[ratioIndex] = { ...ratio, values: updated }
    effects[effectIndex] = { ...effect, ratios }
    onUpdate({ effects })
  }

  function updateRatioValuesAll(effectIndex: number, ratioIndex: number, values: number[]) {
    const effects = [...(body.effects ?? [])]
    const effect = effects[effectIndex]
    const ratios = [...(effect.ratios ?? [])]
    ratios[ratioIndex] = { ...ratios[ratioIndex], values }
    effects[effectIndex] = { ...effect, ratios }
    onUpdate({ effects })
  }

  function removeRatio(effectIndex: number, ratioIndex: number) {
    const effects = [...(body.effects ?? [])]
    const effect = effects[effectIndex]
    const ratios = (effect.ratios ?? []).filter((_, i) => i !== ratioIndex)
    effects[effectIndex] = { ...effect, ratios }
    onUpdate({ effects })
  }

  return (
    <>
      {showNameDescription && (
        <>
          <div className="ability-name-row">
            <input
              className="ability-name-input"
              placeholder="ABILITY NAME"
              value={body.name ?? ''}
              onChange={e => onUpdate({ name: e.target.value })}
            />
          </div>

          <div className="ability-desc-row">
            <DescriptionField value={body.description} effects={body.effects} onChange={description => onUpdate({ description })} />
          </div>
        </>
      )}

      <div className="ability-field-group">
        <div className="ability-field-header">
          <span className="ability-field-label">Cooldown</span>
        </div>
        <div className="rank-inputs">
          {rankIndices.map(i => (
            <NumberField key={i} value={body.cooldown?.[i]} onChange={n => updateRankArray('cooldown', i, n)} />
          ))}
        </div>
      </div>

      <div className="ability-field-group">
        <div className="ability-field-header">
          <span className="ability-field-label">Cost</span>
          <select
            className="cost-type-select"
            value={body.cost_type ?? 'Mana'}
            onChange={e => onUpdate({ cost_type: e.target.value })}
          >
            {COST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="rank-inputs">
          {rankIndices.map(i => (
            <NumberField key={i} value={body.cost?.[i]} onChange={n => updateRankArray('cost', i, n)} />
          ))}
        </div>
      </div>

      <div className="ability-field-group">
        <div className="ability-field-header">
          <span className="ability-field-label">Effects</span>
          <button className="add-effect-btn" onClick={addEffect}>+ Add Effect</button>
        </div>
        {(body.effects ?? []).map((effect, i) => {
          const kind = effectKind(effect)
          const isCustom = !isBuiltInEffect(effect.type) && effect.type.trim() !== ''
          const isOpen = openEffects.has(i)
          return (
            <div key={i} className={`effect-card${isOpen ? ' open' : ''}`}>
              <div className="effect-summary-row">
                <button className="effect-summary" aria-expanded={isOpen} onClick={() => toggleEffect(i)}>
                  <span className="effect-summary-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                  <span className="effect-summary-text">{describeEffect(effect)}</span>
                  <span className="effect-summary-token" title="Write this in the description to put this effect's numbers there">{`{${tokenNames[i]}}`}</span>
                </button>
                <button className="remove-effect-btn" onClick={() => removeEffect(i)} aria-label="Remove effect">×</button>
              </div>

              {isOpen && (
                <>
                  <div className="effect-row">
                    <select
                      className="effect-type-select"
                      value={isBuiltInEffect(effect.type) ? effect.type : CUSTOM_EFFECT}
                      onChange={e => {
                        const custom = e.target.value === CUSTOM_EFFECT
                        setTypingName(custom ? i : null)
                        changeEffectType(i, custom ? '' : e.target.value)
                      }}
                      aria-label="Effect type"
                    >
                      {BUILT_IN_EFFECT_TYPES.map(t => <option key={t} value={t}>{effectTypeLabel(t)}</option>)}
                      <option value={CUSTOM_EFFECT}>Custom…</option>
                    </select>
                    {(!isBuiltInEffect(effect.type) || typingName === i) && (
                      <input
                        className="effect-type-select effect-type-input"
                        placeholder="Name it, e.g. taunt"
                        value={effect.type}
                        autoFocus={effect.type === ''}
                        onFocus={() => setTypingName(i)}
                        onChange={e => changeEffectType(i, e.target.value)}
                        onBlur={e => {
                          setTypingName(null)
                          if (!e.target.value.trim()) changeEffectType(i, 'damage')
                        }}
                      />
                    )}
                    {kind.family === 'damage' && (
                      <select
                        className="effect-type-select"
                        value={effect.damage_type ?? 'Physical'}
                        onChange={e => updateEffect(i, { damage_type: e.target.value as DamageType })}
                      >
                        {['Physical', 'Magic', 'True'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                    <label className="effect-name-field" title="What the description calls this effect: write {Name} there, or use Insert value">
                      Name
                      <input
                        className="rank-input effect-name-input"
                        placeholder={tokenNames[i]}
                        value={effect.name ?? ''}
                        onChange={e => updateEffect(i, { name: e.target.value || undefined })}
                        aria-label="Name in the description"
                      />
                    </label>
                    <input
                      className="rank-input"
                      placeholder="Notes"
                      value={effect.notes ?? ''}
                      onChange={e => updateEffect(i, { notes: e.target.value })}
                      style={{ flex: 1 }}
                    />
                  </div>

                  {isCustom && (
                    <div className="effect-custom-row">
                      <label className="effect-custom-field">
                        <span>Behaves like</span>
                        <select
                          className="effect-type-select"
                          value={kind.family}
                          onChange={e => updateEffect(i, { family: e.target.value as EffectFamily, unit: undefined })}
                        >
                          {FAMILY_OPTIONS.map(o => <option key={o.value} value={o.value} title={o.hint}>{o.label}</option>)}
                        </select>
                      </label>
                      <label className="effect-custom-field">
                        <span>Base is</span>
                        <select
                          className="effect-type-select"
                          value={kind.unit}
                          onChange={e => updateEffect(i, { unit: e.target.value as EffectUnit })}
                        >
                          {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </label>
                    </div>
                  )}

                  {effect.type === STAT_CHANGE && (() => {
                    const change = statChangeOf(effect)
                    return (
                      <div className="effect-custom-row stat-change-row">
                        <select
                          className="effect-type-select"
                          value={change.direction}
                          onChange={e => updateEffect(i, { direction: e.target.value as StatChangeDirection })}
                          aria-label="Raise or lower"
                        >
                          {DIRECTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select
                          className="effect-type-select"
                          value={change.stat}
                          onChange={e => updateEffect(i, { stat: e.target.value })}
                          aria-label="Which stat"
                        >
                          {CHANGEABLE_STATS.map(id => <option key={id} value={id}>{ratioStatDef(id)!.label}</option>)}
                        </select>
                        <span className="stat-change-word">on</span>
                        <select
                          className="effect-type-select"
                          value={change.target}
                          onChange={e => updateEffect(i, { target: e.target.value as StatChangeTarget })}
                          aria-label="Who it affects"
                        >
                          {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <span className="stat-change-word">by</span>
                        <select
                          className="effect-type-select"
                          value={kind.unit}
                          onChange={e => updateEffect(i, { unit: e.target.value as EffectUnit })}
                          aria-label="Flat or percent"
                        >
                          {UNIT_OPTIONS.filter(o => o.value !== 'seconds').map(o => <option key={o.value} value={o.value}>{o.value === 'flat' ? 'flat' : '%'}</option>)}
                        </select>
                      </div>
                    )
                  })()}

                  <div className="effect-subfield">
                    <div className="effect-subfield-header">
                      <span className="effect-subfield-label">Amount</span>
                      <button className="add-effect-btn" onClick={() => addRatio(i)}>+ Add part</button>
                    </div>
                    {hasFlatPart(effect) && (
                      <div className="ratio-row">
                        <div className="ratio-row-head">
                          <select
                            className="effect-type-select ratio-stat-select"
                            value={FLAT_SOURCE}
                            onChange={e => changeFlatSource(i, e.target.value)}
                            aria-label="Amount is"
                          >
                            <option value={FLAT_SOURCE}>Flat amount{unitSuffix(kind.unit)}</option>
                            <StatOptions />
                          </select>
                          {(effect.ratios ?? []).length > 0 && (
                            <button className="remove-effect-btn" onClick={() => replaceEffect(i, removeFlatPart(effect))} aria-label="Remove the flat amount">×</button>
                          )}
                        </div>
                        <RankValueField
                          values={effect.base}
                          maxRank={maxRank}
                          suffix={unitSuffixShort(kind.unit)}
                          onChange={(rankIndex, value) => updateEffectBase(i, rankIndex, value)}
                          onBulkChange={values => updateEffectBaseAll(i, values)}
                        />
                      </div>
                    )}
                    {(effect.ratios ?? []).map((ratio, ri) => {
                      const resolved = resolveRatio(ratio)
                      const ratioKey = `${i}:${ri}`
                      // A name that matches a known stat mid-typing keeps its name field until the user leaves it.
                      const custom = !resolved || typingValue === ratioKey
                      const parts: RatioPart[] = resolved && !custom ? ratioStatDef(resolved.stat)!.parts : ['total']
                      return (
                        <div key={ri} className="ratio-row">
                          <div className="ratio-row-head">
                            <select
                              className="effect-type-select ratio-stat-select"
                              value={custom ? CUSTOM_RATIO : resolved!.stat}
                              onChange={e => {
                                if (e.target.value === FLAT_SOURCE) {
                                  setTypingValue(null)
                                  replaceEffect(i, statToFlat(effect, ri))
                                } else if (e.target.value === CUSTOM_RATIO) {
                                  setTypingValue(ratioKey)
                                  updateRatio(i, ri, { stat: '', part: undefined })
                                } else {
                                  setTypingValue(null)
                                  changeRatioStat(i, ri, e.target.value)
                                }
                              }}
                              aria-label="Scales with"
                            >
                              <option value={FLAT_SOURCE} disabled={hasFlatPart(effect)}>Flat amount{unitSuffix(kind.unit)}</option>
                              <StatOptions />
                            </select>
                            {parts.length > 1 && (
                              <select
                                className="effect-type-select ratio-part-select"
                                value={resolved?.part ?? 'total'}
                                onChange={e => updateRatio(i, ri, { part: e.target.value as RatioPart })}
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
                                  onFocus={() => setTypingValue(ratioKey)}
                                  onChange={e => updateRatio(i, ri, { stat: e.target.value, part: undefined })}
                                  onBlur={e => {
                                    setTypingValue(null)
                                    if (!e.target.value.trim()) updateRatio(i, ri, { stat: 'ap', part: 'total', assumed: undefined })
                                  }}
                                />
                                <label className="ratio-assume" title="How many of it to assume when the win rate is estimated">
                                  assume
                                  <NumberField
                                    className="rank-input ratio-assume-input"
                                    value={assumedUnits(ratio)}
                                    placeholder="1"
                                    onChange={n => updateRatio(i, ri, { assumed: n || undefined })}
                                  />
                                </label>
                              </>
                            )}
                            {ratio.per === undefined ? (
                              <button className="ratio-per-btn" onClick={() => updateRatio(i, ri, { per: PER_DEFAULT })} title="Add this amount for every N of the stat, instead of taking a share of it">
                                per N
                              </button>
                            ) : (
                              <span className="ratio-per">
                                per
                                <NumberField
                                  className="rank-input ratio-per-input"
                                  value={ratio.per}
                                  onChange={n => updateRatio(i, ri, { per: n })}
                                />
                                <button className="ratio-per-off" onClick={() => updateRatio(i, ri, { per: undefined })} title="Back to a plain ratio" aria-label="Back to a plain ratio">↩</button>
                              </span>
                            )}
                            <button className="remove-effect-btn" onClick={() => removeRatio(i, ri)}>×</button>
                          </div>
                          <RankValueField
                            values={ratio.values}
                            maxRank={maxRank}
                            percent={!custom && ratio.per === undefined}
                            suffix={unitSuffixShort(kind.unit)}
                            onChange={(rankIndex, value) => updateRatioValue(i, ri, rankIndex, value)}
                            onBulkChange={values => updateRatioValuesAll(i, ri, values)}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {takesDuration(effect) && (
                    <div className="effect-subfield">
                      <div className="effect-subfield-header">
                        <span className="effect-subfield-label">Lasts (seconds)</span>
                      </div>
                      <RankValueField
                        values={effect.duration}
                        maxRank={maxRank}
                        suffix="s"
                        onChange={(rankIndex, value) => updateEffectDuration(i, rankIndex, value)}
                        onBulkChange={values => updateEffect(i, { duration: values })}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

interface Props {
  champion: Champion
  onChange: (c: Champion) => void
  onEditStats: () => void
}

const SLOTS: AbilitySlot[] = ['passive', 'q', 'w', 'e', 'r']
const SLOT_LABELS: Record<AbilitySlot, string> = { passive: 'P', q: 'Q', w: 'W', e: 'E', r: 'R' }

type Mode = 'simple' | 'advanced'

// Normalizes cooldown/cost/effect(base+ratios) arrays to a new rank count — shared by
// the primary ability and every block, since they're all the same AbilityBody shape.
function normalizeBodyRanks<T extends AbilityBody>(body: T, next: number): T {
  return {
    ...body,
    cooldown: body.cooldown ? normalizeRankArray(body.cooldown, next) : body.cooldown,
    cost: body.cost ? normalizeRankArray(body.cost, next) : body.cost,
    effects: body.effects?.map(effect => ({
      ...effect,
      base: effect.base ? normalizeRankArray(effect.base, next) : effect.base,
      duration: effect.duration ? normalizeRankArray(effect.duration, next) : effect.duration,
      ratios: effect.ratios?.map(r => ({ ...r, values: normalizeRankArray(r.values, next) })),
    })),
  }
}

export default function AbilitiesSection({ champion, onChange, onEditStats }: Props) {
  const [activeSlot, setActiveSlot] = useState<AbilitySlot>('passive')
  const [mode, setMode] = useState<Mode>('simple')
  const iconInputRef = useRef<HTMLInputElement>(null)

  const ability = champion.abilities[activeSlot]

  function updateAbility(partial: Partial<Ability>) {
    onChange({
      ...champion,
      abilities: {
        ...champion.abilities,
        [activeSlot]: { ...ability, ...partial }
      }
    })
  }

  function updateJournal(journal: AbilityJournal) {
    updateAbility({ journal })
  }

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const icon_path = await window.summoner.champion.saveImage(
        (file as any).path,
        `${champion.metadata.id}_${activeSlot}_icon_${Date.now()}`
      )
      updateAbility({ icon_path })
    } catch (err) {
      console.error('Ability icon upload failed', err)
    }
  }

  function updateRankCount(delta: number) {
    const next = Math.max(1, Math.min(6, ability.max_rank + delta))
    const { cooldown, cost, effects } = normalizeBodyRanks(ability, next)
    const blocks = ability.blocks?.map(b => normalizeBodyRanks(b, next))
    updateAbility({ max_rank: next, cooldown, cost, effects, blocks })
  }

  function addBlock() {
    const blocks = [...(ability.blocks ?? []), { id: generateId(), kind: 'passive' } as AbilityBlock]
    updateAbility({ blocks })
  }

  function updateBlock(index: number, partial: Partial<AbilityBlock>) {
    const blocks = [...(ability.blocks ?? [])]
    blocks[index] = { ...blocks[index], ...partial }
    updateAbility({ blocks })
  }

  function removeBlock(index: number) {
    updateAbility({ blocks: (ability.blocks ?? []).filter((_, i) => i !== index) })
  }

  function updateBlockRecast(index: number, partial: Partial<RecastStruct>) {
    const blocks = [...(ability.blocks ?? [])]
    const block = blocks[index]
    const recast: RecastStruct = { max_recasts: 1, recast_window: 3, ...block.recast, ...partial }
    blocks[index] = { ...block, recast }
    updateAbility({ blocks })
  }

  return (
    <div className="abilities-root">
      <div className="abilities-layout">
        <div className="abilities-band">
          <div className="abilities-slot-bar">
            {SLOTS.map(s => (
              <button
                key={s}
                className={`slot-btn${activeSlot === s ? ' active' : ''}${champion.abilities[s].name ? ' named' : ''}`}
                onClick={() => setActiveSlot(s)}
              >
                {champion.abilities[s].icon_path
                  ? <img className="slot-btn-icon" src={champion.abilities[s].icon_path} alt={SLOT_LABELS[s]} />
                  : SLOT_LABELS[s]}
              </button>
            ))}
          </div>
          <StatBlock champion={champion} onEdit={onEditStats} />
        </div>

        <div className="abilities-editor">
          <div className="ability-name-row">
            <div className="ability-icon-upload">
              <button
                className={`ability-icon-upload-btn${ability.icon_path ? ' has-icon' : ''}`}
                onClick={() => iconInputRef.current?.click()}
                title={ability.icon_path ? 'Replace icon' : 'Upload ability icon'}
              >
                {ability.icon_path
                  ? <img src={ability.icon_path} alt="Ability icon" />
                  : <span className="ability-icon-upload-plus">+</span>}
              </button>
              {ability.icon_path && (
                <button
                  className="ability-icon-clear"
                  onClick={() => updateAbility({ icon_path: undefined })}
                  title="Remove icon"
                >×</button>
              )}
              <input ref={iconInputRef} type="file" accept="image/*" hidden onChange={handleIconUpload} />
            </div>
            <input
              className="ability-name-input"
              placeholder="ABILITY NAME"
              value={ability.name ?? ''}
              onChange={e => updateAbility({ name: e.target.value })}
            />
          </div>

          <div className="ability-desc-row">
            <DescriptionField value={ability.description} effects={ability.effects} onChange={description => updateAbility({ description })} />
          </div>

          {mode === 'simple' && (
            <div className="ability-fields">
              <div className="rank-count-bar">
                <span className="ability-field-label">Ranks</span>
                <div className="rank-controls">
                  <button className="rank-btn" onClick={() => updateRankCount(-1)}>−</button>
                  <span className="rank-count">{ability.max_rank} ranks</span>
                  <button className="rank-btn" onClick={() => updateRankCount(1)}>+</button>
                </div>
              </div>

              <AbilityBodyEditor body={ability} maxRank={ability.max_rank} onUpdate={updateAbility} showNameDescription={false} />

              <div className="ability-blocks-section">
                <div className="ability-field-header">
                  <span className="ability-field-label">Ability Blocks</span>
                  <button className="add-effect-btn" onClick={addBlock}>+ Add Block</button>
                </div>
                <p className="ability-blocks-hint">
                  Extra passives, alternate forms (stance/form swaps), or condition-unlocked recasts under this same key.
                </p>

                {(ability.blocks ?? []).map((block, bi) => (
                  <div key={bi} className="ability-block-card">
                    <div className="ability-block-header">
                      <select
                        className="effect-type-select"
                        value={block.kind}
                        onChange={e => {
                          const kind = e.target.value as AbilityBlockKind
                          const partial: Partial<AbilityBlock> = { kind }
                          if (kind === 'recast' && !block.recast) {
                            partial.recast = { max_recasts: 1, recast_window: 3 }
                          }
                          updateBlock(bi, partial)
                        }}
                      >
                        {BLOCK_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                      <button className="remove-effect-btn" onClick={() => removeBlock(bi)}>×</button>
                    </div>

                    {block.kind === 'recast' && (
                      <div className="recast-trigger-row">
                        <label className="recast-field">
                          <span>Max recasts</span>
                          <NumberField value={block.recast?.max_recasts} onChange={n => updateBlockRecast(bi, { max_recasts: n })} />
                        </label>
                        <label className="recast-field">
                          <span>Window (s)</span>
                          <NumberField value={block.recast?.recast_window} onChange={n => updateBlockRecast(bi, { recast_window: n })} />
                        </label>
                        <input
                          className="rank-input"
                          placeholder="Unlock condition (e.g. after Q1 hits an enemy)"
                          value={block.recast?.recast_extends_on ?? ''}
                          onChange={e => updateBlockRecast(bi, { recast_extends_on: e.target.value })}
                          style={{ flex: 1 }}
                        />
                      </div>
                    )}

                    <AbilityBodyEditor
                      body={block}
                      maxRank={ability.max_rank}
                      onUpdate={partial => updateBlock(bi, partial)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'advanced' && (
            <div className="ability-advanced">
              <div className="advanced-hint">
                Advanced mode — equation fields for fine-tuned stat interactions.
                <br />
                <span className="advanced-hint-sub">Full implementation coming after Simple mode is complete.</span>
              </div>
            </div>
          )}

          <div className="abilities-mode-bar">
            <button
              className={`mode-btn${mode === 'simple' ? ' active' : ''}`}
              onClick={() => setMode('simple')}
            >
              Simple {mode === 'simple' && '(selected)'}
            </button>
            <button
              className={`mode-btn${mode === 'advanced' ? ' active' : ''}`}
              onClick={() => setMode('advanced')}
            >
              Advanced
            </button>
          </div>
        </div>

        {/* Keyed by slot so each ability opens on its own first note. */}
        <AbilityJournalPanel
          key={activeSlot}
          journal={ability.journal ?? { tabs: [] }}
          onChange={updateJournal}
          label={ability.name ? `${SLOT_LABELS[activeSlot]} · ${ability.name}` : SLOT_LABELS[activeSlot]}
        />
      </div>
    </div>
  )
}
