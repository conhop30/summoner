import { defineConfig } from 'vitest/config'

// Pure-logic tests, run under plain Node (`npm test`). Deliberately separate from vite.config.ts,
// which loads the Electron plugins. Tests that need the real SQLite driver are *.db.test.ts and
// run under Electron's own Node instead — see vitest.db.config.ts.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.db.test.ts', 'node_modules/**'],
    environment: 'node',
  },
})
