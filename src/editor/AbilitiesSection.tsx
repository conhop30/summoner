import { useRef, useState } from 'react'
import AbilityJournalPanel from './AbilityJournal'
import StatBlock from './StatBlock'
import type { Champion, Ability, AbilityBody, AbilityBlock, AbilityBlockKind, AbilitySlot, Effect, RecastStruct, AbilityJournal } from '../champion/types'
import DescriptionField from './DescriptionField'
import EffectCard from './EffectCard'
import NumberField from './NumberField'
import { effectTokenNames, renamesBetween, retargetTokens } from '../champion/descriptionTokens'
import { newEffect } from '../champion/outcomes'
import { normalizeRankArray } from '../champion/disclosure'
import { generateId } from '../champion/utils'
import { useSettings } from '../settings/useSettings'
import './AbilitiesSection.css'

const COST_TYPES = ['Mana', 'Energy', 'Health', 'Fury', 'None']

const BLOCK_KINDS: { value: AbilityBlockKind; label: string }[] = [
  { value: 'passive', label: 'Passive' },
  { value: 'alternate_form', label: 'Alternate Form' },
  { value: 'recast', label: 'Recast' },
]

// The primary ability and every appended block share the exact same body shape
// (name/description/cooldown/cost/effects), so they share this editor too. `part` picks what it
// shows: 'simple' is the whole body, with each effect down to what it does and how much;
// 'details' is only the effects, each with the rest of what can be said about it (the Advanced tab).
function AbilityBodyEditor({ body, maxRank, onUpdate, showNameDescription = true, part = 'simple', detailsInline = true }: {
  body: AbilityBody
  maxRank: number
  onUpdate: (partial: Partial<AbilityBody>) => void
  showNameDescription?: boolean
  part?: 'simple' | 'details'
  detailsInline?: boolean
}) {
  const rankIndices = Array.from({ length: maxRank }, (_, i) => i)
  const tokenNames = effectTokenNames(body.effects)
  // Effects are one tidy line each until opened; a freshly added one opens so it can be filled in.
  const [openEffects, setOpenEffects] = useState<Set<number>>(() => new Set())

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
    commitEffects([...(body.effects ?? []), newEffect()])
    setOpenEffects(prev => new Set(prev).add(index))
  }

  function replaceEffect(index: number, next: Effect) {
    const effects = [...(body.effects ?? [])]
    effects[index] = next
    commitEffects(effects)
  }

  function removeEffect(index: number) {
    commitEffects((body.effects ?? []).filter((_, i) => i !== index), index)
    // Later effects move up one place, and their open/closed state goes with them.
    setOpenEffects(prev => new Set([...prev].filter(i => i !== index).map(i => (i > index ? i - 1 : i))))
  }

  const effectCards = (body.effects ?? []).map((effect, i) => (
    <EffectCard
      key={i}
      effect={effect}
      tokenName={tokenNames[i]}
      maxRank={maxRank}
      open={openEffects.has(i)}
      onToggle={() => toggleEffect(i)}
      onChange={next => replaceEffect(i, next)}
      onRemove={() => removeEffect(i)}
      part={part}
      detailsInline={detailsInline}
    />
  ))

  if (part === 'details') {
    return effectCards.length > 0
      ? <div className="ability-field-group">{effectCards}</div>
      : <p className="ability-blocks-hint">No effects yet. Add one on the Simple tab and it appears here, with nothing filled in.</p>
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
        {effectCards}
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
  // Where an effect's extra details live: under each effect, or on the Advanced tab (a setting).
  const detailsInline = useSettings(st => st.settings.effect_details) !== 'tab'
  const activeMode: Mode = detailsInline ? 'simple' : mode
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

          {activeMode === 'simple' && (
            <div className="ability-fields">
              <div className="rank-count-bar">
                <span className="ability-field-label">Ranks</span>
                <div className="rank-controls">
                  <button className="rank-btn" onClick={() => updateRankCount(-1)}>−</button>
                  <span className="rank-count">{ability.max_rank} ranks</span>
                  <button className="rank-btn" onClick={() => updateRankCount(1)}>+</button>
                </div>
              </div>

              <AbilityBodyEditor body={ability} maxRank={ability.max_rank} onUpdate={updateAbility} showNameDescription={false} detailsInline={detailsInline} />

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
                      detailsInline={detailsInline}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeMode === 'advanced' && (
            <div className="ability-advanced">
              <AbilityBodyEditor body={ability} maxRank={ability.max_rank} onUpdate={updateAbility} showNameDescription={false} part="details" />
              {(ability.blocks ?? []).map((block, bi) => (
                <div key={bi} className="ability-advanced-block">
                  <div className="ability-field-label">{BLOCK_KINDS.find(k => k.value === block.kind)?.label}{block.name ? ` · ${block.name}` : ''}</div>
                  <AbilityBodyEditor body={block} maxRank={ability.max_rank} onUpdate={partial => updateBlock(bi, partial)} showNameDescription={false} part="details" />
                </div>
              ))}
            </div>
          )}

          {!detailsInline && (
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
          )}
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
