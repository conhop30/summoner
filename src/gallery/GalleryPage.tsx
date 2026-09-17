import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Champion } from '../champion/types'
import ChampionTile from './ChampionTile'
import CreateTile from './CreateTile'
import './GalleryPage.css'

const CLASS_FILTERS = ['All', 'Favorites', 'Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank']

type SortMode = 'name-asc' | 'updated'

export default function GalleryPage() {
  const [champions, setChampions] = useState<Champion[]>([])
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [sort, setSort] = useState<SortMode>('updated')
  const navigate = useNavigate()

  const load = useCallback(() => {
    window.summoner.champion.getAll().then(setChampions)
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
          <button className="gallery-nav-link" onClick={() => navigate('/items')}>Items</button>
          <button className="gallery-nav-link" onClick={() => navigate('/settings')}>Settings</button>
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

      <div className="gallery-grid">
        {filtered.map(c => (
          <ChampionTile
            key={c.metadata.id}
            champion={c}
            onView={() => navigate(`/view/${c.metadata.id}`)}
            onEdit={() => navigate(`/edit/${c.metadata.id}`)}
            onFavoriteToggle={() => handleFavoriteToggle(c)}
          />
        ))}
        <CreateTile onClick={() => navigate('/create')} />
      </div>
    </div>
  )
}