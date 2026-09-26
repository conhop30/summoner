import type { Effect } from './types'
import { defaultTokenName, effectKind, takesDuration } from './effects'
import { outcomeOf, tagIcon, tagLabel, type Outcome, type Tone } from './outcomes'
import type { StatIconKey } from './statIcons'
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
    if (names[i] === undefined) names[i] = claim(defaultTokenName(effect))
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

// An effect that lasts a while has a second token: its name with " duration" after it, so
// {Armor} is the amount and {Armor duration} is how long it lasts.
const DURATION_SUFFIX = ' duration'

/** The duration of an effect as a sentence would say it: "4 s" or "3/3.5/4 s". Empty when none is filled in. */
export function durationPhrase(effect: Effect): string {
  const values = effect.duration ?? []
  return values.some(v => v) ? rankList(values) + unitAfter('seconds') : ''
}

/** For a token that reads "<name> duration", the normalized name in front; otherwise null. */
function durationBase(raw: string): string | null {
  const key = normalize(raw)
  return key.endsWith(DURATION_SUFFIX) ? key.slice(0, -DURATION_SUFFIX.length).trim() : null
}

/** Everything the "Insert value" list offers: each effect's amount, and the duration of those that have one. */
export function tokenChoices(effects: Effect[] | undefined): { token: string; phrase: string }[] {
  const list = effects ?? []
  const names = effectTokenNames(list)
  const choices: { token: string; phrase: string }[] = []
  list.forEach((effect, i) => {
    choices.push({ token: names[i], phrase: effectPhrase(effect) || '(no numbers yet)' })
    if (takesDuration(effect)) choices.push({ token: names[i] + DURATION_SUFFIX, phrase: durationPhrase(effect) || '(no duration yet)' })
  })
  return choices
}

/** True if the text has anything that looks like a token. */
export function hasTokens(text: string | undefined): boolean {
  return !!text && /\{[^{}]+\}/.test(text)
}

/** A run of description text. `tone` is set on words that name a kind of damage, so they can be coloured. */
export interface Segment {
  text: string
  tone?: Tone
  /** Set on the name of an effect written in place of its numbers: "magic damage", with its icon. */
  tag?: { icon?: StatIconKey }
}

/**
 * If the text after a token already says the noun of the effect ("magic damage", or just "damage"),
 * how much of it that is: the leading space, the words, and the tone they name. A damage effect
 * accepts any damage wording, so "{Damage} magic damage" is left alone even when the effect is
 * physical: what was written wins, and it is coloured for what it says.
 */
function nounAfter(rest: string, outcome: Outcome, label?: string): { lead: string; words: string; tone?: Tone } | null {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const damage = outcome.kind === 'damage'
  const pattern = damage ? '(?:(physical|magic|true) )?damage' : escape(label ?? outcome.noun!)
  const found = new RegExp(`^(\\s*)(${pattern})(?![a-z])`, 'i').exec(rest)
  if (!found) return null
  const written = damage ? (found[3]?.toLowerCase() as Tone | undefined) : undefined
  return { lead: found[1], words: found[2], tone: written ?? outcome.tone }
}

/**
 * The description as runs of text, with every token replaced by its number. After the amount of an
 * effect that has a noun (a damage effect: "magic damage") the noun is written in, unless the text
 * already says it, and either way it carries a tone. A token that names no effect, or an effect with
 * no numbers yet, stays as written.
 */
export function resolveSegments(text: string | undefined, effects: Effect[] | undefined, options: { tags?: boolean } = {}): Segment[] {
  if (!text) return []
  if (!hasTokens(text)) return [{ text }]
  const list = effects ?? []
  const names = effectTokenNames(list)
  const out: Segment[] = []
  const push = (segment: Segment) => {
    if (!segment.text) return
    const previous = out[out.length - 1]
    if (previous && previous.tone === segment.tone && !previous.tag && !segment.tag) previous.text += segment.text
    else out.push({ ...segment })
  }

  let cursor = 0
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index!
    if (start < cursor) continue
    const raw = match[1]
    let phrase = ''
    let amountOf: Effect | undefined
    let durationOf: Effect | undefined
    const index = names.findIndex(n => normalize(n) === normalize(raw))
    if (index !== -1) {
      phrase = effectPhrase(list[index])
      amountOf = list[index]
    } else {
      const base = durationBase(raw)
      const lasting = base === null ? -1 : names.findIndex(n => normalize(n) === base)
      if (lasting !== -1) {
        phrase = durationPhrase(list[lasting])
        durationOf = list[lasting]
      }
    }
    // In tag mode a duration is written as "duration", whether or not one is filled in: its length is in the rows beneath.
    if (options.tags && durationOf) {
      push({ text: text.slice(cursor, start) })
      push({ text: 'duration', tag: {} })
      cursor = start + match[0].length
      continue
    }
    // In tag mode an effect's amount is written as what it is, and needs no numbers to be.
    const asTag = !!options.tags && !!amountOf
    if (!phrase && !asTag) continue

    push({ text: text.slice(cursor, start) })
    if (asTag && amountOf) {
      cursor = start + match[0].length
      const label = tagLabel(amountOf)
      const outcome = outcomeOf(amountOf)
      // What was written after the token already names it, so it stands in for the tag: nothing is said twice.
      const said = nounAfter(text.slice(cursor), outcome, label)
      if (said) {
        // The space before the words was already there, in front of the token.
        push({ text: said.words, tone: said.tone, tag: { icon: tagIcon(amountOf) } })
        cursor += said.lead.length + said.words.length
      } else {
        push({ text: label, tone: outcome.tone, tag: { icon: tagIcon(amountOf) } })
      }
      continue
    }
    push({ text: phrase })
    cursor = start + match[0].length
    const outcome = amountOf ? outcomeOf(amountOf) : undefined
    if (outcome?.noun) {
      const said = nounAfter(text.slice(cursor), outcome)
      if (said) {
        push({ text: said.lead })
        push({ text: said.words, tone: said.tone })
        cursor += said.lead.length + said.words.length
      } else {
        push({ text: ' ' })
        push({ text: outcome.noun, tone: outcome.tone })
      }
    }
  }
  push({ text: text.slice(cursor) })
  return out
}

/** The description with every token replaced by its number, and the noun after an amount written in where it was left out. */
export function resolveTokens(text: string | undefined, effects: Effect[] | undefined): string {
  return resolveSegments(text, effects).map(s => s.text).join('')
}

/** Names used as tokens in the text that no effect answers to. */
export function unknownTokens(text: string | undefined, effects: Effect[] | undefined): string[] {
  if (!text) return []
  const names = effectTokenNames(effects).map(normalize)
  const known = new Set([...names, ...names.map(n => n + DURATION_SUFFIX)])
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
    if (to !== undefined) return `{${to}}`
    const base = durationBase(raw)
    const baseTo = base === null ? undefined : byOld.get(base)
    return baseTo === undefined ? whole : `{${baseTo}${DURATION_SUFFIX}}`
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
