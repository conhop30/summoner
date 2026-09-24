import { useState } from 'react'
import type { Champion, ChampionClass, ChampionRole } from '../champion/types'
import { setClass, removeClass, setRole, removeRole, setAttackType, removeAttackType } from '../champion/disclosure'
import './StoryPanel.css'

interface Props {
  champion: Champion
  onChange: (c: Champion) => void
}

const CLASSES: ChampionClass[] = ['Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank']
const ROLES: ChampionRole[] = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
const ATTACK_TYPES = ['Melee', 'Ranged']
const RESOURCE_TYPES = ['Mana', 'Energy', 'Fury', 'Heat', 'None']
const DEFAULT_PLAYSTYLES = [
  'Burst damage', 'Poke', 'Sustain', 'Engage', 'Peel',
  'Skirmisher', 'Split push', 'Crowd control', 'Diver', 'Siege',
]

interface TagInputProps {
  tags: string[]
  allTags: string[]
  onChange: (tags: string[]) => void
}

function TagInput({ tags, allTags, onChange }: TagInputProps) {
  const [input, setInput] = useState('')
  const suggestions = input.trim()
    ? allTags.filter(t => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t))
    : []

  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed || tags.includes(trimmed)) return
    onChange([...tags, trimmed])
    setInput('')
  }

  function removeTag(tag: string) { onChange(tags.filter(t => t !== tag)) }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addTag(input) }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) removeTag(tags[tags.length - 1])
  }

  return (
    <div className="tag-input-wrap">
      <div className="tag-input-row">
        {tags.map(tag => (
          <span key={tag} className="tag-pill">
            {tag}
            <button className="tag-remove" onClick={() => removeTag(tag)}>×</button>
          </span>
        ))}
        <input
          className="tag-input"
          placeholder="Add tag..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="tag-suggestions">
          {suggestions.map(s => (
            <button key={s} className="tag-suggestion" onClick={() => addTag(s)}>{s}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// Class, lane, attack type, resource, playstyle and tags — the classification side of a champion.
export default function IdentityPanel({ champion, onChange }: Props) {
  const { identity } = champion
  const [customPlaystyle, setCustomPlaystyle] = useState('')

  function update(partial: Partial<typeof identity>) {
    onChange({ ...champion, identity: { ...identity, ...partial } })
  }

  const playstyle: string[] = (identity as any).playstyle ?? []

  function togglePlaystyle(val: string) {
    const next = playstyle.includes(val)
      ? playstyle.filter(p => p !== val)
      : [...playstyle, val]
    update({ playstyle: next } as any)
  }

  function addCustomPlaystyle() {
    const trimmed = customPlaystyle.trim()
    if (!trimmed || playstyle.includes(trimmed)) return
    update({ playstyle: [...playstyle, trimmed] } as any)
    setCustomPlaystyle('')
  }

  function toggleClass(val: ChampionClass) {
    const next = (identity.class ?? []).includes(val) ? removeClass(identity, val) : setClass(identity, val)
    onChange({ ...champion, identity: next })
  }

  function toggleRole(val: ChampionRole) {
    const next = (identity.role ?? []).includes(val) ? removeRole(identity, val) : setRole(identity, val)
    onChange({ ...champion, identity: next })
  }

  function toggleAttackType(val: string) {
    const next = (identity.attack_type ?? []).includes(val) ? removeAttackType(identity, val) : setAttackType(identity, val)
    onChange({ ...champion, identity: next })
  }

  return (
    <div className="identity-panel">
      <div className="story-field-group">
        <div className="story-field-label">Class</div>
        <div className="story-pills">
          {CLASSES.map(c => (
            <button key={c} className={`story-pill${(identity.class ?? []).includes(c) ? ' on' : ''}`} onClick={() => toggleClass(c)}>{c}</button>
          ))}
        </div>
      </div>

      <div className="story-field-group">
        <div className="story-field-label">Lane</div>
        <div className="story-pills">
          {ROLES.map(r => (
            <button key={r} className={`story-pill${(identity.role ?? []).includes(r) ? ' on' : ''}`} onClick={() => toggleRole(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="story-field-group">
        <div className="story-field-label">Attack type</div>
        <div className="story-pills">
          {ATTACK_TYPES.map(a => (
            <button key={a} className={`story-pill${(identity.attack_type ?? []).includes(a) ? ' on' : ''}`} onClick={() => toggleAttackType(a)}>{a}</button>
          ))}
        </div>
      </div>

      <div className="story-field-group">
        <div className="story-field-label">Resource</div>
        <div className="story-pills">
          {RESOURCE_TYPES.map(r => (
            <button key={r} className={`story-pill${identity.resource_type === r ? ' on' : ''}`}
              onClick={() => update({ resource_type: identity.resource_type === r ? undefined : r })}>{r}</button>
          ))}
        </div>
      </div>

      <div className="story-field-group">
        <div className="story-field-label">Playstyle</div>
        <div className="story-pills">
          {DEFAULT_PLAYSTYLES.map(p => (
            <button key={p} className={`story-pill${playstyle.includes(p) ? ' on' : ''}`} onClick={() => togglePlaystyle(p)}>{p}</button>
          ))}
        </div>
        <div className="story-custom-row">
          <input
            className="story-custom-input"
            placeholder="Custom playstyle..."
            value={customPlaystyle}
            onChange={e => setCustomPlaystyle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomPlaystyle()}
          />
          <button className="story-custom-add" onClick={addCustomPlaystyle}>+</button>
        </div>
        {playstyle.filter(p => !DEFAULT_PLAYSTYLES.includes(p)).length > 0 && (
          <div className="story-pills" style={{ marginTop: 4 }}>
            {playstyle.filter(p => !DEFAULT_PLAYSTYLES.includes(p)).map(p => (
              <button key={p} className="story-pill on" onClick={() => togglePlaystyle(p)}>{p} ×</button>
            ))}
          </div>
        )}
      </div>

      <div className="story-field-group">
        <div className="story-field-label">Tags</div>
        <TagInput
          tags={champion.metadata.tags}
          allTags={[]}
          onChange={tags => onChange({ ...champion, metadata: { ...champion.metadata, tags } })}
        />
      </div>
    </div>
  )
}
