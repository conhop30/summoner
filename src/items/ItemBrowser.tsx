import { useState, useMemo, type ReactNode } from 'react'
import type { Item, ItemSyncStatus } from '../item/types'
import {
  SUMMONERS_RIFT_MAP_ID, SORT_OPTIONS, CATEGORIES, categoryOf, dedupeByName,
  sortValue, timeAgo, type SortKey, type SortDir, type Category,
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
  /** Extra panel(s) rendered in the right-hand sidebar, below the hover-detail panel. */
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
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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

    return [...list].sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [items, search, purchasableOnly, includeOtherModes, category, sortKey, sortDir])

  const detailItem = useMemo(
    () => visible.find(i => i.id === hoveredId) ?? visible[0] ?? null,
    [visible, hoveredId]
  )

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

          <div className="items-grid" onMouseLeave={() => setHoveredId(null)}>
            {visible.map(item => {
              const count = equipped.get(item.id) ?? 0
              return (
                <div
                  className={`item-tile${detailItem?.id === item.id ? ' active' : ''}${count > 0 ? ' equipped' : ''}`}
                  key={item.id}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onClick={() => onAddItem(item)}
                  title="Click to add to build"
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

          <div className="items-sidebar">
            <div className="item-detail-panel">
              <ItemDetail item={detailItem} emptyMessage="Hover an item to see its details" />
            </div>

            {sidebarExtra}
          </div>
        </div>
      )}
    </div>
  )
}
