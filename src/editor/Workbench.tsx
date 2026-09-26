import { m, AnimatePresence } from 'framer-motion'
import type { Champion } from '../champion/types'
import StoryPanel from './StoryPanel'
import IdentityPanel from './IdentityPanel'
import ItemLoadoutPanel from './ItemLoadoutPanel'
import './Workbench.css'

export type WorkbenchView = 'story' | 'identity' | 'items'

const VIEWS: { key: WorkbenchView; label: string }[] = [
  { key: 'story', label: 'Story' },
  { key: 'identity', label: 'Identity' },
  { key: 'items', label: 'Items' },
]

interface Props {
  champion: Champion
  onChange: (c: Champion) => void
  view: WorkbenchView
  onView: (v: WorkbenchView) => void
}

// The area under the base stats: one panel at a time — the champion's story, their identity
// chips, or their item build — chosen from a centered switcher.
export default function Workbench({ champion, onChange, view, onView }: Props) {
  return (
    <section className="workbench">
      <div className="workbench-switcher" role="tablist" aria-label="Champion details">
        {VIEWS.map(v => (
          <button
            key={v.key}
            role="tab"
            aria-selected={view === v.key}
            className={`workbench-tab${view === v.key ? ' active' : ''}`}
            onClick={() => onView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={view}
          className="workbench-panel"
          role="tabpanel"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
        >
          {view === 'story' && <StoryPanel champion={champion} onChange={onChange} />}
          {view === 'identity' && <IdentityPanel champion={champion} onChange={onChange} />}
          {view === 'items' && <ItemLoadoutPanel champion={champion} onChange={onChange} />}
        </m.div>
      </AnimatePresence>
    </section>
  )
}
