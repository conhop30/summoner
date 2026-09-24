import { useState, useMemo, type ReactNode } from 'react'
import type { Item, ItemSyncStatus } from '../item/types'
import {
  SUMMONERS_RIFT_MAP_ID, SORT_OPTIONS, CATEGORIES, categoryOf, dedupeByName,
  compareItems, hasStatFor, timeAgo, type SortKey, type SortDir, type Category,
} from '../item/itemFilters'
import ItemDetail from './ItemDetail'
import './ItemBrowser.css'

interface Props {
  items: Item[]
  status: ItemSyncStatus
  syncing: boolean
  error: string | null
  onSync: () => void
  /** item id -> count currently in the build, for the equipped badge */
  equipped: Map<string, number>
  onAddItem: (item: Item) => void
  /** Extra panel(s) rendered in the right-hand sidebar, beside the pinned-item panel. */
  sidebarExtra?: ReactNode
  compact?: boolean
}

export default function ItemBrowser({
  items, status, syncing, error, onSync, equipped, onAddItem, sidebarExtra, compact,
}: Props) {
  const [search, setSearch] = useState('')
  const [purchasableOnly, setPurchasableOnly] = useState(true)
  const [includeOtherModes, setIncludeOtherModes] = useState(false)
  const [category, setCategory] = useState<Category>('all')
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  // The details panel is only ever filled by a pinned item (right-click), so it stays a calm
  // empty slot until you ask for something to be held there.
  const [pinnedId, setPinnedId] = useState<string | null>(null)

  const visible = useMemo(() => {
    let list = items
    if (purchasableOnly) list = list.filter(i => i.purchasable)
    if (!includeOtherModes) {
      list = list.filter(i => i.maps[SUMMONERS_RIFT_MAP_ID] !== false)
      list = dedupeByName(list)
    }
    if (category !== 'all') list = list.filter(i => categoryOf(i) === category)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(i => i.name.toLowerCase().includes(q))
    list = list.filter(i => hasStatFor(i, sortKey))

    return [...list].sort((a, b) => compareItems(a, b, sortKey, sortDir))
  }, [items, search, purchasableOnly, includeOtherModes, category, sortKey, sortDir])

  // Looked up in the full catalog, so a pinned item stays put even if a filter hides its tile.
  const pinnedItem = useMemo(
    () => (pinnedId ? items.find(i => i.id === pinnedId) ?? null : null),
    [items, pinnedId]
  )

  // When browsing "All Items", split the already-sorted list into tier
  // sections (Basic/Epic/Legendary/...) with headers so a stat sort doesn't
  // read as "broken" once it runs out of items that actually have the stat —
  // the boundary is now a section break instead of an unmarked cliff.
  const sections = useMemo(() => {
    if (category !== 'all') {
      const label = CATEGORIES.find(c => c.key === category)?.label ?? ''
      return [{ key: category, label, items: visible }]
    }
    const groups = new Map<Category, Item[]>()
    for (const item of visible) {
      const cat = categoryOf(item)
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(item)
    }
    return CATEGORIES
      .filter(c => c.key !== 'all' && groups.has(c.key))
      .map(c => ({ key: c.key, label: c.label, items: groups.get(c.key)! }))
  }, [visible, category])

  function selectSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(SORT_OPTIONS.find(o => o.key === key)?.defaultDir ?? 'asc')
    }
  }

  return (
    <div className={`item-browser${compact ? ' compact' : ''}`}>
      <div className="item-browser-sync-row">
        {status.version ? (
          <span className="items-sync-status">
            Synced <strong>{status.version}</strong> · {timeAgo(status.synced_at!)}
          </span>
        ) : (
          <span className="items-sync-status items-sync-status-empty">Not synced yet</span>
        )}
        <button className="items-sync-btn" onClick={onSync} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync from Data Dragon'}
        </button>
      </div>

      {error && <div className="items-error">Couldn't reach Data Dragon: {error}</div>}

      <div className="items-category-bar">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            className={`items-category-btn${category === c.key ? ' active' : ''}`}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="items-filter-bar">
        <div className="items-search-wrap">
          <span className="items-search-icon">⌕</span>
          <input
            className="items-search"
            placeholder="Search items"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <label className="items-toggle">
          <input
            type="checkbox"
            checked={purchasableOnly}
            onChange={e => setPurchasableOnly(e.target.checked)}
          />
          Purchasable only
        </label>

        <label className="items-toggle">
          <input
            type="checkbox"
            checked={includeOtherModes}
            onChange={e => setIncludeOtherModes(e.target.checked)}
          />
          Include Arena / ARAM / other modes
        </label>

        <span className="items-count">{visible.length} of {items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="items-empty">
          No items yet — click "Sync from Data Dragon" to pull the current item set from Riot's public data feed.
        </div>
      ) : (
        <div className="items-shop">
          <div className="items-sort-rail">
            {SORT_OPTIONS.map(o => (
              <button
                key={o.key}
                className={`items-sort-rail-btn${sortKey === o.key ? ' active' : ''}`}
                onClick={() => selectSort(o.key)}
                title={`Sort by ${o.label}${sortKey === o.key ? (sortDir === 'asc' ? ' (ascending)' : ' (descending)') : ''}`}
              >
                <span className="items-sort-rail-icon">{o.icon}</span>
                {sortKey === o.key && (
                  <span className="items-sort-rail-dir">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </div>

          <div className="items-grid-col">
            {sections.map(section => (
              <div className="items-category-group" key={section.key}>
                {category === 'all' && (
                  <div className="items-category-header">
                    <span className="items-category-header-label">{section.label}</span>
                    <span className="items-category-header-count">{section.items.length}</span>
                  </div>
                )}
                <div className="items-grid">
                  {section.items.map(item => {
                    const count = equipped.get(item.id) ?? 0
                    return (
                      <div
                        className={`item-tile${count > 0 ? ' equipped' : ''}${pinnedId === item.id ? ' pinned' : ''}`}
                        key={item.id}
                        onClick={() => onAddItem(item)}
                        onContextMenu={e => {
                          e.preventDefault()
                          setPinnedId(id => (id === item.id ? null : item.id))
                        }}
                        title="Click to add to build · Right-click to pin its details"
                      >
                        <div className="item-tile-image-wrap">
                          {item.image_url ? (
                            <img className="item-tile-image" src={item.image_url} alt={item.name} loading="lazy" />
                          ) : (
                            <div className="item-tile-image-placeholder" />
                          )}
                          {item.gold_total != null && item.gold_total > 0 && (
                            <span className="item-tile-gold">{item.gold_total}</span>
                          )}
                          {count > 0 && (
                            <span className="item-tile-equipped-badge">{count > 1 ? `×${count}` : '✓'}</span>
                          )}
                        </div>
                        <div className="item-tile-name">{item.name}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="items-sidebar">
            <div className="items-sidebar-inventory">
              {sidebarExtra}
            </div>

            <div className="item-detail-panel">
              <ItemDetail
                item={pinnedItem}
                emptyMessage="Right-click an item to pin its details here."
                pinned={!!pinnedItem}
                onUnpin={() => setPinnedId(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
