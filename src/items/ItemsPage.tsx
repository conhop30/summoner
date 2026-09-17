import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Champion, NamedBuild } from '../champion/types'
import type { Item } from '../item/types'
import { useItemCatalog } from '../item/useItemCatalog'
import {
  addToBuild, removeOneFromBuild, getActiveBuild, updateBuildItems,
  renameNamedBuild, deleteNamedBuild, createNamedBuild, MAX_BUILDS,
} from '../item/buildLogic'
import ItemBrowser from './ItemBrowser'
import BuildPanel from './BuildPanel'
import './ItemsPage.css'

export default function ItemsPage() {
  const navigate = useNavigate()
  const { items, status, syncing, error, sync } = useItemCatalog()
  const [champions, setChampions] = useState<Champion[]>([])
  const [championId, setChampionId] = useState('')
  // Local, synchronously-updated copy of the selected champion's builds.
  // Deriving it straight from `champions` (updated only after the async
  // champion:update round-trip resolves) let rapid clicks read the same
  // stale array and independently decide there was still room for one
  // more — the lost-update race that caused builds to overflow past 6.
  const [builds, setBuilds] = useState<NamedBuild[]>([])
  const [activeBuildId, setActiveBuildId] = useState('')

  useEffect(() => { window.summoner.champion.getAll().then(setChampions) }, [])

  const champion = useMemo(
    () => champions.find(c => c.metadata.id === championId) ?? null,
    [champions, championId]
  )

  useEffect(() => {
    const c = champions.find(ch => ch.metadata.id === championId)
    if (!c) { setBuilds([]); setActiveBuildId(''); return }
    setBuilds(c.builds)
    setActiveBuildId(c.active_build_id)
    // Only re-sync when switching champion, not on every `champions` refresh
    // triggered by our own saves below (that would clobber in-flight clicks).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [championId])

  const activeBuild = builds.length ? getActiveBuild(builds, activeBuildId) : null
  const equipped = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of activeBuild?.items ?? []) m.set(e.item_id, e.count)
    return m
  }, [activeBuild])

  function persist(champId: string, nextBuilds: NamedBuild[], nextActiveId: string) {
    window.summoner.champion.update(champId, { builds: nextBuilds, active_build_id: nextActiveId }).then(updated => {
      if (updated) setChampions(cs => cs.map(c => c.metadata.id === updated.metadata.id ? updated : c))
    })
  }

  function addItem(item: Item) {
    if (!champion) return
    setBuilds(prev => {
      const active = getActiveBuild(prev, activeBuildId)
      const next = updateBuildItems(prev, active.id, addToBuild(active.items, item))
      persist(champion.metadata.id, next, activeBuildId)
      return next
    })
  }

  function removeFromSlot(itemId: string) {
    if (!champion) return
    setBuilds(prev => {
      const active = getActiveBuild(prev, activeBuildId)
      const next = updateBuildItems(prev, active.id, removeOneFromBuild(active.items, itemId))
      persist(champion.metadata.id, next, activeBuildId)
      return next
    })
  }

  function clearActiveBuild() {
    if (!champion) return
    setBuilds(prev => {
      const active = getActiveBuild(prev, activeBuildId)
      const next = updateBuildItems(prev, active.id, [])
      persist(champion.metadata.id, next, activeBuildId)
      return next
    })
  }

  function selectBuild(id: string) {
    if (!champion) return
    setActiveBuildId(id)
    persist(champion.metadata.id, builds, id)
  }

  function addBuild() {
    if (!champion || builds.length >= MAX_BUILDS) return
    const newBuild = createNamedBuild(`Build ${builds.length + 1}`)
    setBuilds(prev => {
      if (prev.length >= MAX_BUILDS) return prev
      const next = [...prev, newBuild]
      persist(champion.metadata.id, next, newBuild.id)
      return next
    })
    setActiveBuildId(newBuild.id)
  }

  function renameBuild(id: string, name: string) {
    if (!champion) return
    setBuilds(prev => {
      const next = renameNamedBuild(prev, id, name)
      persist(champion.metadata.id, next, activeBuildId)
      return next
    })
  }

  function deleteBuild(id: string) {
    if (!champion) return
    setBuilds(prev => {
      const next = deleteNamedBuild(prev, id)
      const nextActiveId = next.some(b => b.id === activeBuildId) ? activeBuildId : next[0].id
      persist(champion.metadata.id, next, nextActiveId)
      if (nextActiveId !== activeBuildId) setActiveBuildId(nextActiveId)
      return next
    })
  }

  const championSelector = (
    <select
      className="build-champion-select"
      value={championId}
      onChange={e => setChampionId(e.target.value)}
    >
      <option value="">Select champion…</option>
      {champions.map(c => (
        <option key={c.metadata.id} value={c.metadata.id}>{c.identity.name}</option>
      ))}
    </select>
  )

  const sidebarExtra = !champion || !activeBuild ? (
    <div className="build-panel">
      <div className="build-panel-title">Build</div>
      {championSelector}
      <div className="stat-compare-empty">Pick a champion to start building</div>
    </div>
  ) : (
    <BuildPanel
      builds={builds}
      activeBuildId={activeBuild.id}
      catalog={items}
      champion={champion}
      onSelectBuild={selectBuild}
      onAddBuild={addBuild}
      onRenameBuild={renameBuild}
      onDeleteBuild={deleteBuild}
      onRemoveOneFromSlot={removeFromSlot}
      onClearActiveBuild={clearActiveBuild}
      headerExtra={championSelector}
    />
  )

  return (
    <div className="items-root">
      <div className="items-top-bar">
        <button className="items-back-btn" onClick={() => navigate('/')}>← Gallery</button>
        <span className="items-title">Items</span>
      </div>

      <ItemBrowser
        items={items}
        status={status}
        syncing={syncing}
        error={error}
        onSync={sync}
        equipped={equipped}
        onAddItem={addItem}
        sidebarExtra={sidebarExtra}
      />
    </div>
  )
}
