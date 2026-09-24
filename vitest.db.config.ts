import { defineConfig } from 'vitest/config'

// Database tests (`npm run test:db`). better-sqlite3 is compiled for Electron's ABI, so it cannot
// load under a normal Node. scripts/run-db-tests.mjs runs vitest with Electron's bundled Node
// (ELECTRON_RUN_AS_NODE), which can — the same driver and SQL the app itself uses, in memory.
export default defineConfig({
  test: {
    include: ['src/**/*.db.test.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
