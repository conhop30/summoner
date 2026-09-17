import { createRequire } from 'node:module'
//import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { app } from 'electron'
import { initializeSchema } from './schema'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

let db: any | null = null

export function getDb(): any {
  if (db) return db

  const dbPath = path.join(app.getPath('userData'), 'summoner.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initializeSchema(db)

  return db
}