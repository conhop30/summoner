import summonerLogo from '../assets/summoner-logo.png'
import { router } from '../router'
import './AppHeader.css'

// Persistent brand bar above every page. Mounted outside the route tree (like the title bar),
// so it navigates through the router instance directly rather than a hook.
export default function AppHeader() {
  return (
    <header className="app-header">
      <button
        className="app-header-home"
        title="Back to the champion gallery"
        aria-label="Summoner — back to the champion gallery"
        onClick={() => router.navigate('/')}
      >
        <img className="app-header-logo" src={summonerLogo} alt="" />
        <span className="app-header-name">Summoner</span>
      </button>
    </header>
  )
}
