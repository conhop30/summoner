// Runs the database tests under Electron's Node, where better-sqlite3 (built for Electron) loads.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const electron = require('electron') // the path to the electron binary
const vitest = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')

const result = spawnSync(electron, [vitest, 'run', '--config', 'vitest.db.config.ts', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
})
process.exit(result.status ?? 1)
