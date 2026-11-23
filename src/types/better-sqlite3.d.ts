declare module 'better-sqlite3' {
  export interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): void;
    close(): void;
    transaction(fn: () => void): () => void;
    readonly readonly: boolean;
  }

  export interface Statement {
    bind(params?: any[]): void;
    all(params?: any[]): any[];
    get(params?: any[]): any;
    run(params?: any[]): { changes: number; lastInsertRowid: number };
    defaults: { safeIntegers: boolean };
  }

  export default function (filename: string, opts?: { readonly?: boolean }): Database;
  export = betterSqlite3;
  function betterSqlite3(filename: string, opts?: { readonly?: boolean }): Database;
}
