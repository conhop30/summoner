import { useEffect, useState } from 'react'
import summonerLogo from '../assets/summoner-logo.png'
import { router } from '../router'
import './AppHeader.css'

// Persistent brand bar above every page. Mounted outside the route tree, so it navigates
// through the router instance directly rather than a hook.
//
// In a frameless window this bar also is the title bar: it drags the window and carries the
// minimize / maximize / close buttons, so they stay put however far the page is scrolled.
// (Electron's `frame` option can only be set when the window is created, so `frameless`
// reflects how the window was actually created — not the live setting, which may have
// changed since without a restart.)
export default function AppHeader() {
  const [frameless, setFrameless] = useState(false)

  useEffect(() => {
    window.summoner.windowControls.isFrameless().then(setFrameless)
  }, [])

  return (
    <header className={`app-header${frameless ? ' frameless' : ''}`}>
      <button
        className="app-header-home"
        title="Back to the champion gallery"
        aria-label="Summoner — back to the champion gallery"
        onClick={() => router.navigate('/')}
      >
        <img className="app-header-logo" src={summonerLogo} alt="" />
        <span className="app-header-name">Summoner</span>
      </button>

      {frameless && (
        <div className="app-header-controls">
          <button onClick={() => window.summoner.windowControls.minimize()} title="Minimize" aria-label="Minimize">
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M1 6h10" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
          <button onClick={() => window.summoner.windowControls.toggleMaximize()} title="Maximize / restore" aria-label="Maximize or restore">
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
          <button className="close" onClick={() => window.summoner.windowControls.close()} title="Close" aria-label="Close">
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
        </div>
      )}
    </header>
  )
}
