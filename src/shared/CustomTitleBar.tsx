import { useEffect, useState } from 'react'
import './CustomTitleBar.css'

// Electron's `frame` option can only be set at window-creation time, so this
// reflects how the window was actually created — not the live settings
// value, which may have changed since without a restart.
export default function CustomTitleBar() {
  const [frameless, setFrameless] = useState(false)

  useEffect(() => {
    window.summoner.windowControls.isFrameless().then(setFrameless)
    document.documentElement.style.setProperty('--titlebar-height', frameless ? '28px' : '0px')
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--titlebar-height', frameless ? '28px' : '0px')
  }, [frameless])

  if (!frameless) return null

  return (
    <div className="custom-title-bar">
      <div className="custom-title-bar-drag">Summoner</div>
      <div className="custom-title-bar-controls">
        <button onClick={() => window.summoner.windowControls.minimize()} title="Minimize">─</button>
        <button onClick={() => window.summoner.windowControls.toggleMaximize()} title="Maximize / restore">☐</button>
        <button className="close" onClick={() => window.summoner.windowControls.close()} title="Close">×</button>
      </div>
    </div>
  )
}
