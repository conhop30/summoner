import { useEffect, useState } from 'react'
import summonerLogo from '../assets/summoner-logo.png'
import { router } from '../router'
import { useNumbers } from '../settings/useNumbers'
import './AppHeader.css'

// Persistent brand + navigation bar above every page. Mounted outside the route tree, so it
// navigates through the router instance directly rather than a hook.
//
// In a frameless window this bar also is the title bar: it drags the window and carries the
// minimize / maximize / close buttons, so they stay put however far the page is scrolled.
// (Electron's `frame` option can only be set when the window is created, so `frameless`
// reflects how the window was actually created — not the live setting, which may have
// changed since without a restart.) In fullscreen those buttons are hidden and the in-app
// navigation, including the fullscreen toggle, is what's left.
export default function AppHeader() {
  const numbers = useNumbers()
  const [frameless, setFrameless] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [path, setPath] = useState(router.state.location.pathname)

  useEffect(() => {
    window.summoner.windowControls.isFrameless().then(setFrameless)
    window.summoner.windowControls.isFullScreen().then(setFullscreen)
    const offFullscreen = window.summoner.windowControls.onFullScreenChange(setFullscreen)
    const offRouter = router.subscribe(state => setPath(state.location.pathname))
    return () => { offFullscreen(); offRouter() }
  }, [])

  const showWindowButtons = frameless && !fullscreen
  const onItems = path === '/items'
  const onSettings = path === '/settings'

  return (
    <header className={`app-header${frameless ? ' frameless' : ''}${showWindowButtons ? ' has-controls' : ''}`}>
      <button
        className="app-header-home"
        title="Back to the champion gallery"
        aria-label="Summoner — back to the champion gallery"
        onClick={() => router.navigate('/')}
      >
        <img className="app-header-logo" src={summonerLogo} alt="" />
        <span className="app-header-name">Summoner</span>
      </button>

      <nav className="app-header-nav" aria-label="Main">
        {numbers.stats && <button
          className={`app-header-link${onItems ? ' active' : ''}`}
          aria-current={onItems ? 'page' : undefined}
          onClick={() => router.navigate('/items')}
        >
          Items
        </button>}
        <button
          className={`app-header-icon-btn${onSettings ? ' active' : ''}`}
          aria-current={onSettings ? 'page' : undefined}
          title="Settings"
          aria-label="Settings"
          onClick={() => router.navigate('/settings')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button
          className="app-header-icon-btn"
          title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={() => window.summoner.windowControls.toggleFullScreen()}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {fullscreen
              ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
        </button>
      </nav>

      {showWindowButtons && (
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
