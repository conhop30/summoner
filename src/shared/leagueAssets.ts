// Lane and class icons come from League of Legends itself. They are not bundled with Summoner:
// they are loaded from Community Dragon, the community mirror of the game client's files, the way
// item art already loads from Data Dragon. Offline, or if a file ever moves, the caller shows the
// name alone.

const BASE = 'https://raw.communitydragon.org/latest/plugins'

type Lane = 'top' | 'jungle' | 'middle' | 'bottom' | 'utility'
const CLASSES = ['assassin', 'fighter', 'mage', 'marksman', 'support', 'tank']

// What a champion's role may be called, and the lane the game calls it.
const LANE_BY_NAME: Record<string, Lane> = {
  top: 'top', jungle: 'jungle', mid: 'middle', middle: 'middle', bot: 'bottom', bottom: 'bottom', adc: 'bottom', support: 'utility', utility: 'utility',
}

export function laneIconUrl(role: string): string | null {
  const lane = LANE_BY_NAME[role.trim().toLowerCase()]
  return lane ? `${BASE}/rcp-fe-lol-static-assets/global/default/svg/position-${lane}.svg` : null
}

export function classIconUrl(className: string): string | null {
  const name = className.trim().toLowerCase()
  return CLASSES.includes(name) ? `${BASE}/rcp-fe-lol-champion-details/global/default/role-icon-${name}.png` : null
}
