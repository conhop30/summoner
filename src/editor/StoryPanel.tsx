import { useEffect, useRef, useState } from 'react'
import type { Champion, ChampionClass, ChampionRole } from '../champion/types'
import { setClass, removeClass, setRole, removeRole, setAttackType, removeAttackType } from '../champion/disclosure'
import { useChampionTheme } from '../audio/useChampionTheme'
import ThemeAudioPlayer from '../audio/ThemeAudioPlayer'
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

export default function StoryPanel({ champion, onChange }: Props) {
  const { identity } = champion
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const [customPlaystyle, setCustomPlaystyle] = useState('')

  function update(partial: Partial<typeof identity>) {
    onChange({ ...champion, identity: { ...identity, ...partial } })
  }

  // ── Champion theme ──
  const theme = identity.theme_audio
  const themeOwner = champion.metadata.id || 'unsaved'
  const stopTheme = useChampionTheme(s => s.stop)
  // A preview started here shouldn't keep playing once you leave the editor.
  useEffect(() => () => stopTheme(themeOwner), [themeOwner, stopTheme])

  async function pickTheme() {
    const picked = await window.summoner.champion.pickTheme(champion.metadata.id)
    if (!picked) return
    if (theme) { stopTheme(themeOwner); window.summoner.champion.removeTheme(theme.src) }
    update({ theme_audio: picked })
  }

  function removeTheme() {
    if (!theme) return
    stopTheme(themeOwner)
    window.summoner.champion.removeTheme(theme.src)
    update({ theme_audio: undefined })
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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const championId = champion.metadata.id || 'temp-' + Date.now()
    const timestamp = Date.now()
    try {
      const permanentPath = await window.summoner.champion.saveImage((file as any).path, `${championId}_${timestamp}`)
      update({ image_path: permanentPath, image_position: { x: 50, y: 50 } } as any)
    } catch {
      const tempUrl = URL.createObjectURL(file)
      update({ image_path: tempUrl, image_position: { x: 50, y: 50 } } as any)
    }
  }

  function handleDragStart(e: React.MouseEvent) {
    if (!(identity as any).image_path) return
    e.preventDefault()
    const pos = (identity as any).image_position ?? { x: 50, y: 50 }
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y }

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const dx = ((ev.clientX - dragRef.current.startX) / 280) * 100
      const dy = ((ev.clientY - dragRef.current.startY) / 360) * 100
      const x = Math.max(0, Math.min(100, dragRef.current.originX - dx))
      const y = Math.max(0, Math.min(100, dragRef.current.originY - dy))
      update({ image_position: { x, y } } as any)
    }

    function onUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
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
    <div className="story-panel">
      <input
        className="story-name-input"
        placeholder="CHAMPION NAME"
        value={identity.name}
        onChange={e => update({ name: e.target.value })}
      />
      <input
        className="story-title-input"
        placeholder="Title"
        value={identity.title ?? ''}
        onChange={e => update({ title: e.target.value })}
      />

      <div className="story-splash-wrap">
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
        <div
          className={`story-splash${(identity as any).image_path ? ' has-image' : ''}`}
          onClick={() => !(identity as any).image_path && fileRef.current?.click()}
          onMouseDown={handleDragStart}
        >
          {(identity as any).image_path ? (
            <>
              <img
                src={(identity as any).image_path}
                alt="splash"
                className="story-splash-img"
                style={{ objectPosition: `${(identity as any).image_position?.x ?? 50}% ${(identity as any).image_position?.y ?? 50}%` }}
                draggable={false}
              />
              <div className="story-splash-reupload"
                onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                onMouseDown={e => e.stopPropagation()}>
                Change
              </div>
              <div className="story-splash-drag-hint">Drag to reposition</div>
            </>
          ) : (
            <div className="story-splash-placeholder">
              <span className="story-splash-icon">+</span>
              <span className="story-splash-hint">Upload splash art</span>
            </div>
          )}
        </div>
      </div>

      <div className="story-field-group">
        <div className="story-field-label">Champion theme</div>
        {theme ? (
          <ThemeAudioPlayer
            owner={themeOwner}
            name={theme.name}
            src={theme.src}
            onReplace={pickTheme}
            onRemove={removeTheme}
          />
        ) : (
          <button className="story-theme-add" onClick={pickTheme}>+ Add theme audio</button>
        )}
      </div>

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
        <div className="story-field-label">Lore</div>
        <textarea
          className="story-lore"
          placeholder="Write your champion's backstory..."
          value={identity.lore ?? ''}
          onChange={e => update({ lore: e.target.value })}
        />
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