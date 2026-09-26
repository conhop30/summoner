// How much of Summoner's numbers a person wants to see. Ability numbers (cooldown, cost, effects),
// stats and items, and the win-rate projection are three separate switches, and there are two
// starting points: Story (no numbers, only what a champion is and what its abilities say) and Full.
// Hiding is never deleting: everything typed stays stored, so a switch turned back on brings it all back.

export interface NumbersSettings {
  numbers_abilities: boolean
  numbers_stats: boolean
  /** The projection reads the stats and the ability numbers, so it is only on when both are. */
  numbers_win_rate: boolean
}

export type NumbersPreset = 'story' | 'full'

export const NUMBERS_PRESETS: Record<NumbersPreset, NumbersSettings> = {
  story: { numbers_abilities: false, numbers_stats: false, numbers_win_rate: false },
  full: { numbers_abilities: true, numbers_stats: true, numbers_win_rate: true },
}

/**
 * The switches after a change. Win rate needs the other two, so asking for it turns them on, and
 * turning either of them off turns it off.
 */
export function applyNumbers(current: NumbersSettings, change: Partial<NumbersSettings>): NumbersSettings {
  const next = { ...current, ...change }
  if (change.numbers_win_rate === true) return { numbers_abilities: true, numbers_stats: true, numbers_win_rate: true }
  if (!next.numbers_abilities || !next.numbers_stats) next.numbers_win_rate = false
  return next
}

/** Which starting point the switches are exactly, or "custom" for a mix. */
export function presetOf(s: NumbersSettings): NumbersPreset | 'custom' {
  for (const key of Object.keys(NUMBERS_PRESETS) as NumbersPreset[]) {
    const p = NUMBERS_PRESETS[key]
    if (p.numbers_abilities === s.numbers_abilities && p.numbers_stats === s.numbers_stats && p.numbers_win_rate === s.numbers_win_rate) return key
  }
  return 'custom'
}
