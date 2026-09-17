import { useState } from 'react'
import AbilityJournalPanel from './AbilityJournal'
import type { Champion, Ability, AbilitySlot, Effect, EffectType, AbilityJournal } from '../champion/types'
import { normalizeRankArray } from '../champion/disclosure'
import './AbilitiesSection.css'

interface Props {
  champion: Champion
  onChange: (c: Champion) => void
}

const SLOTS: AbilitySlot[] = ['passive', 'q', 'w', 'e', 'r']
const SLOT_LABELS: Record<AbilitySlot, string> = { passive: 'P', q: 'Q', w: 'W', e: 'E', r: 'R' }

const EFFECT_TYPES: EffectType[] = [
  'damage', 'heal', 'shield', 'slow', 'stun', 'knock_up',
  'knock_back', 'charm', 'fear', 'silence', 'speed_boost',
  'armor_modifier', 'magic_resistance_modifier', 'dash',
]

const COST_TYPES = ['Mana', 'Energy', 'Health', 'Fury', 'None']

type Mode = 'simple' | 'advanced'

export default function AbilitiesSection({ champion, onChange }: Props) {
  const [activeSlot, setActiveSlot] = useState<AbilitySlot>('passive')
  const [mode, setMode] = useState<Mode>('simple')
  const [journalOpen, setJournalOpen] = useState(false)

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

  function updateRankArray(key: 'cooldown' | 'cost', index: number, raw: string) {
    const current = ability[key] ?? Array(ability.max_rank).fill(0)
    const updated = [...current]
    updated[index] = raw === '' ? 0 : parseFloat(raw)
    updateAbility({ [key]: updated })
  }

  function addEffect() {
    const effects = [...(ability.effects ?? []), { type: 'damage' } as Effect]
    updateAbility({ effects })
  }

  function updateEffect(index: number, partial: Partial<Effect>) {
    const effects = [...(ability.effects ?? [])]
    effects[index] = { ...effects[index], ...partial }
    updateAbility({ effects })
  }

  function removeEffect(index: number) {
    const effects = (ability.effects ?? []).filter((_, i) => i !== index)
    updateAbility({ effects })
  }

  function updateRankCount(delta: number) {
    const next = Math.max(1, Math.min(6, ability.max_rank + delta))
    const cooldown = normalizeRankArray(ability.cooldown ?? [], next)
    const cost = normalizeRankArray(ability.cost ?? [], next)
    updateAbility({ max_rank: next, cooldown, cost })
  }

  const rankIndices = Array.from({ length: ability.max_rank }, (_, i) => i)

  return (
    <div className="abilities-root" style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        className="abilities-content"
        style={{
          marginRight: journalOpen ? '320px' : '0',
          transition: 'margin-right 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="abilities-slot-bar">
          {SLOTS.map(s => (
            <button
              key={s}
              className={`slot-btn${activeSlot === s ? ' active' : ''}${champion.abilities[s].name ? ' named' : ''}`}
              onClick={() => setActiveSlot(s)}
            >
              {SLOT_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="abilities-editor">
          <div className="ability-name-row">
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
              <div className="ability-field-group">
                <div className="ability-field-header">
                  <span className="ability-field-label">Cooldown</span>
                  <div className="rank-controls">
                    <button className="rank-btn" onClick={() => updateRankCount(-1)}>−</button>
                    <span className="rank-count">{ability.max_rank} ranks</span>
                    <button className="rank-btn" onClick={() => updateRankCount(1)}>+</button>
                  </div>
                </div>
                <div className="rank-inputs">
                  {rankIndices.map(i => (
                    <input
                      key={i}
                      className="rank-input"
                      type="number"
                      placeholder="0"
                      value={ability.cooldown?.[i] ?? ''}
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
                    value={ability.cost_type ?? 'Mana'}
                    onChange={e => updateAbility({ cost_type: e.target.value })}
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
                      value={ability.cost?.[i] ?? ''}
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
                {(ability.effects ?? []).map((effect, i) => (
                  <div key={i} className="effect-row">
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
      </div>

      <AbilityJournalPanel
        journal={ability.journal ?? { tabs: [] }}
        onChange={updateJournal}
        isOpen={journalOpen}
        onToggle={() => setJournalOpen(o => !o)}
      />
    </div>
  )
}