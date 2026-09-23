import { useEffect } from 'react'
import { useUpdater } from './useUpdater'
import './UpdateBanner.css'

// Bottom-right toast so it never takes layout space from the page underneath. Nothing
// downloads or restarts until the user clicks — "Later" just hides it for the session.
export default function UpdateBanner() {
  const { state, dismissed, dismiss, init } = useUpdater()

  useEffect(() => init(), [init])

  const { status, version, percent, message } = state
  const visible =
    status === 'downloading' ||
    status === 'downloaded' ||
    (status === 'available' && !dismissed) ||
    (status === 'error' && !dismissed)
  if (!visible) return null

  return (
    <div className="update-banner" role="status">
      {status === 'available' && (
        <>
          <div className="update-banner-text">
            <div className="update-banner-title">Update available</div>
            <div className="update-banner-sub">Summoner {version} is ready to download.</div>
          </div>
          <div className="update-banner-actions">
            <button className="update-btn primary" onClick={() => window.summoner.updater.download()}>Update now</button>
            <button className="update-btn" onClick={dismiss}>Later</button>
          </div>
        </>
      )}

      {status === 'downloading' && (
        <div className="update-banner-text">
          <div className="update-banner-title">Downloading {version}…</div>
          <div className="update-progress"><div className="update-progress-fill" style={{ width: `${percent ?? 0}%` }} /></div>
          <div className="update-banner-sub">{percent ?? 0}%</div>
        </div>
      )}

      {status === 'downloaded' && (
        <>
          <div className="update-banner-text">
            <div className="update-banner-title">Update ready</div>
            <div className="update-banner-sub">Restart to finish installing {version}. Your champions are kept.</div>
          </div>
          <div className="update-banner-actions">
            <button className="update-btn primary" onClick={() => window.summoner.updater.install()}>Restart now</button>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="update-banner-text">
            <div className="update-banner-title">Update failed</div>
            <div className="update-banner-sub">{message}</div>
          </div>
          <div className="update-banner-actions">
            <button className="update-btn" onClick={dismiss}>Dismiss</button>
          </div>
        </>
      )}
    </div>
  )
}
