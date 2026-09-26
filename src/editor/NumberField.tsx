import { useState } from 'react'
import { displayNumber, draftValue, isNumberDraft } from './numberInput'

interface Props {
  value: number | undefined
  onChange: (value: number) => void
  className?: string
  placeholder?: string
  /** A unit shown inside the box, after the number: "%" or "s". */
  suffix?: string
  title?: string
  ariaLabel?: string
}

// The number box used for ranks, cooldowns, costs and amounts. It is a plain text box that only
// accepts a number: no stepper arrows, nothing to fight with when typing. A zero is shown as an
// empty box (with a faint 0), and the box selects itself when it is clicked into, so typing
// always replaces what was there instead of landing beside a 0 that has to be deleted first.
export default function NumberField({ value, onChange, className = 'rank-input', placeholder = '0', suffix, title, ariaLabel }: Props) {
  // While the box has focus it shows exactly what was typed ("4." on the way to "4.5"), not the stored number.
  const [draft, setDraft] = useState<string | null>(null)

  const shown = draft ?? displayNumber(value)

  const input = (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      title={title}
      aria-label={ariaLabel}
      value={shown}
      onFocus={e => { setDraft(displayNumber(value)); e.target.select() }}
      onBlur={() => setDraft(null)}
      onChange={e => {
        const text = e.target.value
        if (!isNumberDraft(text)) return
        setDraft(text)
        onChange(draftValue(text))
      }}
    />
  )
  // The wrapper is always there, so the box keeps its focus as the unit comes and goes. The unit
  // trails a number, not the faint 0 of an empty box.
  if (!suffix) return input
  return (
    <span className="num-field">
      {input}
      {shown !== '' && <span className="num-suffix" aria-hidden="true">{suffix}</span>}
    </span>
  )
}
