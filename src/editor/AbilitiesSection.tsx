import { useRef, useState } from 'react'
import AbilityJournalPanel from './AbilityJournal'
import StatBlock from './StatBlock'
import type { Champion, Ability, AbilityBody, AbilityBlock, AbilityBlockKind, AbilitySlot, Effect, EffectType, RatioEntry, RecastStruct, AbilityJournal } from '../champion/types'
import { normalizeRankArray } from '../champion/disclosure'
import './AbilitiesSection.css'

const RATIO_STAT_OPTIONS = ['AP', 'Bonus AD', 'Total AD', 'Max Health', 'Missing Health', 'Bonus Health', 'Armor', 'Magic Resist']

const EFFECT_TYPES: EffectType[] = [
  'damage', 'heal', 'shield', 'slow', 'stun', 'knock_up',
  'knock_back', 'charm', 'fear', 'silence', 'speed_boost',
  'armor_modifier', 'magic_resistance_modifier', 'dash',
]

const COST_TYPES = ['Mana', 'Energy', 'Health', 'Fury', 'None']

const BLOCK_KINDS: { value: AbilityBlockKind; label: string }[] = [
  { value: 'passive', label: 'Passive' },
  { value: 'alternate_form', label: 'Alternate Form' },
  { value: 'recast', label: 'Recast' },
]

// After the first two ranks are filled in, suggest the arithmetic step between
// them as the scaling rule for the rest — the user accepts or keeps typing manually.
function RankValueField({ values, maxRank, onChange, onBulkChange }: {
  values: number[] | undefined
  maxRank: number
  onChange: (rankIndex: number, raw: string) => void
  onBulkChange: (newValues: number[]) => void
}) {
  const rankIndices = Array.from({ length: maxRank }, (_, i) => i)
  const v0 = values?.[0]
  const v1 = values?.[1]
  const hasStep = maxRank > 2 && v0 !== undefined && v1 !== undefined
  const step = hasStep ? Math.round((v1! - v0!) * 100) / 100 : 0
  const projected = hasStep
    ? rankIndices.map(i => (i < 2 ? values![i] : Math.round((v0! + step * i) * 100) / 100))
    : []
  const suggestionApplicable = hasStep && rankIndices.slice(2).some(i => (values?.[i] ?? 0) !== projected[i])

  // A single bulk update, not N sequential onChange calls — the latter would each
  // read the same pre-update `ability` prop and clobber one another (only the last wins).
  function acceptSuggestion() {
    onBulkChange(rankIndices.map(i => (i < 2 ? (values?.[i] ?? 0) : projected[i])))
  }

  return (
    <div className="rank-value-field">
      <div className="rank-inputs">
        {rankIndices.map(i => (
          <input
            key={i}
            className="rank-input"
            type="number"
            placeholder="0"
            value={values?.[i] ?? ''}
            onChange={e => onChange(i, e.target.value)}
          />
        ))}
      </div>
      {suggestionApplicable && (
        <button className="rank-suggestion-chip" onClick={acceptSuggestion}>
          Suggest {step >= 0 ? '+' : ''}{step} per rank — Accept
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

  function updateRankArray(key: 'cooldown' | 'cost', index: number, raw: string) {
    const current = body[key] ?? Array(maxRank).fill(0)
    const updated = [...current]
    updated[index] = raw === '' ? 0 : parseFloat(raw)
    onUpdate({ [key]: updated })
  }

  function addEffect() {
    onUpdate({ effects: [...(body.effects ?? []), { type: 'damage' } as Effect] })
  }

  function updateEffect(index: number, partial: Partial<Effect>) {
    const effects = [...(body.effects ?? [])]
    effects[index] = { ...effects[index], ...partial }
    onUpdate({ effects })
  }

  function removeEffect(index: number) {
    onUpdate({ effects: (body.effects ?? []).filter((_, i) => i !== index) })
  }

  function updateEffectBase(effectIndex: number, rankIndex: number, raw: string) {
    const effects = [...(body.effects ?? [])]
    const effect = effects[effectIndex]
    const current = effect.base ?? Array(maxRank).fill(0)
    const updated = [...current]
    updated[rankIndex] = raw === '' ? 0 : parseFloat(raw)
    effects[effectIndex] = { ...effect, base: updated }
    onUpdate({ effects })
  }

  function updateEffectBaseAll(effectIndex: number, values: number[]) {
    const effects = [...(body.effects ?? [])]
    effects[effectIndex] = { ...effects[effectIndex], base: values }
    onUpdate({ effects })
  }

  function addRatio(effectIndex: number) {
    const effects = [...(body.effects ?? [])]
    const effect = effects[effectIndex]
    const ratios = [...(effect.ratios ?? []), { stat: 'AP', values: Array(maxRank).fill(0) } as RatioEntry]
    effects[effectIndex] = { ...effect, ratios }
    onUpdate({ effects })
  }

  function updateRatioStat(effectIndex: number, ratioIndex: number, stat: string) {
    const effects = [...(body.effects ?? [])]
    const effect = effects[effectIndex]
    const ratios = [...(effect.ratios ?? [])]
    ratios[ratioIndex] = { ...ratios[ratioIndex], stat }
    effects[effectIndex] = { ...effect, ratios }
    onUpdate({ effects })
  }

  function updateRatioValue(effectIndex: number, ratioIndex: number, rankIndex: number, raw: string) {
    const effects = [...(body.effects ?? [])]
    const effect = effects[effectIndex]
    const ratios = [...(effect.ratios ?? [])]
    const ratio = ratios[ratioIndex]
    const current = ratio.values ?? Array(maxRank).fill(0)
    const updated = [...current]
    updated[rankIndex] = raw === '' ? 0 : parseFloat(raw)
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
            <textarea
              className="ability-desc"
              placeholder="Describe what this ability does..."
              value={body.description ?? ''}
              onChange={e => onUpdate({ description: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="ability-field-group">
        <div className="ability-field-header">
          <span className="ability-field-label">Cooldown</span>
        </div>
        <div className="rank-inputs">
          {rankIndices.map(i => (
            <input
              key={i}
              className="rank-input"
              type="number"
              placeholder="0"
              value={body.cooldown?.[i] ?? ''}
              onChange={e => updateRankArray('cooldown', i, e.target.value)}
            />
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
            <input
              key={i}
              className="rank-input"
              type="number"
              placeholder="0"
              value={body.cost?.[i] ?? ''}
              onChange={e => updateRankArray('cost', i, e.target.value)}
            />
          ))}
        </div>
      </div>

      <div className="ability-field-group">
        <div className="ability-field-header">
          <span className="ability-field-label">Effects</span>
          <button className="add-effect-btn" onClick={addEffect}>+ Add Effect</button>
        </div>
        {(body.effects ?? []).map((effect, i) => (
          <div key={i} className="effect-card">
            <div className="effect-row">
              <select
                className="effect-type-select"
                value={effect.type}
                onChange={e => updateEffect(i, { type: e.target.value as EffectType })}
              >
                {EFFECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {effect.type === 'damage' && (
                <select
                  className="effect-type-select"
                  value={effect.damage_type ?? 'Physical'}
                  onChange={e => updateEffect(i, { damage_type: e.target.value as any })}
                >
                  {['Physical', 'Magic', 'True'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <input
                className="rank-input"
                placeholder="Notes"
                value={effect.notes ?? ''}
                onChange={e => updateEffect(i, { notes: e.target.value })}
                style={{ flex: 1 }}
              />
              <button className="remove-effect-btn" onClick={() => removeEffect(i)}>×</button>
            </div>

            <div className="effect-subfield">
              <span className="effect-subfield-label">Base per rank</span>
              <RankValueField
                values={effect.base}
                maxRank={maxRank}
                onChange={(rankIndex, raw) => updateEffectBase(i, rankIndex, raw)}
                onBulkChange={values => updateEffectBaseAll(i, values)}
              />
            </div>

            <div className="effect-subfield">
              <div className="effect-subfield-header">
                <span className="effect-subfield-label">Ratios</span>
                <button className="add-effect-btn" onClick={() => addRatio(i)}>+ Add Ratio</button>
              </div>
              {(effect.ratios ?? []).map((ratio, ri) => (
                <div key={ri} className="ratio-row">
                  <input
                    className="rank-input ratio-stat-input"
                    list="ratio-stat-options"
                    placeholder="e.g. AP"
                    value={ratio.stat}
                    onChange={e => updateRatioStat(i, ri, e.target.value)}
                  />
                  <RankValueField
                    values={ratio.values}
                    maxRank={maxRank}
                    onChange={(rankIndex, raw) => updateRatioValue(i, ri, rankIndex, raw)}
                    onBulkChange={values => updateRatioValuesAll(i, ri, values)}
                  />
                  <button className="remove-effect-btn" onClick={() => removeRatio(i, ri)}>×</button>
                </div>
              ))}
            </div>
          </div>
        ))}
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
    const blocks = [...(ability.blocks ?? []), { kind: 'passive' } as AbilityBlock]
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
            <textarea
              className="ability-desc"
              placeholder="Describe what this ability does..."
              value={ability.description ?? ''}
              onChange={e => updateAbility({ description: e.target.value })}
            />
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
                          <input
                            className="rank-input"
                            type="number"
                            value={block.recast?.max_recasts ?? ''}
                            onChange={e => updateBlockRecast(bi, { max_recasts: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                          />
                        </label>
                        <label className="recast-field">
                          <span>Window (s)</span>
                          <input
                            className="rank-input"
                            type="number"
                            value={block.recast?.recast_window ?? ''}
                            onChange={e => updateBlockRecast(bi, { recast_window: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                          />
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

              <datalist id="ratio-stat-options">
                {RATIO_STAT_OPTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
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
