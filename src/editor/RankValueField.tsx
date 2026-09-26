import NumberField from './NumberField'
import { percentToRatio, ratioToPercent } from '../champion/ratios'

// One box per rank. After the first two ranks are filled in, suggest the arithmetic step between
// them as the scaling rule for the rest — the user accepts or keeps typing manually. `percent` is for
// a ratio (a share of a stat): the person types 45 and 0.45 is what is kept. `suffix` puts a unit
// inside each box.
export default function RankValueField({ values, maxRank, onChange, onBulkChange, percent = false, suffix }: {
  values: number[] | undefined
  maxRank: number
  onChange: (rankIndex: number, value: number) => void
  onBulkChange: (newValues: number[]) => void
  percent?: boolean
  suffix?: string
}) {
  const rankIndices = Array.from({ length: maxRank }, (_, i) => i)
  // Everything below works in what is shown in the boxes; `store` turns it back into what is kept.
  const show = (v: number | undefined) => (v === undefined ? undefined : percent ? ratioToPercent(v) : v)
  const store = (n: number) => (percent ? percentToRatio(n) : n)
  const shown = rankIndices.map(i => show(values?.[i]))
  const v0 = shown[0]
  const v1 = shown[1]
  // A second rank left blank (which is stored as 0) isn't a step to continue.
  const hasStep = maxRank > 2 && v0 !== undefined && v1 !== undefined && v1 !== 0
  const step = hasStep ? Math.round((v1! - v0!) * 100) / 100 : 0
  const projected = hasStep
    ? rankIndices.map(i => (i < 2 ? shown[i]! : Math.round((v0! + step * i) * 100) / 100))
    : []
  const suggestionApplicable = hasStep && rankIndices.slice(2).some(i => (shown[i] ?? 0) !== projected[i])

  // A single bulk update, not N sequential onChange calls — the latter would each
  // read the same pre-update `ability` prop and clobber one another (only the last wins).
  function acceptSuggestion() {
    onBulkChange(rankIndices.map(i => store(i < 2 ? (shown[i] ?? 0) : projected[i])))
  }

  return (
    <div className="rank-value-field">
      <div className="rank-inputs">
        {rankIndices.map(i => (
          <NumberField
            key={i}
            value={shown[i]}
            suffix={percent ? '%' : suffix}
            onChange={n => onChange(i, store(n))}
          />
        ))}
      </div>
      {suggestionApplicable && (
        <button className="rank-suggestion-chip" onClick={acceptSuggestion}>
          Suggest {step >= 0 ? '+' : ''}{step}{percent ? '%' : ''} per rank — Accept
        </button>
      )}
    </div>
  )
}
