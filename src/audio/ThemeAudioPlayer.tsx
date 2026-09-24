import { useEffect, useRef, useState } from 'react'
import { useChampionTheme } from './useChampionTheme'
import MistCanvas, { MIST_PAD } from './MistCanvas'
import './ThemeAudioPlayer.css'

interface Props {
  // Identifies whose theme this is in the shared store (`metadata.id`, or a placeholder
  // while the champion hasn't been saved yet).
  owner: string
  name: string
  src: string
  onReplace: () => void
  onRemove: () => void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// The champion theme's player, used in the editor: outlined play/pause, a seekable progress
// bar drawn as hextech mist (no bar at all: drifting mist fills the played part, and hovering
// turns it gold and marks where a click will land), and elapsed / total time. Playback itself lives in ThemePlayer at the
// app root, so a theme keeps going if you navigate; this just drives and displays it.
export default function ThemeAudioPlayer({ owner, name, src, onReplace, onRemove }: Props) {
  const isLoaded = useChampionTheme(s => s.playing?.championId === owner && s.playing.src === src)
  const paused = useChampionTheme(s => s.paused)
  const liveTime = useChampionTheme(s => s.time)
  const liveDuration = useChampionTheme(s => s.duration)
  const play = useChampionTheme(s => s.play)
  const pause = useChampionTheme(s => s.pause)
  const seek = useChampionTheme(s => s.seek)

  const isPlaying = isLoaded && !paused

  // Length is shown even before anything plays, so read it from the file's metadata.
  const [idleDuration, setIdleDuration] = useState(0)
  useEffect(() => {
    setIdleDuration(0)
    const probe = new Audio()
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => setIdleDuration(Number.isFinite(probe.duration) ? probe.duration : 0)
    probe.src = src
    return () => { probe.onloadedmetadata = null; probe.removeAttribute('src'); probe.load() }
  }, [src])

  const duration = isLoaded && liveDuration > 0 ? liveDuration : idleDuration
  const time = isLoaded ? liveTime : 0
  const fraction = duration > 0 ? Math.min(1, time / duration) : 0

  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [hover, setHover] = useState<number | null>(null)

  // Position under the pointer, using the same inset the mist is drawn with.
  function fractionAt(clientX: number): number | null {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= MIST_PAD * 2) return null
    return Math.max(0, Math.min(1, (clientX - rect.left - MIST_PAD) / (rect.width - MIST_PAD * 2)))
  }

  function start() { play({ championId: owner, name, src }) }

  function toggle() {
    if (isPlaying) pause()
    else start()
  }

  // Jump to a spot on the bar; from idle this also starts playback there.
  function seekToPointer(clientX: number) {
    const f = fractionAt(clientX)
    if (f === null || duration <= 0) return
    if (!isLoaded) start()
    seek(f * duration)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (duration <= 0) return
    const step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0
    if (!step) return
    e.preventDefault()
    if (!isLoaded) start()
    seek(Math.max(0, Math.min(duration, time + step)))
  }

  return (
    <div className="tap">
      <div className="tap-top">
        <button
          className={`tap-play${isPlaying ? ' playing' : ''}`}
          onClick={toggle}
          title={isPlaying ? 'Pause the theme' : 'Play the theme (pauses the background music)'}
          aria-label={isPlaying ? 'Pause the theme' : 'Play the theme'}
        >
          {/* Outlined shapes, stroked in gold rather than filled. */}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
            {isPlaying
              ? <><rect x="6" y="5" width="4" height="14" rx="0.8" /><rect x="14" y="5" width="4" height="14" rx="0.8" /></>
              : <path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l10.6-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z" />}
          </svg>
        </button>
        <span className="tap-name" title={name}>{name}</span>
        <button className="tap-action" onClick={onReplace}>Replace</button>
        <button className="tap-remove" onClick={onRemove} title="Remove the theme" aria-label="Remove the theme">×</button>
      </div>

      <div className="tap-bottom">
        <div
          className="mist-bar"
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Theme position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          onKeyDown={onKeyDown}
          onPointerDown={e => {
            dragging.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            seekToPointer(e.clientX)
          }}
          onPointerMove={e => {
            setHover(fractionAt(e.clientX))
            if (dragging.current) seekToPointer(e.clientX)
          }}
          onPointerUp={e => {
            dragging.current = false
            e.currentTarget.releasePointerCapture(e.pointerId)
            const r = e.currentTarget.getBoundingClientRect()
            if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setHover(null)
          }}
          onPointerCancel={() => { dragging.current = false; setHover(null) }}
          onPointerLeave={() => { if (!dragging.current) setHover(null) }}
        >
          <MistCanvas fraction={fraction} active={isPlaying} hover={hover} />
        </div>
        {/* While hovering, the readout shows the time a click would jump to. */}
        <span className={`tap-time${hover !== null ? ' hovering' : ''}`}>
          {formatTime(hover !== null ? hover * duration : time)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
