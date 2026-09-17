import { useState, useRef, useEffect } from 'react'
import type { NamedBuild } from '../champion/types'
import { MAX_BUILDS } from '../item/buildLogic'

interface Props {
  builds: NamedBuild[]
  activeBuildId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export default function BuildTabs({ builds, activeBuildId, onSelect, onAdd, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.select()
  }, [editingId])

  function startEditing(build: NamedBuild) {
    setEditingId(build.id)
    setDraft(build.name)
  }

  function commitEdit() {
    if (editingId && draft.trim()) onRename(editingId, draft.trim())
    setEditingId(null)
  }

  return (
    <div className="build-tabs">
      {builds.map(build => (
        <div
          key={build.id}
          className={`build-tab${build.id === activeBuildId ? ' active' : ''}`}
          onClick={() => onSelect(build.id)}
          onDoubleClick={() => startEditing(build)}
          title="Click to switch, double-click to rename"
        >
          {editingId === build.id ? (
            <input
              ref={inputRef}
              className="build-tab-rename-input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onClick={e => e.stopPropagation()}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') setEditingId(null)
              }}
              autoFocus
            />
          ) : (
            <span className="build-tab-name">{build.name}</span>
          )}
          {builds.length > 1 && editingId !== build.id && (
            <button
              className="build-tab-close"
              onClick={e => { e.stopPropagation(); onDelete(build.id) }}
              title="Delete this build"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {builds.length < MAX_BUILDS && (
        <button className="build-tab-add" onClick={onAdd} title="Add a new build">+</button>
      )}
    </div>
  )
}
