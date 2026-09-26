import { useSettings } from './useSettings'

/** Which of the numbers features are switched on. Everything is on until settings have loaded. */
export function useNumbers() {
  const abilities = useSettings(s => s.settings.numbers_abilities)
  const stats = useSettings(s => s.settings.numbers_stats)
  const winRate = useSettings(s => s.settings.numbers_win_rate)
  return { abilities, stats, winRate }
}
