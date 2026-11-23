/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'better-sqlite3' {
  export interface Statement {
    bind(params?: unknown[]): void
    all(params?: unknown[]): unknown[]
    get(params?: unknown[]): unknown
    run(params?: unknown[]): { changes: number; lastInsertRowid: number }
    defaults: { safeIntegers: boolean }
  }

  export interface Database {
    prepare(sql: string): Statement
    exec(sql: string): void
    close(): void
    transaction(fn: () => void): () => void
    readonly readonly: boolean
  }

  export default function (filename: string, opts?: { readonly?: boolean }): Database
  export = betterSqlite3
  function betterSqlite3(filename: string, opts?: { readonly?: boolean }): Database
}
