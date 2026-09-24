import type { Champion } from '../champion/types'
import './NameTitle.css'

interface Props {
  champion: Champion
  onChange: (c: Champion) => void
}

// Always on screen, above the Stats/Abilities tabs, so the champion is named wherever you are.
export default function NameTitle({ champion, onChange }: Props) {
  const { identity } = champion

  function update(partial: Partial<typeof identity>) {
    onChange({ ...champion, identity: { ...identity, ...partial } })
  }

  return (
    <div className="name-title">
      <input
        className="name-title-name"
        placeholder="CHAMPION NAME"
        value={identity.name}
        onChange={e => update({ name: e.target.value })}
      />
      <input
        className="name-title-title"
        placeholder="Title"
        value={identity.title ?? ''}
        onChange={e => update({ title: e.target.value })}
      />
    </div>
  )
}
