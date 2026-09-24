import { useEffect, useRef } from 'react'
import { useSettings } from '../settings/useSettings'
import { useChampionTheme } from './useChampionTheme'

// Mounted once at the app root (next to MusicPlayer) so a theme keeps playing across route
// changes until it ends or a page stops it. Plays at its own volume (the theme volume setting).
// It owns the single <audio> element; the editor's player only reads and drives the store.
export default function ThemePlayer() {
  const playing = useChampionTheme(s => s.playing)
  const paused = useChampionTheme(s => s.paused)
  const seekRequest = useChampionTheme(s => s.seekRequest)
  const stop = useChampionTheme(s => s.stop)
  const volume = useSettings(s => s.settings.theme_volume)
  const audioRef = useRef<HTMLAudioElement>(null)

  const applySeek = () => {
    const el = audioRef.current
    const { seekRequest: t } = useChampionTheme.getState()
    if (!el || t === null || el.readyState < 1) return
    el.currentTime = t
    useChampionTheme.setState({ seekRequest: null })
  }

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
  }, [playing?.src, volume])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (paused) el.pause()
    else el.play().catch(() => stop())
  }, [playing?.src, paused, stop])

  useEffect(applySeek, [seekRequest])

  // Report progress every frame while playing, so the bar glides instead of ticking at the
  // ~4Hz `timeupdate` rate.
  useEffect(() => {
    if (!playing || paused) return
    let raf = 0
    const tick = () => {
      const el = audioRef.current
      if (el) useChampionTheme.getState().setProgress(el.currentTime, Number.isFinite(el.duration) ? el.duration : 0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing?.src, paused])

  if (!playing) return null
  // Keyed by src so switching champions swaps the element cleanly. A theme plays once, then
  // hands the sound back to the background music.
  return (
    <audio
      key={playing.src}
      ref={audioRef}
      src={playing.src}
      onLoadedMetadata={e => {
        const d = e.currentTarget.duration
        useChampionTheme.getState().setProgress(0, Number.isFinite(d) ? d : 0)
        applySeek()
      }}
      onEnded={() => stop()}
      onError={() => stop()}
    />
  )
}
