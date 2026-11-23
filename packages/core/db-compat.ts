/**
 * SQLite compatibility wrapper for sql.js.
 *
 * Wraps a sql.js Database object to provide a better-sqlite3-compatible API:
 *   - db.prepare(sql) returns a statement with .all(params), .get(params), .run(params)
 *   - .all() returns array of row objects
 *   - .get() returns a single row object or undefined
 *   - .run() returns { changes, lastInsertRowid }
 */

import type { Database as SqlJsNativeDatabase } from 'sql.js'

export interface PreparedStatement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  all(...args: unknown[]): any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(...args: unknown[]): any
  run(...args: unknown[]): { changes: number; lastInsertRowid: number }
  bind: (...args: unknown[]) => void
  step: () => boolean
  getColumnNames: () => string[]
  reset: () => void
  changes: number
  lastInsertRowid: number
}

export interface SqlJsDatabase {
  prepare(sql: string): PreparedStatement
  exec(sql: string): void
  transaction(fn: () => void): () => void
  export(): Uint8Array
  close(): void
}

export function wrapDb (db: SqlJsNativeDatabase): SqlJsDatabase {
  const origPrepare = db.prepare.bind(db)
  db.prepare = function (sql: string) {
    const stmt = origPrepare(sql)
    const bindParams = (args: unknown[]): void => {
      if (args.length === 0) return
      if (Array.isArray(args[0])) {
        stmt.bind(args[0] as unknown[])
      } else if (typeof args[0] === 'object' && args[0] !== null) {
        stmt.bind(args[0])
      } else {
        stmt.bind(args)
      }
    }
    const stmtGet = stmt.get.bind(stmt)
    const wrapped = {
      bind: stmt.bind.bind(stmt),
      step: stmt.step.bind(stmt),
      getColumnNames: stmt.getColumnNames.bind(stmt),
      reset: stmt.reset.bind(stmt),
      changes: stmt.changes,
      lastInsertRowid: stmt.lastInsertRowid,
      all: function (...args: unknown[]): Record<string, unknown>[] {
        const rows: Record<string, unknown>[] = []
        bindParams(args)
        while (this.step()) {
          const rowArr = stmtGet()
          const row: Record<string, unknown> = {}
          this.getColumnNames().forEach((col, i) => {
            row[col] = rowArr[i]
          })
          rows.push(row)
        }
        this.reset()
        return rows
      },
      get: function (...args: unknown[]): Record<string, unknown> | undefined {
        bindParams(args)
        let row: Record<string, unknown> | undefined
        if (this.step()) {
          const rowArr = stmtGet()
          row = {}
          this.getColumnNames().forEach((col, i) => {
            row![col] = rowArr[i]
          })
        }
        this.reset()
        return row
      },
      run: function (...args: unknown[]): { changes: number; lastInsertRowid: number } {
        bindParams(args)
        this.step()
        const info = {
          changes: this.changes || 0,
          lastInsertRowid: this.lastInsertRowid || 0
        }
        this.reset()
        return info
      }
    }
    return wrapped
  } as unknown as (sql: string) => PreparedStatement

  // sql.js doesn't have db.transaction(); implement with BEGIN/COMMIT
  ;(db as unknown as { transaction: (fn: () => void) => () => void }).transaction = function (fn: () => void): () => void {
    return function (): void {
      db.exec('BEGIN')
      try {
        const result = fn()
        db.exec('COMMIT')
        return result
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    }
  }

  return db as unknown as SqlJsDatabase
}
