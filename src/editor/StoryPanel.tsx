import { useRef } from 'react'
import type { Champion } from '../champion/types'
import { useChampionTheme } from '../audio/useChampionTheme'
import ThemeAudioPlayer from '../audio/ThemeAudioPlayer'
import './StoryPanel.css'

interface Props {
  champion: Champion
  onChange: (c: Champion) => void
}

// Splash art, the champion's theme audio and their lore — the flavour side of a champion.
export default function StoryPanel({ champion, onChange }: Props) {
  const { identity } = champion
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; w: number; h: number } | null>(null)

  function update(partial: Partial<typeof identity>) {
    onChange({ ...champion, identity: { ...identity, ...partial } })
  }

  // ── Champion theme ──
  // (A preview started here is stopped by the editor page when you leave, not when this panel
  // unmounts, so switching to Items or Identity doesn't cut the music.)
  const theme = identity.theme_audio
  const themeOwner = champion.metadata.id || 'unsaved'
  const stopTheme = useChampionTheme(s => s.stop)

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

  function handleDragStart(e: React.MouseEvent<HTMLDivElement>) {
    if (!(identity as any).image_path) return
    e.preventDefault()
    const pos = (identity as any).image_position ?? { x: 50, y: 50 }
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y, w: rect.width, h: rect.height }

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const dx = ((ev.clientX - dragRef.current.startX) / dragRef.current.w) * 100
      const dy = ((ev.clientY - dragRef.current.startY) / dragRef.current.h) * 100
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

  return (
    <div className="story-panel">
      <div className="story-media">
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
      </div>

      <div className="story-field-group story-lore-group">
        <div className="story-field-label">Lore</div>
        <textarea
          className="story-lore"
          placeholder="Write your champion's backstory..."
          value={identity.lore ?? ''}
          onChange={e => update({ lore: e.target.value })}
        />
      </div>
    </div>
  )
}
