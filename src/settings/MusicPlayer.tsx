import { useEffect, useRef, useState } from 'react'
import { useSettings } from './useSettings'
import { useMusicTracks } from './useMusicTracks'

// Mounted once at the app root so playback survives route navigation.
export default function MusicPlayer() {
  const { settings, loaded } = useSettings()
  const { current } = useMusicTracks()
  const audioRef = useRef<HTMLAudioElement>(null)
  // The src that failed to load, so one bad file doesn't retry-loop or block picking another.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const playable = !!current && current.src !== failedSrc

  useEffect(() => {
    const el = audioRef.current
    if (!el || !loaded) return
    el.volume = settings.music_volume
    if (settings.music_enabled && playable) {
      el.play().catch(() => { /* blocked until a user gesture; the Settings toggle counts as one */ })
    } else {
      el.pause()
    }
  }, [settings.music_enabled, settings.music_volume, loaded, playable, current?.src])

  if (!current) return null

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
