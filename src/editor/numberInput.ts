// What a number box does with what is typed into it. Kept apart from the component so the rules can be tested.

/** Text that could still become a number: digits, one point, a leading minus. An empty box and a lone "-" count, since they are on the way to one. */
export function isNumberDraft(text: string): boolean {
  return /^-?\d*\.?\d*$/.test(text)
}

/** The number a draft stands for. Nothing typed yet (or only a "-" or ".") is 0, which is what an empty box means. */
export function draftValue(text: string): number {
  const n = parseFloat(text)
  return Number.isFinite(n) ? n : 0
}

/** How a stored number reads in a box that isn't being typed in. Zero is left empty, so the box shows its faint "0" and typing replaces it instead of following it. */
export function displayNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value === 0) return ''
  return String(Math.round(value * 1e4) / 1e4)
}
