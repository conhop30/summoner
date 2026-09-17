import './CreateTile.css'

interface Props {
  onClick: () => void
}

export default function CreateTile({ onClick }: Props) {
  return (
    <div className="create-tile" onClick={onClick}>
      <div className="create-plus">+</div>
      <div className="create-text">New champion</div>
    </div>
  )
}