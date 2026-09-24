import type { ImportStatus } from './exchange'
import type { Scope } from '../interchange/types'

// What the import dialog needs to know, sent from the main process. Never includes image data.
export interface PlanItem {
  id: string
  name: string
  status: ImportStatus
  incomingAt: string
  localAt?: string
}

export interface ImportPlanSummary {
  ok: true
  planId: string
  fileName: string
  scope: Scope
  items: PlanItem[]
  warnings: string[]
}

export type ImportPlanResult = ImportPlanSummary | { ok: false; error: string }

export type ImportApplyResult =
  | { ok: true; added: number; updated: number; copies: number; skipped: number }
  | { ok: false; error: string }
