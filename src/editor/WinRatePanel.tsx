import { useMemo } from 'react'
import type { Champion } from '../champion/types'
import type { ChampionCatalogEntry } from '../championCatalog/types'
import { useItemCatalog } from '../item/useItemCatalog'
import { predictWinRate, type Confidence } from '../predictor/predict'
import type { SlotReport } from '../predictor/kit'
import HelpTip from '../shared/HelpTip'
import './WinRatePanel.css'

interface Props {
  champion: Champion
  /** The synced champion roster, which the stats half of the projection is calibrated on. */
  roster: ChampionCatalogEntry[]
}

// The track runs 43% to 57%, the range the projection is held to.
const TRACK_MIN = 43
const TRACK_MAX = 57
/** A contribution this many points wide fills its half of the bar. */
const BAR_FULL = 3

const CONFIDENCE_LABEL: Record<Confidence, string> = { good: 'Good', fair: 'Fair', rough: 'Rough' }
const SLOT_KEY: Record<SlotReport['slot'], string> = { passive: 'P', q: 'Q', w: 'W', e: 'E', r: 'R' }

function pct(v: number): number {
  return Math.min(100, Math.max(0, ((v - TRACK_MIN) / (TRACK_MAX - TRACK_MIN)) * 100))
}

function signed(n: number): string {
  return n > 0 ? `+${n.toFixed(1)}` : n < 0 ? `−${Math.abs(n).toFixed(1)}` : '0.0'
}

function slotSummary(s: SlotReport): string {
  if (!s.scored) return 'counted as average'
  const parts: string[] = []
  if (s.damagePerCast > 0) parts.push(`${Math.round(s.damagePerCast)} dmg`)
  else if (s.utility > 0) parts.push('control')
  else if (s.sustain > 0) parts.push('sustain')
  if (s.cooldown > 0) parts.push(`${Number(s.cooldown.toFixed(1))}s`)
  return parts.join(' · ')
}

// The always-visible win-rate projection: one number, how sure it is, what is driving it and
// what would sharpen it. It recomputes as the champion is edited.
export default function WinRatePanel({ champion, roster }: Props) {
  const { items } = useItemCatalog()
  const prediction = useMemo(() => predictWinRate({ champion, items, roster }), [champion, items, roster])

  return (
    <aside className="wr-panel" aria-label="Win rate projection">
      <div className="wr-title-row">
        <div className="wr-title">Win rate projection</div>
        <HelpTip label="How the projection works">
          A projection from the numbers you have entered, not match data. It scores the champion at level 13 with about
          7,500g of items: the stats against real champions of the same class, the abilities' damage and control, and how
          well the build is priced. Builds are compared at the same spend as a typical champion, so a bigger build isn't
          rewarded for costing more. The ability weights are hand-tuned assumptions.
        </HelpTip>
      </div>

      {!prediction.ready ? (
        <p className="wr-empty">{prediction.hints[0]}</p>
      ) : (
        <>
          <div className="wr-figure">
            <span className="wr-number">{prediction.winRate.toFixed(1)}%</span>
            <span className="wr-band">± {prediction.band.toFixed(1)}</span>
            <span className={`wr-confidence wr-confidence-${prediction.confidence}`}>{CONFIDENCE_LABEL[prediction.confidence]}</span>
          </div>

          <div className="wr-track" role="img" aria-label={`${prediction.winRate.toFixed(1)} percent, plus or minus ${prediction.band.toFixed(1)}`}>
            <div className="wr-track-band" style={{ left: `${pct(prediction.winRate - prediction.band)}%`, width: `${pct(prediction.winRate + prediction.band) - pct(prediction.winRate - prediction.band)}%` }} />
            <div className="wr-track-mid" style={{ left: `${pct(50)}%` }} />
            <div className="wr-track-marker" style={{ left: `${pct(prediction.winRate)}%` }} />
          </div>
          <div className="wr-track-scale"><span>{TRACK_MIN}%</span><span>50%</span><span>{TRACK_MAX}%</span></div>

          <div className="wr-section">What is driving it</div>
          <ul className="wr-list">
            {prediction.contributions.map(c => {
              const width = Math.min(50, (Math.abs(c.points) / BAR_FULL) * 50)
              return (
                <li key={c.key} className="wr-driver" title={c.note}>
                  <span className="wr-driver-label">{c.label}</span>
                  <span className="wr-driver-bar" aria-hidden="true">
                    <span className={`wr-driver-fill ${c.points >= 0 ? 'up' : 'down'}`}
                      style={c.points >= 0 ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }} />
                  </span>
                  <span className="wr-driver-value">{signed(c.points)}</span>
                </li>
              )
            })}
          </ul>

          <div className="wr-section">Kit at level 13</div>
          <ul className="wr-list">
            {prediction.slots.map(s => (
              <li key={s.slot} className={`wr-slot${s.scored ? '' : ' unscored'}`}>
                <span className="wr-slot-key">{SLOT_KEY[s.slot]}</span>
                <span className="wr-slot-name">{s.name || '—'}</span>
                <span className="wr-slot-summary">{slotSummary(s)}</span>
              </li>
            ))}
          </ul>

          {prediction.hints.length > 0 && (
            <ul className="wr-hints">
              {prediction.hints.map(h => <li key={h}>{h}</li>)}
            </ul>
          )}
        </>
      )}
    </aside>
  )
}
