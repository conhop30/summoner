import { describe, it, expect } from 'vitest'
import { displayNumber, draftValue, isNumberDraft } from './numberInput'

describe('what a number box accepts', () => {
  it('lets a number be typed one keystroke at a time', () => {
    for (const text of ['', '-', '.', '4', '45', '4.', '4.5', '-0.5', '.5']) expect(isNumberDraft(text)).toBe(true)
  })

  it('turns down letters and second points', () => {
    for (const text of ['a', '4a', '4..5', '4.5.6', '--4', '1e3', '4,5', ' 4']) expect(isNumberDraft(text)).toBe(false)
  })
})

describe('the number a draft stands for', () => {
  it('reads what is typed, and treats an empty box as 0', () => {
    expect(draftValue('45')).toBe(45)
    expect(draftValue('4.')).toBe(4)
    expect(draftValue('-2.5')).toBe(-2.5)
    expect(draftValue('')).toBe(0)
    expect(draftValue('-')).toBe(0)
    expect(draftValue('.')).toBe(0)
  })
})

describe('what a resting box shows', () => {
  it('leaves zero and nothing empty, so the placeholder shows and typing replaces it', () => {
    expect(displayNumber(0)).toBe('')
    expect(displayNumber(undefined)).toBe('')
  })

  it('trims floating-point crumbs', () => {
    expect(displayNumber(45.00000000000001)).toBe('45')
    expect(displayNumber(0.175)).toBe('0.175')
    expect(displayNumber(-3)).toBe('-3')
  })
})
