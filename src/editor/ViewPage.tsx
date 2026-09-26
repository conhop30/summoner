import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Champion, AbilitySlot } from '../champion/types'
import { useChampionTheme } from '../audio/useChampionTheme'
import { resolveTokens } from '../champion/descriptionTokens'
import AbilityTooltip from './AbilityTooltip'
import LeagueIcon from '../shared/LeagueIcon'
import StatIcon from './StatIcon'
import type { StatIconKey } from '../champion/statIcons'
import { useNumbers } from '../settings/useNumbers'
import { formatStat, formatGrowth, statAtLevel } from '../champion/statSpec'
import type { BaseStats } from '../champion/types'
import './ViewPage.css'

const SLOTS: AbilitySlot[] = ['passive', 'q', 'w', 'e', 'r']
const SLOT_LABELS: Record<AbilitySlot, string> = { passive: 'P', q: 'Q', w: 'W', e: 'E', r: 'R' }

const STAT_FIELDS = [
  { key: 'health',          growthKey: 'health_growth',          label: 'Health',       icon: 'health' },
  { key: 'health_regen',    growthKey: 'health_regen_growth',    label: 'HP Regen',     icon: 'health_regen' },
  { key: 'resource',        growthKey: 'resource_growth',        label: 'Resource',     icon: 'resource' },
  { key: 'attack_damage',   growthKey: 'attack_damage_growth',   label: 'Attack Dmg',   icon: 'ad' },
  { key: 'attack_speed',    growthKey: 'attack_speed_growth',    label: 'Attack Speed', icon: 'as' },
  { key: 'armor',           growthKey: 'armor_growth',           label: 'Armor',        icon: 'armor' },
  { key: 'magic_resistance',growthKey: 'magic_resistance_growth',label: 'Magic Resist', icon: 'mr' },
  { key: 'movement_speed',  growthKey: 'movement_speed_growth',  label: 'Move Speed',   icon: 'ms' },
] as const

interface StatRowProps {
  statKey: keyof BaseStats
  label: string
  icon: StatIconKey
  base?: number
  growth?: number
}

function StatRow({ statKey, label, icon, base, growth }: StatRowProps) {
  const [expanded, setExpanded] = useState(false)
  if (!base) return null
  return (
    <div className="view-stat-row">
      <div className="view-stat-main" onClick={() => growth && setExpanded(e => !e)}>
        <span className="view-stat-icon"><StatIcon name={icon} size={14} /></span>
        <span className="view-stat-label">{label}</span>
        <span className="view-stat-val">{formatStat(statKey, base)}</span>
        {growth && (
          <span className={`view-stat-toggle${expanded ? ' open' : ''}`}>▾</span>
        )}
      </div>
      {expanded && growth && (
        <div className="view-stat-scaling">
          <div className="view-stat-scaling-row">
            <span>Per level</span>
            <span>{formatGrowth(statKey, growth)}</span>
          </div>
          {[6, 11, 16, 18].map(lvl => (
            <div key={lvl} className="view-stat-scaling-row">
              <span>Level {lvl}</span>
              <span>{formatStat(statKey, statAtLevel(statKey, base, growth, lvl))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SLOT_TYPE_LABEL: Record<AbilitySlot, string> = { passive: 'Passive', q: 'Q Ability', w: 'W Ability', e: 'E Ability', r: 'Ultimate' }

// Uniform Hextech gold accent for ability blocks (mirrors --accent-gold / primitive-gold-400).
// Canvas can't read CSS vars, so this is a hardcoded twin — see the POSTER_TEXT_* note below.
const POSTER_ACCENT_GOLD = '#c8aa6e'

// Mirrors the current --text-body/--text-secondary/--text-muted tokens (tokens.css).
// Hardcoded rather than read live so the poster stays dark-themed even when the app is in light mode.
const POSTER_TEXT_BODY = '#cdd0dc'
const POSTER_TEXT_SECONDARY = '#b8b8ca'
const POSTER_TEXT_MUTED = '#a0a0b4'

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) { lines[maxLines - 1] += '…'; return lines }
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale, sh = h / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

const POSTER_ICON_SIZE = 44

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Builds a full-kit poster: splash art up top, lore + every filled ability below (no truncation to fit a fixed height).
async function drawChampionCard(champion: Champion): Promise<Blob> {
  // Load custom ability icons up front so text layout below can reserve room for them.
  const icons = new Map<AbilitySlot, HTMLImageElement>()
  await Promise.all(SLOTS.map(async slot => {
    const src = champion.abilities[slot]?.icon_path
    const img = src ? await loadImage(src) : null
    if (img) icons.set(slot, img)
  }))

  return new Promise(resolve => {
    const W = 1200
    const SPLASH_H = 820
    const PAD = 64
    const contentW = W - PAD * 2

    const measure = document.createElement('canvas').getContext('2d')!

    measure.font = '400 17px sans-serif'
    const loreLines = champion.identity.lore ? wrapLines(measure, champion.identity.lore, contentW, 4) : []

    measure.font = '400 15px sans-serif'
    const filledSlots = SLOTS.filter(s => champion.abilities[s]?.name)
    const abilityBlocks = filledSlots.map(slot => {
      const ability = champion.abilities[slot]!
      const textX = PAD + 16 + (icons.has(slot) ? POSTER_ICON_SIZE + 14 : 0)
      const description = resolveTokens(ability.description, ability.effects)
      const lines = description ? wrapLines(measure, description, W - PAD - textX - 44, 3) : []
      return { slot, ability, lines, textX }
    })

    const headerH = 150 + (loreLines.length ? loreLines.length * 26 + 20 : 0)
    const abilitiesLabelH = abilityBlocks.length ? 60 : 0
    const abilitiesH = abilityBlocks.reduce((sum, b) => sum + 40 + b.lines.length * 22 + 26, 0)
    const footerH = 56
    const H = SPLASH_H + headerH + abilitiesLabelH + abilitiesH + footerH

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#08080f'
    ctx.fillRect(0, 0, W, H)

    const drawRest = () => {
      const grad = ctx.createLinearGradient(0, SPLASH_H - 220, 0, SPLASH_H)
      grad.addColorStop(0, 'transparent')
      grad.addColorStop(1, '#08080f')
      ctx.fillStyle = grad
      ctx.fillRect(0, SPLASH_H - 220, W, 220)

      ctx.fillStyle = 'rgba(200,155,60,0.2)'
      ctx.fillRect(0, SPLASH_H, W, 3)

      ctx.fillStyle = '#c8aa6e'
      ctx.font = '500 46px sans-serif'
      ctx.fillText(champion.identity.name.toUpperCase(), PAD, SPLASH_H - 40)

      if (champion.identity.title) {
        ctx.fillStyle = POSTER_TEXT_SECONDARY
        ctx.font = '400 18px sans-serif'
        ctx.fillText(champion.identity.title, PAD, SPLASH_H - 12)
      }

      let y = SPLASH_H + 60
      if (loreLines.length) {
        ctx.fillStyle = POSTER_TEXT_BODY
        ctx.font = '400 17px sans-serif'
        for (const line of loreLines) {
          ctx.fillText(line, PAD, y)
          y += 26
        }
        y += 20
      }

      if (abilityBlocks.length) {
        ctx.fillStyle = POSTER_TEXT_MUTED
        ctx.font = '400 11px sans-serif'
        ctx.fillText('FULL KIT', PAD, y)
        y += 40

        for (const { slot, ability, lines, textX } of abilityBlocks) {
          const icon = icons.get(slot)
          const bodyH = Math.max(6 + lines.length * 22, icon ? POSTER_ICON_SIZE - 26 : 0)
          ctx.strokeStyle = POSTER_ACCENT_GOLD
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(PAD, y - 18)
          ctx.lineTo(PAD, y + bodyH)
          ctx.stroke()

          if (icon) {
            const iconX = PAD + 16
            const iconY = y - 22
            ctx.save()
            ctx.beginPath()
            ctx.roundRect(iconX, iconY, POSTER_ICON_SIZE, POSTER_ICON_SIZE, 6)
            ctx.clip()
            drawCover(ctx, icon, iconX, iconY, POSTER_ICON_SIZE, POSTER_ICON_SIZE)
            ctx.restore()
            ctx.strokeStyle = POSTER_ACCENT_GOLD
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.roundRect(iconX, iconY, POSTER_ICON_SIZE, POSTER_ICON_SIZE, 6)
            ctx.stroke()
          }

          ctx.fillStyle = POSTER_ACCENT_GOLD
          ctx.font = '600 13px sans-serif'
          ctx.fillText(SLOT_LABELS[slot], textX, y - 18)

          ctx.fillStyle = '#c8aa6e'
          ctx.font = '500 17px sans-serif'
          ctx.fillText(ability.name!.toUpperCase(), textX, y)

          ctx.fillStyle = POSTER_TEXT_BODY
          ctx.font = '400 14px sans-serif'
          let ly = y + 24
          for (const line of lines) {
            ctx.fillText(line, textX, ly)
            ly += 22
          }

          y += 40 + lines.length * 22 + 26
        }
      }

      ctx.fillStyle = POSTER_TEXT_MUTED
      ctx.font = '400 12px sans-serif'
      ctx.fillText('Created with Summoner', PAD, H - 24)

      canvas.toBlob(blob => resolve(blob!), 'image/png')
    }

    if (champion.identity.image_path) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { drawCover(ctx, img, 0, 0, W, SPLASH_H); drawRest() }
      img.onerror = drawRest
      img.src = champion.identity.image_path
    } else {
      const initials = champion.identity.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      ctx.fillStyle = '#0d0a1e'
      ctx.fillRect(0, 0, W, SPLASH_H)
      ctx.fillStyle = 'rgba(83,74,183,0.14)'
      ctx.font = '500 220px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(initials, W / 2, SPLASH_H / 2 + 70)
      ctx.textAlign = 'left'
      drawRest()
    }
  })
}

export default function ViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [champion, setChampion] = useState<Champion | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<AbilitySlot | null>(null)
  const [hoveredSlot, setHoveredSlot] = useState<AbilitySlot | null>(null)
  const numbers = useNumbers()
  const themePlaying = useChampionTheme(s => !!id && s.playing?.championId === id && !s.paused)
  const playTheme = useChampionTheme(s => s.play)
  const stopTheme = useChampionTheme(s => s.stop)
  // The theme belongs to this page: leaving the champion's showcase ends it.
  useEffect(() => () => { if (id) stopTheme(id) }, [id, stopTheme])

  useEffect(() => {
    if (!id) return
    window.summoner.champion.get(id).then(c => {
      if (c) {
        setChampion(c)
        setSelectedSlot(SLOTS.find(s => c.abilities[s]?.name) ?? null)
      } else navigate('/')
    })
  }, [id])

  async function handleDownload() {
    if (!champion) return
    setDownloading(true)
    try {
      const blob = await drawChampionCard(champion)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${champion.identity.name.replace(/\s+/g, '_')}_card.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  if (!champion) return <div className="view-loading" />

  const { identity, base_stats, abilities, metadata } = champion
  const playstyle = (identity as any).playstyle

  const storyPct = (identity.name ? 25 : 0) + (identity.lore ? 50 : 0) + ((identity.role ?? []).length > 0 ? 25 : 0)
  const statsPct = STAT_FIELDS.filter(f => base_stats[f.key as keyof typeof base_stats]).length / STAT_FIELDS.length * 100
  const abilitiesPct = SLOTS.filter(s => abilities[s]?.name).length / SLOTS.length * 100

  const filledSlots = SLOTS.filter(s => abilities[s]?.name)
  const displaySlot = hoveredSlot ?? selectedSlot
  const displayAbility = displaySlot ? abilities[displaySlot] : undefined

  const r = 22
  const circ = 2 * Math.PI * r

  return (
    <div className="view-root">
      <div className="view-hero">
        {identity.image_path ? (
          <img
            className="view-hero-img"
            src={identity.image_path}
            style={{ objectPosition: `${(identity as any).image_position?.x ?? 50}% ${(identity as any).image_position?.y ?? 50}%` }}
          />
        ) : (
          <div className="view-hero-placeholder" style={{ background: '#0d0a1e' }}>
            <span className="view-hero-initials" style={{ color: '#534AB7' }}>
              {identity.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          </div>
        )}
        <div className="view-hero-fade" />
        <div className="view-hero-left-fade" />

        <button className="view-back-btn" onClick={() => navigate('/')}>← Gallery</button>

        <div className="view-hero-actions">
          {identity.theme_audio && (
            <button
              className="view-action-btn"
              onClick={() => (themePlaying
                ? stopTheme(id)
                : playTheme({ championId: id!, name: identity.theme_audio!.name, src: identity.theme_audio!.src }))}
              title={themePlaying ? 'Stop the theme' : 'Play the champion theme (pauses the background music)'}
            >
              {themePlaying ? '■ Stop theme' : '▶ Play theme'}
            </button>
          )}
          <button className="view-action-btn" onClick={() => navigate(`/edit/${id}`)}>Edit champion</button>
          <button className="view-action-btn primary" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Generating...' : 'Download poster'}
          </button>
        </div>

        <div className="view-hero-content">
          <div className="view-hero-name">{identity.name}</div>
          {identity.title && <div className="view-hero-title">{identity.title}</div>}
          <div className="view-hero-traits">
            {(identity.class ?? []).map(t => <span key={`class-${t}`} className="view-hero-trait"><LeagueIcon kind="class" name={t} />{t}</span>)}
            {(identity.role ?? []).map(t => <span key={`lane-${t}`} className="view-hero-trait"><LeagueIcon kind="lane" name={t} />{t}</span>)}
            {(identity.attack_type ?? []).map(t => <span key={`attack-${t}`} className="view-hero-trait">{t}</span>)}
          </div>
          {playstyle && playstyle.length > 0 && (
            <div className="view-hero-playstyle">{playstyle.join(' · ')}</div>
          )}
        </div>
      </div>

      <div className="view-body">
        <div className="view-left">
          {identity.lore && (
            <div className="view-section">
              <div className="view-section-title">Lore</div>
              <div className="view-lore">{identity.lore}</div>
            </div>
          )}

          <div className="view-section">
            <div className="view-section-title">Abilities</div>
            {filledSlots.length > 0 ? (
              <div className="view-abilities-showcase">
                <div className="ability-icon-row">
                  {filledSlots.map(slot => (
                    <div key={slot} className="ability-icon-item">
                      <button
                        className={`ability-icon-btn${displaySlot === slot ? ' active' : ''}`}
                        onMouseEnter={() => setHoveredSlot(slot)}
                        onMouseLeave={() => setHoveredSlot(null)}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {abilities[slot]!.icon_path
                          ? <img className="ability-icon-img" src={abilities[slot]!.icon_path} alt={SLOT_LABELS[slot]} />
                          : SLOT_LABELS[slot]}
                      </button>
                      <div className={`ability-icon-label${displaySlot === slot ? ' active' : ''}`}>
                        {abilities[slot]!.name}
                      </div>
                    </div>
                  ))}
                </div>
                {displayAbility && (
                  <AbilityTooltip
                    className="view-ability-tip"
                    name={displayAbility.name}
                    label={SLOT_TYPE_LABEL[displaySlot!]}
                    description={displayAbility.description}
                    effects={displayAbility.effects}
                    cooldown={displayAbility.cooldown}
                    cost={displayAbility.cost}
                    costType={displayAbility.cost_type}
                    numbers={numbers.abilities}
                  />
                )}
              </div>
            ) : (
              <div className="ability-spotlight-empty">No abilities defined yet.</div>
            )}
          </div>
        </div>

        <div className="view-right">
          <div className="view-completion-card">
            <div className="view-completion-title">Completion</div>
            <div className="view-circles">
              {[
                { label: 'Story', pct: storyPct },
                { label: 'Stats', pct: Math.round(statsPct) },
                { label: 'Skills', pct: Math.round(abilitiesPct) },
              ].filter(c => c.label !== 'Stats' || numbers.stats).map(({ label, pct }) => (
                <div key={label} className="view-circle-wrap">
                  <div className="view-circle">
                    <svg viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
                      <circle cx="26" cy="26" r={r} fill="none" stroke="#141420" strokeWidth="3" />
                      <circle cx="26" cy="26" r={r} fill="none" stroke="#c89b3c" strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={circ * (1 - pct / 100)}
                        style={{ transition: 'stroke-dashoffset 0.6s' }}
                      />
                    </svg>
                    <div className="view-circle-pct" style={{ color: '#c89b3c' }}>{pct}%</div>
                  </div>
                  <div className="view-circle-label">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {numbers.stats && <div className="view-section">
            <div className="view-section-title">Base stats</div>
            <div className="view-stats">
              {STAT_FIELDS.map(f => (
                <StatRow
                  key={f.key}
                  statKey={f.key}
                  label={f.label}
                  icon={f.icon}
                  base={base_stats[f.key as keyof typeof base_stats] as number | undefined}
                  growth={base_stats[f.growthKey as keyof typeof base_stats] as number | undefined}
                />
              ))}
              {(base_stats.attack_range?.length ?? 0) > 0 && (
                <div className="view-stat-row">
                  <div className="view-stat-main">
                    <span className="view-stat-icon"><StatIcon name="range" size={14} /></span>
                    <span className="view-stat-label">Attack Range</span>
                    <span className="view-stat-val">{base_stats.attack_range?.join(' / ')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>}

          <div className="view-section">
            <div className="view-section-title">Details</div>
            <div className="view-details">
              {identity.resource_type && <div className="view-detail-row"><span>Resource</span><span>{identity.resource_type}</span></div>}
              {(identity.attack_type ?? []).length > 0 && <div className="view-detail-row"><span>Attack type</span><span>{identity.attack_type!.join(' / ')}</span></div>}
              {(metadata.tags ?? []).length > 0 && <div className="view-detail-row"><span>Tags</span><span>{metadata.tags.join(', ')}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}