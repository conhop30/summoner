import type { Effect, RatioEntry } from './types'

// An effect's amount is one list of parts: an optional flat number per rank ("40/65/90") followed by
// any number of scalers ("45% AP", "20% bonus armor", "1% per 80 AD"). The editor shows them as one
// list. On disk the flat part stays `base` and the scalers stay `ratios`, so nothing already saved,
// exported or read by the phone app has to change; these helpers are the only place that knows how
// the two views map onto each other.

/** True when the effect has a flat part to show. An effect with no parts at all still shows one to type into. */
export function hasFlatPart(effect: Pick<Effect, 'base' | 'ratios'>): boolean {
  return effect.base !== undefined || (effect.ratios ?? []).length === 0
}

/** Adds a scaler. An effect that had no parts keeps its (empty) flat part, so the new row sits below it instead of replacing it. */
export function addStatPart(effect: Effect, ratio: RatioEntry): Effect {
  return { ...effect, base: effect.base ?? [], ratios: [...(effect.ratios ?? []), ratio] }
}

/** The flat part becomes a scaler on `stat`, carrying its numbers along for the user to adjust. */
export function flatToStat(effect: Effect, stat: string, maxRank: number): Effect {
  const values = Array.from({ length: maxRank }, (_, i) => effect.base?.[i] ?? 0)
  const ratio: RatioEntry = { stat, part: 'total', values }
  return { ...effect, base: undefined, ratios: [...(effect.ratios ?? []), ratio] }
}

/** A scaler becomes the flat part. Only possible while there isn't one already; otherwise the effect is returned as it was. */
export function statToFlat(effect: Effect, ratioIndex: number): Effect {
  const ratio = (effect.ratios ?? [])[ratioIndex]
  if (!ratio || hasFlatPart(effect)) return effect
  return { ...effect, base: [...ratio.values], ratios: (effect.ratios ?? []).filter((_, i) => i !== ratioIndex) }
}

/** Drops the flat part. The next time the effect is opened with nothing else in it, an empty one is offered again. */
export function removeFlatPart(effect: Effect): Effect {
  return { ...effect, base: undefined }
}
