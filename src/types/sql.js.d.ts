/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'sql.js' {
  export interface Statement {
    bind(params?: any[] | Record<string, any>): void
    step(): boolean
    get(): any[]
    getColumnNames(): string[]
    reset(): void
    changes: number
    lastInsertRowid: number
    all(params?: any[] | Record<string, any>): any[]
    get(params?: any[] | Record<string, any>): any
    run(params?: any[] | Record<string, any>): { changes: number; lastInsertRowid: number }
  }

  export interface Database {
    exec(sql: string): void
    prepare(sql: string): Statement
    close(): void
    export(): Uint8Array
  }

  export function initSqlJs(opts?: { locateFile?: (file: string) => string }): Promise<{ Database: new (buffer?: Uint8Array | null) => Database }>
  export const Database: new (buffer?: Uint8Array | null) => Database
  export default initSqlJs
}
