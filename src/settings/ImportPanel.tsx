import { useState } from 'react'
import type { ImportPlanSummary, PlanItem } from '../champion/importTypes'
import type { ImportStatus, LocalNewerChoice } from '../champion/exchange'
import './ImportPanel.css'

const STATUS_LABEL: Record<ImportStatus, string> = {
  new: 'New',
  update: 'Newer in file',
  unchanged: 'Same',
  'local-newer': 'Newer here',
}

const CHOICES: { value: LocalNewerChoice; label: string; hint: string }[] = [
  { value: 'keep-mine', label: 'Keep mine', hint: 'Leave these champions as they are.' },
  { value: 'take-theirs', label: "Use the file's", hint: 'Replace their story and ability text with the file’s.' },
  { value: 'keep-both', label: 'Keep both', hint: 'Add the file’s version as a separate copy.' },
]

function when(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function Row({ item }: { item: PlanItem }) {
  return (
    <li className="import-row">
      <span className="import-row-name">{item.name}</span>
      <span className={`import-chip import-chip-${item.status}`}>{STATUS_LABEL[item.status]}</span>
      {item.status === 'local-newer' && (
        <span className="import-row-dates">here {when(item.localAt)} · file {when(item.incomingAt)}</span>
      )}
    </li>
  )
}

interface Props {
  plan: ImportPlanSummary
  onDone: (message: string) => void
  onCancel: () => void
  onError: (message: string) => void
}

// Shown after a file is chosen and before anything is written: what the import would do, and
// what to do with champions that are newer on this computer than in the file.
export default function ImportPanel({ plan, onDone, onCancel, onError }: Props) {
  const [choice, setChoice] = useState<LocalNewerChoice>('keep-mine')
  const [busy, setBusy] = useState(false)

  const counts = { new: 0, update: 0, unchanged: 0, 'local-newer': 0 } as Record<ImportStatus, number>
  for (const item of plan.items) counts[item.status]++
  const localNewer = counts['local-newer']
  const willChange = counts.new + counts.update + (choice === 'keep-mine' ? 0 : localNewer)

  async function apply() {
    setBusy(true)
    const result = await window.summoner.data.importApply(plan.planId, choice)
    setBusy(false)
    if (!result.ok) { onError(result.error); return }
    const parts = [
      result.added && `${result.added} added`,
      result.updated && `${result.updated} updated`,
      result.copies && `${result.copies} kept as copies`,
      result.skipped && `${result.skipped} left as they were`,
    ].filter(Boolean)
    onDone(`Import finished: ${parts.join(', ') || 'nothing to change'}.`)
  }

  return (
    <div className="import-panel">
      <div className="import-panel-head">
        <span className="import-file">{plan.fileName}</span>
        <span className="import-scope">{plan.scope === 'concept' ? 'Story and ability text' : 'Full backup'}</span>
      </div>
      {plan.scope === 'concept' && (
        <p className="import-note">
          This file only carries story, identity and ability text, notes and blocks. Your stats, builds, ability numbers and theme audio stay exactly as they are.
        </p>
      )}

      <ul className="import-list">
        {plan.items.map(item => <Row key={item.id} item={item} />)}
      </ul>

      {localNewer > 0 && (
        <fieldset className="import-choice">
          <legend>
            {localNewer === 1 ? '1 champion is' : `${localNewer} champions are`} newer here than in this file
          </legend>
          {CHOICES.map(c => (
            <label key={c.value} className={`import-choice-option${choice === c.value ? ' on' : ''}`}>
              <input type="radio" name="import-choice" checked={choice === c.value} onChange={() => setChoice(c.value)} />
              <span className="import-choice-label">{c.label}</span>
              <span className="import-choice-hint">{c.hint}</span>
            </label>
          ))}
        </fieldset>
      )}

      {plan.warnings.length > 0 && (
        <details className="import-warnings">
          <summary>{plan.warnings.length} thing{plan.warnings.length === 1 ? ' was' : 's were'} skipped or trimmed</summary>
          <ul>{plan.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </details>
      )}

      <div className="settings-btn-row">
        <button className="settings-secondary-btn" onClick={apply} disabled={busy || willChange === 0}>
          {busy ? 'Importing…' : willChange === 0 ? 'Nothing to import' : `Import ${willChange}`}
        </button>
        <button className="settings-secondary-btn" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  )
}
