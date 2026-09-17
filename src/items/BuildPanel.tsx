import { useState, type ReactNode } from 'react'
import type { NamedBuild, Champion } from '../champion/types'
import type { Item } from '../item/types'
import { MAX_BUILD_SLOTS, resolveBuild, buildGoldTotal, buildStatBonus } from '../item/buildLogic'
import { BUILD_STATS } from '../item/itemFilters'
import BuildTabs from './BuildTabs'
import ItemDetail from './ItemDetail'

interface Props {
  builds: NamedBuild[]
  activeBuildId: string
  catalog: Item[]
  champion: Champion | null
  onSelectBuild: (id: string) => void
  onAddBuild: () => void
  onRenameBuild: (id: string, name: string) => void
  onDeleteBuild: (id: string) => void
  onRemoveOneFromSlot: (itemId: string) => void
  onClearActiveBuild: () => void
  /** Extra control rendered above the tabs — e.g. the champion picker on the standalone page. */
  headerExtra?: ReactNode
}

export default function BuildPanel({
  builds, activeBuildId, catalog, champion,
  onSelectBuild, onAddBuild, onRenameBuild, onDeleteBuild,
  onRemoveOneFromSlot, onClearActiveBuild, headerExtra,
}: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const activeBuild = builds.find(b => b.id === activeBuildId) ?? builds[0]
  const resolved = resolveBuild(activeBuild.items, catalog)
  const gold = buildGoldTotal(resolved)
  const spotlightItem = resolved[hoveredIndex ?? -1]?.item ?? resolved[selectedIndex ?? -1]?.item ?? null

  function selectBuild(id: string) {
    onSelectBuild(id)
    setSelectedIndex(null)
  }

  function removeFromSlot(e: React.MouseEvent, itemId: string) {
    e.preventDefault()
    onRemoveOneFromSlot(itemId)
    setSelectedIndex(null)
  }

  return (
    <>
      <div className="build-panel">
        <div className="build-panel-title">Build</div>
        {headerExtra}

        <BuildTabs
          builds={builds}
          activeBuildId={activeBuild.id}
          onSelect={selectBuild}
          onAdd={onAddBuild}
          onRename={onRenameBuild}
          onDelete={onDeleteBuild}
        />

        <div className="build-inventory-row">
          <div className="build-slots" onMouseLeave={() => setHoveredIndex(null)}>
            {Array.from({ length: MAX_BUILD_SLOTS }).map((_, slot) => {
              const r = resolved[slot]
              return r ? (
                <div
                  className={`build-slot filled${selectedIndex === slot ? ' selected' : ''}`}
                  key={`slot-${slot}`}
                  onMouseEnter={() => setHoveredIndex(slot)}
                  onClick={() => setSelectedIndex(slot)}
                  onContextMenu={e => removeFromSlot(e, r.item.id)}
                  title={`${r.item.name} — click to highlight, right-click to remove one`}
                >
                  <img src={r.item.image_url} alt={r.item.name} />
                  {r.entry.count > 1 && <span className="build-slot-count">×{r.entry.count}</span>}
                </div>
              ) : (
                <div className="build-slot empty" key={`slot-${slot}`} />
              )
            })}
          </div>

          <div className="build-mini-spotlight">
            <ItemDetail item={spotlightItem} emptyMessage="Hover or click a slot" mini />
          </div>
        </div>

        <div className="build-footer">
          <span>{resolved.length}/{MAX_BUILD_SLOTS} slots</span>
          <span className="build-gold">{gold}g</span>
        </div>

        {resolved.length > 0 && (
          <button className="build-clear-btn" onClick={onClearActiveBuild}>Clear build</button>
        )}
      </div>

      <div className="stat-compare-panel">
        <div className="build-panel-title">Stat Comparison</div>
        {!champion ? (
          <div className="stat-compare-empty">Pick a champion to compare</div>
        ) : (
          <div className="stat-compare-table">
            {BUILD_STATS.map(s => {
              const base = s.champKey ? (champion.base_stats[s.champKey] as number | undefined) ?? 0 : 0
              const bonus = buildStatBonus(resolved, s.ddragonKey)
              return (
                <div className="stat-compare-row" key={s.key}>
                  <span className="stat-compare-label">{s.label}</span>
                  <span className="stat-compare-base">{Math.round(base)}</span>
                  <span className={`stat-compare-bonus${bonus ? ' has-bonus' : ''}`}>
                    {bonus
                      ? (s.isPercent ? `+${Math.round(bonus * 100)}%` : `→ ${Math.round(base + bonus)}`)
                      : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
