import type { StatIconKey } from '../champion/statIcons'
import { STAT_ICON_LABELS } from '../champion/statIcons'

// One small icon for each thing an effect can be about. They are Summoner's own drawings, simple
// shapes in the colour of the text around them, so they take a damage type's colour when they sit
// beside one. (League has icons for these too; they are not reproduced here.)
const SHAPES: Record<StatIconKey, JSX.Element> = {
  // A spear point.
  ad: <><path d="M8 2 L11.2 10 H4.8 Z" fill="currentColor" stroke="none" /><path d="M8 10 V14" /></>,
  // A four-pointed spark.
  ap: <path d="M8 1.8 L9.7 6.3 L14.2 8 L9.7 9.7 L8 14.2 L6.3 9.7 L1.8 8 L6.3 6.3 Z" fill="currentColor" stroke="none" />,
  // A breastplate.
  armor: <path d="M5.4 3 L8 4.6 L10.6 3 L13.2 5.6 L11.6 8.2 V13 H4.4 V8.2 L2.8 5.6 Z" />,
  // A ward: a ring around a point.
  mr: <><circle cx="8" cy="8" r="5.4" /><circle cx="8" cy="8" r="1.7" fill="currentColor" stroke="none" /></>,
  // A dagger, point down.
  lethality: <><path d="M8 14 L5.6 6.4 H10.4 Z" fill="currentColor" stroke="none" /><path d="M4.4 4.6 H11.6 M8 2 V4.6" /></>,
  // A cross.
  heal: <path d="M8 3 V13 M3 8 H13" strokeWidth="2.4" />,
  // A heater shield.
  shield: <path d="M8 2.4 L13 4.4 V8.4 C13 11.4 10.6 13 8 14 C5.4 13 3 11.4 3 8.4 V4.4 Z" />,
  // Two chevrons, going forward.
  ms: <path d="M3.6 3.8 L7.8 8 L3.6 12.2 M8.4 3.8 L12.6 8 L8.4 12.2" />,
  // A heart, and the same outlined with a cross for regeneration.
  health: <path d="M8 13.6 C3.2 10.2 2.2 7.6 2.2 6 C2.2 4.2 3.6 3 5.2 3 C6.4 3 7.4 3.7 8 4.7 C8.6 3.7 9.6 3 10.8 3 C12.4 3 13.8 4.2 13.8 6 C13.8 7.6 12.8 10.2 8 13.6 Z" fill="currentColor" stroke="none" />,
  health_regen: <><path d="M8 13.6 C3.2 10.2 2.2 7.6 2.2 6 C2.2 4.2 3.6 3 5.2 3 C6.4 3 7.4 3.7 8 4.7 C8.6 3.7 9.6 3 10.8 3 C12.4 3 13.8 4.2 13.8 6 C13.8 7.6 12.8 10.2 8 13.6 Z" /><path d="M8 6.4 V10 M6.2 8.2 H9.8" strokeWidth="1.3" /></>,
  // A drop, and the same outlined with a cross for regeneration.
  resource: <path d="M8 2 C8 2 3.6 7 3.6 10 C3.6 12.4 5.5 14 8 14 C10.5 14 12.4 12.4 12.4 10 C12.4 7 8 2 8 2 Z" fill="currentColor" stroke="none" />,
  resource_regen: <><path d="M8 2 C8 2 3.6 7 3.6 10 C3.6 12.4 5.5 14 8 14 C10.5 14 12.4 12.4 12.4 10 C12.4 7 8 2 8 2 Z" /><path d="M8 8.2 V11.6 M6.3 9.9 H9.7" strokeWidth="1.3" /></>,
  // A diamond with a point in it.
  crit: <><path d="M8 2 L13.5 8 L8 14 L2.5 8 Z" /><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" /></>,
  // A span between two marks.
  range: <path d="M2 8 H14 M2 5.2 V10.8 M14 5.2 V10.8" />,
  // A bolt.
  as: <path d="M9.2 1.8 L4 9 H7.8 L6.8 14.2 L12 7 H8.2 Z" fill="currentColor" stroke="none" />,
}

export default function StatIcon({ name, size = 14 }: { name: StatIconKey; size?: number }) {
  return (
    <svg
      className="stat-icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={STAT_ICON_LABELS[name]}
    >
      <title>{STAT_ICON_LABELS[name]}</title>
      {SHAPES[name]}
    </svg>
  )
}
