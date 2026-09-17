import type {
  Champion,
  Identity,
  BaseStats,
  ChampionClass,
  ChampionRole,
  AttackType,
} from './types';

// ─── Identity Disclosure ─────────────────────────────────────────────────────

export function setClass(
  identity: Identity,
  value: ChampionClass
): Identity {
  const current = identity.class ?? [];
  if (current.includes(value)) return identity;
  return { ...identity, class: [...current, value] };
}

export function removeClass(
  identity: Identity,
  value: ChampionClass
): Identity {
  const updated = (identity.class ?? []).filter((c) => c !== value);
  return { ...identity, class: updated.length > 0 ? updated : undefined };
}

export function setRole(
  identity: Identity,
  value: ChampionRole
): Identity {
  const current = identity.role ?? [];
  if (current.includes(value)) return identity;
  return { ...identity, role: [...current, value] };
}

export function removeRole(
  identity: Identity,
  value: ChampionRole
): Identity {
  const updated = (identity.role ?? []).filter((r) => r !== value);
  return { ...identity, role: updated.length > 0 ? updated : undefined };
}

export function setAttackType(
  identity: Identity,
  value: AttackType
): Identity {
  const current = identity.attack_type ?? [];
  if (current.includes(value)) return identity;
  return { ...identity, attack_type: [...current, value] };
}

export function removeAttackType(
  identity: Identity,
  value: AttackType
): Identity {
  const updated = (identity.attack_type ?? []).filter((a) => a !== value);
  return { ...identity, attack_type: updated.length > 0 ? updated : undefined };
}

// ─── Base Stats Disclosure ───────────────────────────────────────────────────

export function setAttackRange(
  base_stats: BaseStats,
  values: number[]
): BaseStats {
  return { ...base_stats, attack_range: values };
}

export function addAttackRange(
  base_stats: BaseStats,
  value: number
): BaseStats {
  const current = base_stats.attack_range ?? [0];
  if (current.includes(value)) return base_stats;
  return { ...base_stats, attack_range: [...current, value] };
}

export function removeAttackRange(
  base_stats: BaseStats,
  value: number
): BaseStats {
  const updated = (base_stats.attack_range ?? []).filter((r) => r !== value);
  return {
    ...base_stats,
    attack_range: updated.length > 0 ? updated : [0],
  };
}

// ─── Ability Rank Array Management ───────────────────────────────────────────

// Ensures a per-rank array matches the ability's max_rank length.
// Pads with the last value or trims as needed.
export function normalizeRankArray(
  values: number[],
  max_rank: number
): number[] {
  if (values.length === max_rank) return values;

  if (values.length < max_rank) {
    const last = values[values.length - 1] ?? 0;
    return [...values, ...Array(max_rank - values.length).fill(last)];
  }

  return values.slice(0, max_rank);
}

// ─── Champion-Level Helpers ──────────────────────────────────────────────────

export function toggleFavorite(champion: Champion): Champion {
  return {
    ...champion,
    metadata: {
      ...champion.metadata,
      is_favorite: !champion.metadata.is_favorite,
    },
  };
}

export function addTag(champion: Champion, tag: string): Champion {
  if (champion.metadata.tags.includes(tag)) return champion;
  return {
    ...champion,
    metadata: {
      ...champion.metadata,
      tags: [...champion.metadata.tags, tag],
    },
  };
}

export function removeTag(champion: Champion, tag: string): Champion {
  return {
    ...champion,
    metadata: {
      ...champion.metadata,
      tags: champion.metadata.tags.filter((t) => t !== tag),
    },
  };
}