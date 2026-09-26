import './CreateBar.css'

interface Props {
  onClick: () => void
}

// The same "new champion" action as the card at the end of the grid, laid out as a bar above the
// cards so a long gallery doesn't need a scroll to the bottom to add one.
export default function CreateBar({ onClick }: Props) {
  return (
    <div className="create-bar-row">
      <button className="create-bar" onClick={onClick}>
        <span className="create-bar-plus" aria-hidden="true">+</span>
        <span className="create-bar-text">New champion</span>
      </button>
    </div>
  )
}
