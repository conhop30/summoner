import { useEffect, useRef } from 'react'
import { useSettings } from '../settings/useSettings'
import { useChampionTheme } from './useChampionTheme'

// Mounted once at the app root (next to MusicPlayer) so a theme keeps playing across route
// changes until it ends or a page stops it. Plays at the same volume as the background music.
export default function ThemePlayer() {
  const playing = useChampionTheme(s => s.playing)
  const stop = useChampionTheme(s => s.stop)
  const volume = useSettings(s => s.settings.music_volume)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
    el.play().catch(() => stop())
  }, [playing?.src, volume, stop])

  if (!playing) return null
  // Keyed by src so switching champions swaps the element cleanly. A theme plays once, then
  // hands the sound back to the background music.
  return <audio key={playing.src} ref={audioRef} src={playing.src} onEnded={() => stop()} onError={() => stop()} />
}
