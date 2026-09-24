import { useEffect } from 'react'
import './ConfirmDialog.css'

interface Props {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// Modal warning for destructive actions. Rendered by the page (not inside a tile or other
// transformed element) so `position: fixed` covers the whole window. Cancel is the default
// focus and Escape / clicking outside both cancel, so a stray Enter or click never deletes.
export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="confirm-overlay" onMouseDown={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="confirm-title" id="confirm-title">
          <span className="confirm-warn-icon" aria-hidden="true">!</span>
          {title}
        </div>
        <p className="confirm-message" id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn" autoFocus onClick={onCancel}>Cancel</button>
          <button className="confirm-btn confirm-btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
