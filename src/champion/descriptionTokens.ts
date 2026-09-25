import type { Effect } from './types'
import { effectKind, effectName } from './effects'
import { describeRatio, rankList, unitAfter } from './ratios'

// Description tokens. An ability's description can say `{Damage}` where a number belongs, and the
// number is filled in from the effect of that name: "Rip his sword through the ground, dealing
// {Damage} physical damage" becomes "...dealing 40/65/90 (+45% AP) physical damage". The effects
// stay the one place a number is written, and the sentence can never drift away from it.
//
// A token names an effect in the same ability or block. An effect's name is what the user gave it,
// or else its type ("Damage"), with " 2", " 3" added where two would collide. Everything here is
// pure text handling, so the same rules serve the editor, the View page, the poster and export.

const TOKEN = /\{([^{}]+)\}/g

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * The name each effect answers to in a description, in order and all different. Names the user
 * chose are honoured first; an effect with none takes its type's name, numbered if it would repeat.
 */
export function effectTokenNames(effects: Effect[] | undefined): string[] {
  const list = effects ?? []
  const taken = new Set<string>()
  const names: (string | undefined)[] = list.map(() => undefined)

  function claim(base: string): string {
    let candidate = base
    for (let n = 2; taken.has(normalize(candidate)); n++) candidate = `${base} ${n}`
    taken.add(normalize(candidate))
    return candidate
  }

  list.forEach((effect, i) => {
    const chosen = effect.name?.replace(/\s+/g, ' ').trim()
    if (chosen) names[i] = claim(chosen)
  })
  list.forEach((effect, i) => {
    if (names[i] === undefined) names[i] = claim(effectName(effect.type))
  })
  return names as string[]
}

/**
 * The number an effect stands for, written the way an ability tooltip would: "40/65/90 (+45% AP)".
 * Its unit is included ("1.5 s", "20%") so the sentence doesn't need to repeat it. Empty when the
 * effect has no numbers yet.
 */
export function effectPhrase(effect: Effect): string {
  const { unit } = effectKind(effect)
  const parts: string[] = []
  const base = effect.base ?? []
  if (base.some(v => v)) parts.push(rankList(base) + unitAfter(unit))
  for (const ratio of effect.ratios ?? []) {
    const text = describeRatio(ratio, unit)
    if (text) parts.push(text)
  }
  if (parts.length === 0) return ''
  return parts.length === 1 ? parts[0] : `${parts[0]} (+${parts.slice(1).join(', +')})`
}

/** True if the text has anything that looks like a token. */
export function hasTokens(text: string | undefined): boolean {
  return !!text && /\{[^{}]+\}/.test(text)
}

/** The description with every token replaced by its number. A token that names no effect, or an effect with no numbers yet, stays as written. */
export function resolveTokens(text: string | undefined, effects: Effect[] | undefined): string {
  if (!text) return ''
  if (!hasTokens(text)) return text
  const list = effects ?? []
  const names = effectTokenNames(list)
  return text.replace(TOKEN, (whole, raw: string) => {
    const index = names.findIndex(n => normalize(n) === normalize(raw))
    if (index === -1) return whole
    return effectPhrase(list[index]) || whole
  })
}

/** Names used as tokens in the text that no effect answers to. */
export function unknownTokens(text: string | undefined, effects: Effect[] | undefined): string[] {
  if (!text) return []
  const known = new Set(effectTokenNames(effects).map(normalize))
  const seen = new Set<string>()
  const unknown: string[] = []
  for (const match of text.matchAll(TOKEN)) {
    const key = normalize(match[1])
    if (!known.has(key) && !seen.has(key)) {
      seen.add(key)
      unknown.push(match[1].trim())
    }
  }
  return unknown
}

/**
 * Rewrites the tokens for effects whose names changed, all at once so a swap works. Each pair is
 * [old name, new name]; tokens for names that aren't in the list are left alone.
 */
export function retargetTokens(text: string | undefined, renames: [string, string][]): string | undefined {
  if (!text || !hasTokens(text) || renames.length === 0) return text
  const byOld = new Map(renames.map(([from, to]) => [normalize(from), to]))
  return text.replace(TOKEN, (whole, raw: string) => {
    const to = byOld.get(normalize(raw))
    return to === undefined ? whole : `{${to}}`
  })
}

/**
 * The renames that follow from changing an effect list, for retargetTokens. Effects are matched by
 * position; when one was removed pass its index, and its own token is left alone (it now names
 * nothing) while the effects after it keep theirs.
 */
export function renamesBetween(before: Effect[] | undefined, after: Effect[] | undefined, removedIndex?: number): [string, string][] {
  const oldNames = effectTokenNames(before)
  const newNames = effectTokenNames(after)
  const renames: [string, string][] = []
  oldNames.forEach((from, i) => {
    if (i === removedIndex) return
    const to = newNames[removedIndex !== undefined && i > removedIndex ? i - 1 : i]
    if (to !== undefined && to !== from) renames.push([from, to])
  })
  return renames
}

/** The text with `insertion` put at the caret (or replacing the selection), and where the caret should land. */
export function insertAtCaret(text: string, start: number, end: number, insertion: string): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length))
  const to = Math.max(from, Math.min(end, text.length))
  return { text: text.slice(0, from) + insertion + text.slice(to), caret: from + insertion.length }
}

/**
 * The description to keep when a file brings one in. A description's tokens are replaced by their
 * numbers when it leaves the app, so what comes back is plain text. If that text is exactly what
 * the tokens here would produce, nothing was edited elsewhere and the tokens are kept; if it
 * differs, it was edited, and the new text wins.
 */
export function keepTokens(incoming: string | undefined, current: string | undefined, currentEffects: Effect[] | undefined): string | undefined {
  if (!incoming || !current || !hasTokens(current)) return incoming
  return resolveTokens(current, currentEffects) === incoming ? current : incoming
}

/** Same idea for a file that carries its own token template: use it if it produces exactly the text the file says. */
export function adoptTemplate(description: string | undefined, template: string | undefined, effects: Effect[] | undefined): string | undefined {
  if (!description || !template || !hasTokens(template)) return description
  return resolveTokens(template, effects) === description ? template : description
}
