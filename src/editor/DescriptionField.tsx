import { useEffect, useRef } from 'react'
import type { Effect } from '../champion/types'
import { hasTokens, insertAtCaret, resolveTokens, tokenChoices, unknownTokens } from '../champion/descriptionTokens'

interface Props {
  value: string | undefined
  /** The effects of the same ability or block: what a {token} in the text can name. */
  effects: Effect[] | undefined
  onChange: (text: string) => void
  placeholder?: string
}

// An ability's or block's description. Where a number belongs the text can say {Damage}, and the
// number is filled in from the effect of that name. The dropdown puts a token in at the caret so
// nothing has to be remembered or typed exactly, and a line underneath shows how the text reads
// once the numbers are in.
export default function DescriptionField({ value, effects, onChange, placeholder }: Props) {
  const text = value ?? ''
  const areaRef = useRef<HTMLTextAreaElement>(null)
  // Where the caret goes once the inserted text has been rendered.
  const pendingCaret = useRef<number | null>(null)

  useEffect(() => {
    if (pendingCaret.current === null) return
    const caret = pendingCaret.current
    pendingCaret.current = null
    areaRef.current?.focus()
    areaRef.current?.setSelectionRange(caret, caret)
  }, [text])

  const choices = tokenChoices(effects)
  const resolved = resolveTokens(text, effects)
  const unknown = unknownTokens(text, effects)

  function insert(index: number) {
    const el = areaRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const next = insertAtCaret(text, start, end, `{${choices[index].token}}`)
    pendingCaret.current = next.caret
    onChange(next.text)
  }

  return (
    <>
      <textarea
        ref={areaRef}
        className="ability-desc"
        placeholder={placeholder ?? 'Describe what this ability does...'}
        value={text}
        onChange={e => onChange(e.target.value)}
      />
      {(effects?.length ?? 0) > 0 && (
        <div className="ability-desc-tools">
          <select
            className="effect-type-select ability-desc-insert"
            value=""
            onChange={e => { if (e.target.value !== '') insert(Number(e.target.value)) }}
            aria-label="Insert a value from an effect"
            title="Put a number from this ability's effects into the description"
          >
            <option value="">Insert value…</option>
            {choices.map((choice, i) => (
              <option key={i} value={i}>{`{${choice.token}}  ${choice.phrase}`}</option>
            ))}
          </select>
          {hasTokens(text) && resolved !== text && (
            <div className="ability-desc-preview"><span>Reads as</span> {resolved}</div>
          )}
          {unknown.length > 0 && (
            <div className="ability-desc-warning">
              No effect is called {unknown.map(u => `{${u}}`).join(', ')}. Name an effect to match, or pick one from the list.
            </div>
          )}
        </div>
      )}
    </>
  )
}
