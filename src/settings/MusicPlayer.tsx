import { useEffect, useRef, useState } from 'react'
import { useSettings } from './useSettings'

const TRACK_SRC = '/audio/theme.mp3'

// Mounted once at the app root so playback survives route navigation.
export default function MusicPlayer() {
  const { settings, loaded } = useSettings()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [missingTrack, setMissingTrack] = useState(false)

  useEffect(() => {
    const el = audioRef.current
    if (!el || !loaded) return
    el.volume = settings.music_volume
    if (settings.music_enabled && !missingTrack) {
      el.play().catch(() => { /* blocked until a user gesture; the Settings toggle counts as one */ })
    } else {
      el.pause()
    }
  }, [settings.music_enabled, settings.music_volume, loaded, missingTrack])

  return (
    <audio
      ref={audioRef}
      src={TRACK_SRC}
      loop
      onError={() => setMissingTrack(true)}
    />
  )
}
