import { useMemo } from 'react'
import type { Champion } from '../champion/types'
import type { Item } from '../item/types'
import { useItemCatalog } from '../item/useItemCatalog'
import {
  addToBuild, removeOneFromBuild, getActiveBuild, updateBuildItems,
  addNamedBuild, renameNamedBuild, deleteNamedBuild, MAX_BUILDS,
} from '../item/buildLogic'
import ItemBrowser from '../items/ItemBrowser'
import BuildPanel from '../items/BuildPanel'

interface Props {
  champion: Champion
  onChange: (c: Champion) => void
}

export default function ItemLoadoutPanel({ champion, onChange }: Props) {
  const { items, status, syncing, error, sync } = useItemCatalog()
  const activeBuild = getActiveBuild(champion.builds, champion.active_build_id)

  const equipped = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of activeBuild.items) m.set(e.item_id, e.count)
    return m
  }, [activeBuild])

  function addItem(item: Item) {
    const next = updateBuildItems(champion.builds, activeBuild.id, addToBuild(activeBuild.items, item))
    onChange({ ...champion, builds: next })
  }

  function removeFromSlot(itemId: string) {
    const next = updateBuildItems(champion.builds, activeBuild.id, removeOneFromBuild(activeBuild.items, itemId))
    onChange({ ...champion, builds: next })
  }

  function clearActiveBuild() {
    const next = updateBuildItems(champion.builds, activeBuild.id, [])
    onChange({ ...champion, builds: next })
  }

  function selectBuild(id: string) {
    onChange({ ...champion, active_build_id: id })
  }

  function addBuild() {
    if (champion.builds.length >= MAX_BUILDS) return
    const next = addNamedBuild(champion.builds)
    const added = next[next.length - 1]
    onChange({ ...champion, builds: next, active_build_id: added.id })
  }

  function renameBuild(id: string, name: string) {
    onChange({ ...champion, builds: renameNamedBuild(champion.builds, id, name) })
  }

  function deleteBuild(id: string) {
    const next = deleteNamedBuild(champion.builds, id)
    const nextActiveId = next.some(b => b.id === champion.active_build_id) ? champion.active_build_id : next[0].id
    onChange({ ...champion, builds: next, active_build_id: nextActiveId })
  }

  return (
    <ItemBrowser
      items={items}
      status={status}
      syncing={syncing}
      error={error}
      onSync={sync}
      equipped={equipped}
      onAddItem={addItem}
      sidebarExtra={
        <BuildPanel
          builds={champion.builds}
          activeBuildId={activeBuild.id}
          catalog={items}
          champion={champion}
          onSelectBuild={selectBuild}
          onAddBuild={addBuild}
          onRenameBuild={renameBuild}
          onDeleteBuild={deleteBuild}
          onRemoveOneFromSlot={removeFromSlot}
          onClearActiveBuild={clearActiveBuild}
        />
      }
      compact
    />
  )
}
