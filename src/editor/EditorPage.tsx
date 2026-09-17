import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Champion, AbilitySlot } from '../champion/types'
import { defaultAbilities, defaultBaseStats } from '../champion/utils'
import { defaultBuilds } from '../item/buildLogic'
import { SCHEMA_VERSION } from '../db/schema'
import StoryPanel from './StoryPanel'
import StatsPanel from './StatsPanel'
import AbilitiesSection from './AbilitiesSection'
import './EditorPage.css'

export type EditorMode = 'create' | 'edit'
type RightTab = 'stats' | 'abilities'

interface Props {
  mode: EditorMode
}

const STAT_KEYS = ['health', 'attack_damage', 'armor', 'magic_resistance', 'movement_speed']
const ABILITY_SLOTS: AbilitySlot[] = ['passive', 'q', 'w', 'e', 'r']

function calcStoryPct(c: Champion): number {
  const pts = [
    !!c.identity.name,
    !!c.identity.lore,
    (c.identity.role ?? []).length > 0,
    (c.identity.class ?? []).length > 0,
  ]
  return Math.round((pts.filter(Boolean).length / pts.length) * 100)
}

function calcStatsPct(c: Champion): number {
  const filled = STAT_KEYS.filter(k => c.base_stats[k as keyof typeof c.base_stats] != null).length
  return Math.round((filled / STAT_KEYS.length) * 100)
}

function calcAbilitiesPct(c: Champion): number {
  const filled = ABILITY_SLOTS.filter(s => !!c.abilities[s]?.name).length
  return Math.round((filled / ABILITY_SLOTS.length) * 100)
}

function SpineWheel({ pct, color }: { pct: number; color: string }) {
  const r = 13
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)
  return (
    <svg viewBox="0 0 32 32" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
      <circle cx="16" cy="16" r={r} fill="none" stroke="#141420" strokeWidth="2.5" />
      <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  )
}

function BigWheel({ storyPct, statsPct, abilitiesPct }: { storyPct: number; statsPct: number; abilitiesPct: number }) {
  const r = 23
  const circ = 2 * Math.PI * r
  const seg = circ / 3
  const gap = 4
  const arcs = [
    { id: 'story',     offset: 0,            pct: storyPct },
    { id: 'stats',     offset: -(seg),        pct: statsPct },
    { id: 'abilities', offset: -(seg * 2),    pct: abilitiesPct },
  ]
  const totalPct = Math.round((storyPct + statsPct + abilitiesPct) / 3)

  return (
    <div className="big-wheel-wrap">
      <svg viewBox="0 0 56 56" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="#111118" strokeWidth="6" />
        {arcs.map(a => {
          const filled = a.pct === 100
          return (
            <circle key={a.id}
              cx="28" cy="28" r={r}
              fill="none"
              stroke={filled ? '#0bc4e3' : '#1e2038'}
              strokeWidth="6"
              strokeLinecap="butt"
              strokeDasharray={filled ? `${seg - gap} ${circ - seg + gap}` : `0 ${circ}`}
              strokeDashoffset={a.offset}
              style={{ transition: 'stroke-dasharray 0.5s cubic-bezier(0.4,0,0.2,1)' }}
            />
          )
        })}
      </svg>
      <div className="big-wheel-center">
        <div className="big-wheel-pct">{totalPct}%</div>
      </div>
    </div>
  )
}

export default function EditorPage({ mode }: Props) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [champion, setChampion] = useState<Champion | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('stats')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const isNew = useRef(mode === 'create')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode === 'edit' && id) {
      window.summoner.champion.get(id).then(c => {
        if (c) setChampion(c)
        else navigate('/')
      })
    } else {
      const now = new Date().toISOString()
      const builds = defaultBuilds()
      setChampion({
        identity: { name: '' },
        base_stats: { ...defaultBaseStats() },
        abilities: { ...defaultAbilities() } as any,
        builds,
        active_build_id: builds[0].id,
        metadata: {
          id: '', created_at: now, updated_at: now,
          version: SCHEMA_VERSION, is_favorite: false, tags: [],
        },
      })
    }
  }, [mode, id])

  const save = useCallback(async (c: Champion) => {
    setSaveStatus('saving')
    try {
      if (isNew.current) {
        if (!c.identity.name.trim()) { setSaveStatus('unsaved'); return }
        const created = await window.summoner.champion.create(c.identity.name, {
          identity: c.identity, base_stats: c.base_stats, abilities: c.abilities,
          builds: c.builds, active_build_id: c.active_build_id,
        })
        isNew.current = false
        setChampion(created)
      } else {
        await window.summoner.champion.update(c.metadata.id, {
          identity: c.identity, base_stats: c.base_stats, abilities: c.abilities,
          is_favorite: c.metadata.is_favorite, tags: c.metadata.tags,
          builds: c.builds, active_build_id: c.active_build_id,
        })
      }
      setSaveStatus('saved')
    } catch { setSaveStatus('unsaved') }
  }, [])

  const handleChange = useCallback((updated: Champion) => {
    setChampion(updated)
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(updated), 600)
  }, [save])

  if (!champion) return <div className="editor-loading" />

  const storyPct = calcStoryPct(champion)
  const statsPct = calcStatsPct(champion)
  const abilitiesPct = calcAbilitiesPct(champion)

  return (
    <div className="editor-root">
      <div className="editor-spine">
        <button className="spine-back" onClick={() => navigate('/')}>←</button>

        <BigWheel storyPct={storyPct} statsPct={statsPct} abilitiesPct={abilitiesPct} />

        <nav className="spine-nav">
          {([
            { key: 'story', label: 'Story', icon: '✦', pct: storyPct },
            { key: 'stats', label: 'Stats', icon: '◈', pct: statsPct },
            { key: 'abilities', label: 'Skills', icon: '⚡', pct: abilitiesPct },
          ] as const).map(item => (
            <button
              key={item.key}
              className={`spine-nav-btn${rightTab === item.key || (item.key === 'story') ? '' : ''}${item.pct === 100 ? ' done' : ''}`}
              onClick={() => item.key !== 'story' && setRightTab(item.key as RightTab)}
              style={{ cursor: item.key === 'story' ? 'default' : 'pointer' }}
            >
              <div className="spine-nav-ring">
                <SpineWheel pct={item.pct} color={item.pct === 100 ? '#0bc4e3' : '#c89b3c'} />
                <span className="spine-nav-icon" style={{ color: item.pct === 100 ? '#0bc4e3' : undefined }}>
                  {item.icon}
                </span>
              </div>
              <span className="spine-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="spine-save-status">
          <span className={`save-dot ${saveStatus}`} />
          <span className="save-label">{saveStatus === 'saving' ? 'Saving' : saveStatus === 'saved' ? 'Saved' : 'Unsaved'}</span>
        </div>
      </div>

      <div className="editor-body">
        <div className="editor-left">
          <StoryPanel champion={champion} onChange={handleChange} />
        </div>

        <div className="editor-right">
          <div className="editor-right-tabs">
            <button
              className={`editor-right-tab${rightTab === 'stats' ? ' active' : ''}`}
              onClick={() => setRightTab('stats')}
            >
              Stats
            </button>
            <button
              className={`editor-right-tab${rightTab === 'abilities' ? ' active' : ''}`}
              onClick={() => setRightTab('abilities')}
            >
              Abilities
            </button>
          </div>
          <div className="editor-right-content">
            {rightTab === 'stats' && (
              <StatsPanel champion={champion} onChange={handleChange} />
            )}
            {rightTab === 'abilities' && (
              <AbilitiesSection champion={champion} onChange={handleChange} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}