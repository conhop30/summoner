export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function defaultAbilities() {
  return {
    passive: { max_rank: 5 },
    q: { max_rank: 5 },
    w: { max_rank: 5 },
    e: { max_rank: 5 },
    r: { max_rank: 3 },
  }
}

export function defaultBaseStats() {
  return {
    attack_range: [0],
    crit_damage_multiplier: 1.75,
  }
}