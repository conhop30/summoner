import { useState, useRef, useEffect } from 'react'
import type { JournalTab, AbilityJournal } from '../champion/types'
import { generateId, nowISO } from '../champion/utils'
import './AbilityJournal.css'

interface Props {
  journal: AbilityJournal
  onChange: (journal: AbilityJournal) => void
  /** Which ability the notes belong to, e.g. "Q · Hammer Shock". */
  label: string
}

// The notes for one ability. Wide windows give it a permanent column beside the form; narrow ones
// turn it into a compact strip above the form that "Expand" makes taller (see AbilitiesSection.css).
export default function AbilityJournalPanel({ journal, onChange, label }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [activeTabId, setActiveTabId] = useState<string | null>(
    journal.tabs.length > 0 ? journal.tabs[0].id : null
  )
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const activeTab = journal.tabs.find(t => t.id === activeTabId) ?? journal.tabs[0] ?? null

  useEffect(() => {
    if (editingTabId && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingTabId])

  useEffect(() => {
    if (!activeTabId && journal.tabs.length > 0) {
      setActiveTabId(journal.tabs[0].id)
    }
  }, [journal.tabs])

  function updateTab(id: string, partial: Partial<JournalTab>) {
    onChange({
      tabs: journal.tabs.map(t => t.id === id ? { ...t, ...partial } : t)
    })
  }

  function addTab() {
    const newTab: JournalTab = {
      id: generateId(),
      name: 'New Note',
      content: '',
      created_at: nowISO(),
    }
    onChange({ tabs: [...journal.tabs, newTab] })
    setActiveTabId(newTab.id)
    setEditingTabId(newTab.id)
  }

  function deleteTab(id: string) {
    const remaining = journal.tabs.filter(t => t.id !== id)
    onChange({ tabs: remaining })
    if (activeTabId === id) {
      setActiveTabId(remaining.length > 0 ? remaining[0].id : null)
    }
    setDeleteTargetId(null)
  }

  function handleTabDoubleClick(id: string) {
    setEditingTabId(id)
  }

  function handleNameBlur() {
    setEditingTabId(null)
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') setEditingTabId(null)
    if (e.key === 'Escape') setEditingTabId(null)
  }

  return (
    <>
      <div className={`journal-panel${expanded ? ' expanded' : ''}`}>
        <div className="journal-header">
          <span className="journal-title">Journal</span>
          <span className="journal-for" title={label}>{label}</span>
          <button className="journal-new-tab-btn" onClick={addTab}>+ New</button>
          {journal.tabs.length > 0 && (
            <button className="journal-expand-btn" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>

        <div className="journal-tabs">
          {journal.tabs.map(tab => (
            <div
              key={tab.id}
              className={`journal-tab${activeTab?.id === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => handleTabDoubleClick(tab.id)}
            >
              {editingTabId === tab.id ? (
                <input
                  ref={nameInputRef}
                  className="journal-tab-name-input"
                  value={tab.name}
                  onChange={e => updateTab(tab.id, { name: e.target.value })}
                  onBlur={handleNameBlur}
                  onKeyDown={handleNameKeyDown}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="journal-tab-label">{tab.name}</span>
              )}
              <button
                className="journal-tab-delete"
                onClick={e => { e.stopPropagation(); setDeleteTargetId(tab.id) }}
              >×</button>
            </div>
          ))}
        </div>

        {activeTab && (
          <div className="journal-body">
            <div className="journal-note-header">
              <input
                className="journal-note-name"
                value={activeTab.name}
                placeholder="Note name..."
                onChange={e => updateTab(activeTab.id, { name: e.target.value })}
              />
              <span className="journal-note-date">
                {new Date(activeTab.created_at).toLocaleDateString()}
              </span>
            </div>
            <textarea
              className="journal-textarea"
              placeholder="Dump your raw ideas here — scrapped mechanics, alternate versions, rough notes..."
              value={activeTab.content}
              onChange={e => updateTab(activeTab.id, { content: e.target.value })}
            />
          </div>
        )}

        {journal.tabs.length === 0 && (
          <div className="journal-empty">
            <div className="journal-empty-hint">No notes yet</div>
            <button className="journal-empty-btn" onClick={addTab}>Create first note</button>
          </div>
        )}
      </div>

      {deleteTargetId && (
        <div className="journal-confirm-overlay">
          <div className="journal-confirm-box">
            <div className="journal-confirm-msg">Delete this note? This cannot be undone.</div>
            <div className="journal-confirm-btns">
              <button className="journal-confirm-btn" onClick={() => setDeleteTargetId(null)}>Cancel</button>
              <button className="journal-confirm-btn danger" onClick={() => deleteTab(deleteTargetId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}