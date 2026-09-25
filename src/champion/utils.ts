export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Blocks saved before they had ids get a stable, position-based one. New blocks are given a random id
// when they are created, so this only ever fills in old data.
export function blockFallbackId(slot: string, index: number): string {
  return `legacy-${slot}-${index + 1}`
}

// Returns the abilities with an id on every block. Untouched (same object) when nothing needs one.
export function ensureBlockIds<T extends Record<string, { blocks?: { id?: string }[] }>>(abilities: T): T {
  let changed = false
  const out: Record<string, unknown> = { ...abilities }
  for (const [slot, ability] of Object.entries(abilities)) {
    if (!ability.blocks || ability.blocks.every(b => b.id)) continue
    changed = true
    out[slot] = { ...ability, blocks: ability.blocks.map((b, i) => (b.id ? b : { ...b, id: blockFallbackId(slot, i) })) }
  }
  return changed ? (out as T) : abilities
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