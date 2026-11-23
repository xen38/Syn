import type { Database as SqlJsDatabase } from 'sql.js'

export interface PreparedStatement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  all(...args: any[]): Record<string, unknown>[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(...args: any[]): Record<string, unknown> | undefined
  run(...args: unknown[]): { changes: number; lastInsertRowid: number }
}

export function wrapDb(db: SqlJsDatabase): SqlJsDatabase
