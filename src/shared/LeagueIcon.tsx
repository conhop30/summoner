import { useState } from 'react'
import { classIconUrl, laneIconUrl } from './leagueAssets'
import './LeagueIcon.css'

// A lane or class icon from the game, drawn beside the name. If the picture can't load (offline, or
// the file has moved) it steps aside and the name stands alone.
export default function LeagueIcon({ kind, name, size = 20 }: { kind: 'lane' | 'class'; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const url = kind === 'lane' ? laneIconUrl(name) : classIconUrl(name)
  if (!url || failed) return null
  return <img className="league-icon" src={url} width={size} height={size} alt="" onError={() => setFailed(true)} />
}
