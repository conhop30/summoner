import { useEffect, useRef, useState } from 'react'
import { useSettings } from './useSettings'
import { useMusicTracks } from './useMusicTracks'
import { useChampionTheme } from '../audio/useChampionTheme'

// Mounted once at the app root so playback survives route navigation.
export default function MusicPlayer() {
  const { settings, loaded } = useSettings()
  const { current } = useMusicTracks()
  // A playing champion theme takes over: the background track pauses where it is and picks
  // up from there once the theme ends or is stopped.
  const themePlaying = useChampionTheme(s => !!s.playing)
  const audioRef = useRef<HTMLAudioElement>(null)
  // The src that failed to load, so one bad file doesn't retry-loop or block picking another.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const playable = !!current && current.src !== failedSrc

  useEffect(() => {
    const el = audioRef.current
    if (!el || !loaded) return
    el.volume = settings.music_volume
    if (settings.music_enabled && playable && !themePlaying) {
      el.play().catch(() => { /* blocked until a user gesture; the Settings toggle counts as one */ })
    } else {
      el.pause()
    }
  }, [settings.music_enabled, settings.music_volume, loaded, playable, current?.src, themePlaying])

  // Off means off: no element at all, so nothing is loaded or decoded in the background.
  if (!settings.music_enabled || !current) return null

  // Keyed by src so choosing another song swaps the element cleanly.
  return (
    <audio
      key={current.src}
      ref={audioRef}
      src={current.src}
      loop
      onError={() => setFailedSrc(current.src)}
    />
  )
}
