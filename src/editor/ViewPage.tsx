import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Champion, AbilitySlot } from '../champion/types'
import './ViewPage.css'

const SLOTS: AbilitySlot[] = ['passive', 'q', 'w', 'e', 'r']
const SLOT_LABELS: Record<AbilitySlot, string> = { passive: 'P', q: 'Q', w: 'W', e: 'E', r: 'R' }

const STAT_FIELDS = [
  { key: 'health',          growthKey: 'health_growth',          label: 'Health',       icon: '♥' },
  { key: 'health_regen',    growthKey: 'health_regen_growth',    label: 'HP Regen',     icon: '✚' },
  { key: 'resource',        growthKey: 'resource_growth',        label: 'Resource',     icon: '◈' },
  { key: 'attack_damage',   growthKey: 'attack_damage_growth',   label: 'Attack Dmg',   icon: '⚔' },
  { key: 'attack_speed',    growthKey: 'attack_speed_growth',    label: 'Attack Speed', icon: '⚡' },
  { key: 'armor',           growthKey: 'armor_growth',           label: 'Armor',        icon: '🛡' },
  { key: 'magic_resistance',growthKey: 'magic_resistance_growth',label: 'Magic Resist', icon: '✦' },
  { key: 'movement_speed',  growthKey: 'movement_speed_growth',  label: 'Move Speed',   icon: '➢' },
] as const

interface StatRowProps {
  label: string
  icon: string
  base?: number
  growth?: number
}

function StatRow({ label, icon, base, growth }: StatRowProps) {
  const [expanded, setExpanded] = useState(false)
  if (!base) return null
  return (
    <div className="view-stat-row">
      <div className="view-stat-main" onClick={() => growth && setExpanded(e => !e)}>
        <span className="view-stat-icon">{icon}</span>
        <span className="view-stat-label">{label}</span>
        <span className="view-stat-val">{base}</span>
        {growth && (
          <span className={`view-stat-toggle${expanded ? ' open' : ''}`}>▾</span>
        )}
      </div>
      {expanded && growth && (
        <div className="view-stat-scaling">
          <div className="view-stat-scaling-row">
            <span>Per level</span>
            <span>+{growth}</span>
          </div>
          {[6, 11, 16, 18].map(lvl => (
            <div key={lvl} className="view-stat-scaling-row">
              <span>Level {lvl}</span>
              <span>{Math.round(base + growth * (lvl - 1))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function drawChampionCard(champion: Champion): Promise<Blob> {
  return new Promise(resolve => {
    const W = 1200
    const H = 675
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#08080f'
    ctx.fillRect(0, 0, W, H)

    const drawContent = () => {
      ctx.fillStyle = 'rgba(8,8,15,0.7)'
      ctx.fillRect(0, 0, W, H)

      ctx.fillStyle = 'rgba(200,155,60,0.15)'
      ctx.fillRect(0, 0, 4, H)

      ctx.fillStyle = '#c8aa6e'
      ctx.font = '500 52px sans-serif'
      ctx.fillText(champion.identity.name.toUpperCase(), 48, 96)

      if (champion.identity.title) {
        ctx.fillStyle = '#3a3a50'
        ctx.font = '400 20px sans-serif'
        ctx.fillText(champion.identity.title, 50, 130)
      }

      if (champion.identity.lore) {
        ctx.fillStyle = '#4a4a60'
        ctx.font = '400 16px sans-serif'
        const words = champion.identity.lore.split(' ')
        let line = ''
        let y = 180
        const maxWidth = 560
        for (const word of words) {
          const test = line + word + ' '
          if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, 50, y)
            line = word + ' '
            y += 26
            if (y > 380) { ctx.fillText(line + '...', 50, y); break }
          } else {
            line = test
          }
        }
        if (y <= 380) ctx.fillText(line, 50, y)
      }

      ctx.strokeStyle = '#141420'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(50, 420)
      ctx.lineTo(630, 420)
      ctx.stroke()

      ctx.fillStyle = '#2a2a3a'
      ctx.font = '400 10px sans-serif'
      ctx.fillText('ABILITIES', 50, 450)

      const slotColors: Record<string, string> = { passive: '#534AB7', q: '#0F6E56', w: '#993C1D', e: '#185FA5', r: '#c89b3c' }
      let ay = 475
      for (const slot of SLOTS) {
        const ability = champion.abilities[slot]
        if (!ability?.name) continue
        ctx.fillStyle = slotColors[slot] ?? '#c89b3c'
        ctx.font = '500 11px sans-serif'
        ctx.fillText(SLOT_LABELS[slot], 50, ay)
        ctx.fillStyle = '#c8aa6e'
        ctx.font = '500 14px sans-serif'
        ctx.fillText(ability.name.toUpperCase(), 72, ay)
        if (ability.description) {
          ctx.fillStyle = '#3a3a50'
          ctx.font = '400 12px sans-serif'
          const desc = ability.description.length > 90 ? ability.description.slice(0, 90) + '…' : ability.description
          ctx.fillText(desc, 72, ay + 18)
        }
        ay += 48
        if (ay > H - 40) break
      }

      ctx.fillStyle = '#1a1a28'
      ctx.font = '400 11px sans-serif'
      ctx.fillText('Created with Summoner', W - 200, H - 20)

      canvas.toBlob(blob => resolve(blob!), 'image/png')
    }

    if (champion.identity.image_path) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const aspect = img.width / img.height
        const drawH = H
        const drawW = drawH * aspect
        const x = W - drawW
        ctx.drawImage(img, x, 0, drawW, drawH)
        const grad = ctx.createLinearGradient(W / 2, 0, W - 200, 0)
        grad.addColorStop(0, '#08080f')
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
        drawContent()
      }
      img.onerror = drawContent
      img.src = champion.identity.image_path
    } else {
      const initials = champion.identity.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      ctx.fillStyle = '#0d0a1e'
      ctx.fillRect(W / 2, 0, W / 2, H)
      ctx.fillStyle = 'rgba(83,74,183,0.12)'
      ctx.font = '500 200px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(initials, W * 0.75, H / 2 + 70)
      ctx.textAlign = 'left'
      drawContent()
    }
  })
}

export default function ViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [champion, setChampion] = useState<Champion | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return
    window.summoner.champion.get(id).then(c => {
      if (c) setChampion(c)
      else navigate('/')
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
  //const roleLabel = [...(identity.class ?? []), ...(identity.role ?? [])].join(' · ')
  const playstyle = (identity as any).playstyle

  const storyPct = (identity.name ? 25 : 0) + (identity.lore ? 50 : 0) + ((identity.role ?? []).length > 0 ? 25 : 0)
  const statsPct = STAT_FIELDS.filter(f => base_stats[f.key as keyof typeof base_stats]).length / STAT_FIELDS.length * 100
  const abilitiesPct = SLOTS.filter(s => abilities[s]?.name).length / SLOTS.length * 100
  //const totalPct = Math.round((storyPct + statsPct + abilitiesPct) / 3)

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
          <button className="view-action-btn" onClick={() => navigate(`/edit/${id}`)}>Edit champion</button>
          <button className="view-action-btn primary" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Generating...' : 'Download card'}
          </button>
        </div>

        <div className="view-hero-content">
          <div className="view-hero-name">{identity.name}</div>
          {identity.title && <div className="view-hero-title">{identity.title}</div>}
          <div className="view-hero-tags">
            {[...(identity.class ?? []), ...(identity.role ?? []), ...(identity.attack_type ?? [])].map(t => (
              <span key={t} className="view-hero-tag">{t}</span>
            ))}
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
            <div className="view-abilities">
              {SLOTS.map(slot => {
                const ability = abilities[slot]
                if (!ability?.name) return null
                return (
                  <div key={slot} className="view-ability">
                    <div className="view-ability-slot">{SLOT_LABELS[slot]}</div>
                    <div className="view-ability-body">
                      <div className="view-ability-name">{ability.name}</div>
                      {ability.description && (
                        <div className="view-ability-desc">{ability.description}</div>
                      )}
                      {(ability.effects ?? []).length > 0 && (
                        <div className="view-ability-effects">
                          {ability.effects!.map((e, i) => (
                            <span key={i} className="view-effect-tag">{e.type}{e.damage_type ? ` · ${e.damage_type}` : ''}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
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
              ].map(({ label, pct }) => (
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

          <div className="view-section">
            <div className="view-section-title">Base stats</div>
            <div className="view-stats">
              {STAT_FIELDS.map(f => (
                <StatRow
                  key={f.key}
                  label={f.label}
                  icon={f.icon}
                  base={base_stats[f.key as keyof typeof base_stats] as number | undefined}
                  growth={base_stats[f.growthKey as keyof typeof base_stats] as number | undefined}
                />
              ))}
              {(base_stats.attack_range?.length ?? 0) > 0 && (
                <div className="view-stat-row">
                  <div className="view-stat-main">
                    <span className="view-stat-icon">◎</span>
                    <span className="view-stat-label">Attack Range</span>
                    <span className="view-stat-val">{base_stats.attack_range?.join(' / ')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

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