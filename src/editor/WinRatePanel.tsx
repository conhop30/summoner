import { useEffect, useMemo, useRef, useState } from 'react'
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
  const tenth = (n: number) => Number(n.toFixed(1))
  if (s.damagePerCast > 0) parts.push(`${Math.round(s.damagePerCast)} dmg`)
  else if (s.shredDamage > 0 || s.teamShare > 0) parts.push('shred')
  else if (s.utility > 0) parts.push('control')
  else if (s.sustain > 0) parts.push('sustain')
  if (s.cooldown > 0) parts.push(`${Number(s.cooldown.toFixed(1))}s`)
  // What shred and penetration add, per second: to your own damage, and as credit for the teammates it helps.
  if (s.shredDamage > 0) parts.push(`+${tenth(s.shredDamage)} damage`)
  if (s.teamShare > 0) parts.push(`+${tenth(s.teamShare)} team`)
  return parts.join(' · ')
}

// The always-visible win-rate projection: a slim bar pinned to the top of the Stats tab with the
// number, how sure it is and what is driving it. Details opens the full breakdown over the page,
// so the stats, items and story below keep their whole width. It recomputes as the champion is edited.
export default function WinRatePanel({ champion, roster }: Props) {
  const { items } = useItemCatalog()
  const prediction = useMemo(() => predictWinRate({ champion, items, roster }), [champion, items, roster])
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <aside className="wr-bar" ref={rootRef} aria-label="Win rate projection">
      <div className="wr-row">
        <div className="wr-title">Win rate</div>
        <HelpTip label="How the projection works">
          A projection from the numbers you have entered, not match data. It scores the champion at level 13 with about
          7,500g of items: the stats against real champions of the same class, the abilities' damage and control, and how
          well the build is priced. Builds are compared at the same spend as a typical champion, so a bigger build isn't
          rewarded for costing more. The ability weights are hand-tuned assumptions.
        </HelpTip>

        {!prediction.ready ? (
          <p className="wr-empty">{prediction.hints[0]}</p>
        ) : (
          <>
            <span className="wr-number">{prediction.winRate.toFixed(1)}%</span>
            <span className="wr-band">± {prediction.band.toFixed(1)}</span>
            <span className={`wr-confidence wr-confidence-${prediction.confidence}`}>{CONFIDENCE_LABEL[prediction.confidence]}</span>

            <div className="wr-track-wrap">
              <div className="wr-track" role="img" aria-label={`${prediction.winRate.toFixed(1)} percent, plus or minus ${prediction.band.toFixed(1)}`}>
                <div className="wr-track-band" style={{ left: `${pct(prediction.winRate - prediction.band)}%`, width: `${pct(prediction.winRate + prediction.band) - pct(prediction.winRate - prediction.band)}%` }} />
                <div className="wr-track-mid" style={{ left: `${pct(50)}%` }} />
                <div className="wr-track-marker" style={{ left: `${pct(prediction.winRate)}%` }} />
              </div>
              <div className="wr-track-scale"><span>{TRACK_MIN}%</span><span>50%</span><span>{TRACK_MAX}%</span></div>
            </div>

            <ul className="wr-chips" aria-label="What is driving it">
              {prediction.contributions.map(c => (
                <li key={c.key} className="wr-chip" title={c.note}>
                  <span className="wr-chip-label">{c.label}</span>
                  <span className={`wr-chip-value ${c.points >= 0 ? 'up' : 'down'}`}>{signed(c.points)}</span>
                </li>
              ))}
            </ul>

            <button className="wr-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
              Details <span className="wr-toggle-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
            </button>
          </>
        )}
      </div>

      {open && prediction.ready && (
        <div className="wr-details">
          <section>
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
          </section>

          <section>
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
          </section>

          {prediction.hints.length > 0 && (
            <section>
              <div className="wr-section">To sharpen it</div>
              <ul className="wr-hints">
                {prediction.hints.map(h => <li key={h}>{h}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </aside>
  )
}
