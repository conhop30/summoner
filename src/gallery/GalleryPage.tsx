import { useEffect, useState, useCallback } from 'react'
import { startupReady } from '../shared/startup'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Champion } from '../champion/types'
import ChampionTile from './ChampionTile'
import CreateTile from './CreateTile'
import CreateBar from './CreateBar'
import ConfirmDialog from '../shared/ConfirmDialog'
import './GalleryPage.css'

const CLASS_FILTERS = ['All', 'Favorites', 'Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank']

type SortMode = 'name-asc' | 'updated'

export default function GalleryPage() {
  const [champions, setChampions] = useState<Champion[]>([])
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [sort, setSort] = useState<SortMode>('updated')
  const [pendingDelete, setPendingDelete] = useState<Champion | null>(null)
  const navigate = useNavigate()

  const load = useCallback(() => {
    window.summoner.champion.getAll().then(list => {
      setChampions(list)
      startupReady('gallery')
    })
  }, [])

const location = useLocation()

useEffect(() => {
  load()
}, [load, location])

const handleFavoriteToggle = useCallback(async (champion: Champion) => {
    await window.summoner.champion.update(champion.metadata.id, {
      is_favorite: !champion.metadata.is_favorite,
    })
    load()
  }, [load])

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    await window.summoner.champion.delete(pendingDelete.metadata.id)
    setPendingDelete(null)
    load()
  }, [pendingDelete, load])

  const filtered = champions
    .filter(c => {
      const name = c.identity.name.toLowerCase()
      const tags = (c.metadata.tags ?? []).join(' ').toLowerCase()
      const matchesSearch = name.includes(search.toLowerCase()) || tags.includes(search.toLowerCase())
      const matchesFilter =
        activeFilter === 'All' ? true :
        activeFilter === 'Favorites' ? c.metadata.is_favorite :
        (c.identity.class ?? []).includes(activeFilter)
      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      if (sort === 'name-asc') return a.identity.name.localeCompare(b.identity.name)
      return new Date(b.metadata.updated_at).getTime() - new Date(a.metadata.updated_at).getTime()
    })

  return (
    <div className="gallery-root">
      <div className="gallery-top-bar">
        <span className="gallery-title">My Champions</span>
        <div className="gallery-controls">
          <div className="gallery-sort">
            <button
              className={`gallery-sort-btn${sort === 'updated' ? ' active' : ''}`}
              onClick={() => setSort('updated')}
            >
              Recent
            </button>
            <button
              className={`gallery-sort-btn${sort === 'name-asc' ? ' active' : ''}`}
              onClick={() => setSort('name-asc')}
            >
              A–Z
            </button>
          </div>
          <div className="gallery-search-wrap">
            <span className="gallery-search-icon">⌕</span>
            <input
              className="gallery-search"
              placeholder="Search champions or tags"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="gallery-filter-bar">
        <span className="gallery-filter-label">Filter</span>
        {CLASS_FILTERS.map(f => (
          <button
            key={f}
            className={`gallery-filter-btn${activeFilter === f ? ' active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <CreateBar onClick={() => navigate('/create')} />

      <div className="gallery-grid">
        {filtered.map(c => (
          <ChampionTile
            key={c.metadata.id}
            champion={c}
            onView={() => navigate(`/view/${c.metadata.id}`)}
            onEdit={() => navigate(`/edit/${c.metadata.id}`)}
            onFavoriteToggle={() => handleFavoriteToggle(c)}
            onDelete={() => setPendingDelete(c)}
          />
        ))}
        <CreateTile onClick={() => navigate('/create')} />
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.identity.name || 'this champion'}?`}
          message="This permanently deletes the champion along with their story, stats, abilities, and item builds. This can't be undone."
          confirmLabel="Delete champion"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}