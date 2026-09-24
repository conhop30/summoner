import { useState } from 'react'
import type { Item } from '../item/types'

interface Props {
  item: Item | null
  emptyMessage: string
  /** Smaller layout for the inventory's mini-spotlight vs. the full store panel. */
  mini?: boolean
  /** The shown item is pinned (right-clicked) in the store; shows an unpin control. */
  pinned?: boolean
  onUnpin?: () => void
}

export default function ItemDetail({ item, emptyMessage, mini, pinned, onUnpin }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!item) {
    return <div className="item-detail-empty">{emptyMessage}</div>
  }

  const collapsible = !mini && !!item.description

  return (
    <>
      {pinned && (
        <div className="item-detail-pinned">
          <span>📌 Pinned</span>
          <button className="item-detail-unpin" onClick={onUnpin}>Unpin</button>
        </div>
      )}
      <div className="item-detail-header">
        {item.image_url && (
          <img className="item-detail-image" src={item.image_url} alt={item.name} />
        )}
        <div>
          <div className="item-detail-name">{item.name}</div>
          {item.gold_total != null && item.gold_total > 0 && (
            <div className="item-detail-gold-row">
              <span className="item-detail-gold-buy">{item.gold_total}g</span>
              {!mini && item.gold_sell != null && (
                <span className="item-detail-gold-sell">sell {item.gold_sell}g</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="item-detail-body">
        {item.description && (
          <div
            className={`item-detail-description${collapsible && !expanded ? ' collapsed' : ''}`}
            dangerouslySetInnerHTML={{ __html: item.description }}
          />
        )}
        {collapsible && (
          <button className="item-detail-toggle" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Show less ▲' : 'Show full details ▼'}
          </button>
        )}
      </div>

      {!mini && item.tags.length > 0 && (
        <div className="item-detail-tags">
          {item.tags.map(tag => (
            <span key={tag} className="item-detail-tag">{tag}</span>
          ))}
        </div>
      )}
    </>
  )
}
