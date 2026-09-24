import { useState, type ReactNode } from 'react'
import type { NamedBuild, Champion, BaseStats } from '../champion/types'
import type { Item } from '../item/types'
import { MAX_BUILD_SLOTS, resolveBuild, buildGoldTotal, aggregateBuildStats } from '../item/buildLogic'
import { CHAMP_KEY_BY_LABEL, compareStatLabels } from '../item/statParsing'
import { formatStat } from '../champion/statSpec'
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const activeBuild = builds.find(b => b.id === activeBuildId) ?? builds[0]
  const resolved = resolveBuild(activeBuild.items, catalog)
  const gold = buildGoldTotal(resolved)
  const selectedItem = resolved[selectedIndex ?? -1]?.item ?? null
  const statTotals = [...aggregateBuildStats(resolved).values()].sort((a, b) => compareStatLabels(a.label, b.label))

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

        <div className="build-slots">
          {Array.from({ length: MAX_BUILD_SLOTS }).map((_, slot) => {
            const r = resolved[slot]
            return r ? (
              <div
                className={`build-slot filled${selectedIndex === slot ? ' selected' : ''}`}
                key={`slot-${slot}`}
                onClick={() => setSelectedIndex(i => (i === slot ? null : slot))}
                onContextMenu={e => removeFromSlot(e, r.item.id)}
                title={`${r.item.name} — click to show its details, right-click to remove one`}
              >
                <img src={r.item.image_url} alt={r.item.name} />
                {r.entry.count > 1 && <span className="build-slot-count">×{r.entry.count}</span>}
              </div>
            ) : (
              <div className="build-slot empty" key={`slot-${slot}`} />
            )
          })}
        </div>

        {/* Full width under the slots, so an item's stats and passives get real room. */}
        <div className="build-item-detail">
          <ItemDetail
            key={selectedItem?.id ?? 'none'}
            item={selectedItem}
            emptyMessage="Click an item in the build to see its details"
            showAll
          />
        </div>

        <div className="build-footer">
          <span>{resolved.length}/{MAX_BUILD_SLOTS} slots</span>
          <span className="build-gold">{gold}g</span>
        </div>

        {resolved.length > 0 && (
          <button className="build-clear-btn" onClick={() => { onClearActiveBuild(); setSelectedIndex(null) }}>Clear build</button>
        )}
      </div>

      <div className="stat-compare-panel">
        <div className="build-panel-title">Stat Comparison</div>
        {!champion ? (
          <div className="stat-compare-empty">Pick a champion to compare</div>
        ) : statTotals.length === 0 ? (
          <div className="stat-compare-empty">Add items to see their effect on stats</div>
        ) : (
          <div className="stat-compare-table">
            {statTotals.map(s => {
              const champKey = CHAMP_KEY_BY_LABEL[s.label] as keyof BaseStats | undefined
              const base = champKey ? (champion.base_stats[champKey] as number | undefined) ?? 0 : undefined
              const bonusText = s.isPercent
                ? `+${Math.round(s.value * 100)}%`
                : base != null && champKey ? `→ ${formatStat(champKey, base + s.value)}` : `+${Math.round(s.value)}`
              return (
                <div className="stat-compare-row" key={s.label}>
                  <span className="stat-compare-label">{s.label}</span>
                  <span className="stat-compare-base">{base != null && champKey ? formatStat(champKey, base) : '—'}</span>
                  <span className="stat-compare-bonus has-bonus">{bonusText}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
