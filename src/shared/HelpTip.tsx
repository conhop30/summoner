import type { ReactNode } from 'react'
import './HelpTip.css'

// A small "?" that explains itself on hover or keyboard focus.
export default function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={label}>
      ?
      <span className="help-tip-pop" role="tooltip">{children}</span>
    </span>
  )
}
