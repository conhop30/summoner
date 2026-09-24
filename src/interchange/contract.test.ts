// Runs the parser against every fixture in contract/fixtures and checks it against
// contract/expectations.json. Summoner Mobile runs this same file with the same fixtures.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseInterchangeText } from './sanitize'

interface Expectation {
  ok: boolean
  error?: string
  scope?: string
  version?: number
  records?: number
  warnings?: number
  warningsContain?: string[]
  checks?: Record<string, unknown>
  absent?: string[]
  counts?: Record<string, number>
  noPollution?: boolean
  mobile?: { absent?: string[]; checks?: Record<string, unknown> }
}

const root = join(process.cwd(), 'contract')
const expectations = JSON.parse(readFileSync(join(root, 'expectations.json'), 'utf-8')) as Record<string, Expectation>
const fixtureNames = Object.keys(expectations).filter(k => !k.startsWith('_'))

function at(target: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || value === undefined || typeof value !== 'object') return undefined
    // Own properties only, so 'constructor' on a plain object doesn't count as present.
    return Object.prototype.hasOwnProperty.call(value, key) ? (value as Record<string, unknown>)[key] : undefined
  }, target)
}

function load(name: string, options?: { includeDesktop?: boolean }) {
  return parseInterchangeText(readFileSync(join(root, 'fixtures', name), 'utf-8'), options)
}

describe('contract fixtures', () => {
  for (const name of fixtureNames) {
    const expected = expectations[name]

    it(name, () => {
      const result = load(name)
      expect(result.ok).toBe(expected.ok)
      if (!result.ok) {
        expect(result.error).toContain(expected.error)
        return
      }
      const { file } = result
      expect(file.scope).toBe(expected.scope)
      expect(file.version).toBe(expected.version)
      expect(file.records).toHaveLength(expected.records!)
      expect(file.warnings).toHaveLength(expected.warnings ?? 0)
      for (const fragment of expected.warningsContain ?? []) {
        expect(file.warnings.some(w => w.includes(fragment)), `warning containing "${fragment}"`).toBe(true)
      }
      for (const [path, value] of Object.entries(expected.checks ?? {})) {
        expect(at(file, path), path).toEqual(value)
      }
      for (const path of expected.absent ?? []) {
        expect(at(file, path), `${path} should be absent`).toBeUndefined()
      }
      for (const [path, count] of Object.entries(expected.counts ?? {})) {
        expect((at(file, path) as unknown[]).length, path).toBe(count)
      }
      if (expected.noPollution) {
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
        expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false)
      }
    })

    if (expected.mobile) {
      it(`${name} (mobile: desktop section dropped)`, () => {
        const result = load(name, { includeDesktop: false })
        expect(result.ok).toBe(true)
        if (!result.ok) return
        for (const path of expected.mobile!.absent ?? []) expect(at(result.file, path)).toBeUndefined()
        for (const [path, value] of Object.entries(expected.mobile!.checks ?? {})) expect(at(result.file, path)).toEqual(value)
      })
    }
  }

  it('has an expectation for every fixture file and vice versa', async () => {
    const { readdirSync } = await import('node:fs')
    const files = readdirSync(join(root, 'fixtures')).sort()
    expect(files).toEqual([...fixtureNames].sort())
  })
})
