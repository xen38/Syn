**#Syn: 100% Native TypeScript Migration Guide !! Be Updating This Document to show the State of the Development**  
**Before each change comit the changes and look at the github repo to delete the old not-migrated version of the comited files on the repo to prevent duplicates **  


**Project:** xen38/Syn (locally at `K:\Repos\locate`)

**Goal:** Migrate Syn from 100% plain JavaScript (CommonJS) to a 100% native TypeScript application.

**Audience:** Agents and human reviewers executing and reviewing the migration. Nothing gets lost.

---

**## 1. Purpose and Scope**

Syn is an Electron desktop app (main process + preload bridge + renderer UI), an MCP server (stdio), a core indexing engine `packages/core/index.js`), 12 harness adapters `packages/adapters/`), brainmaxxing commands `packages/core/brainmaxxing.js`), CSS/HTML UI `renderer/`), and ~13 fixture-based test suites `test/`).

This guide converts every `.js` source file to `.ts`, configures `tsc`, adapts `package.json` scripts, adds type declarations where modules lack them, and preserves all runtime behavior so that:

- `npm test` passes identically before and after migration (same assertions, same fixtures).
- `npm run lint` (ESLint) passes on `.ts` files.
- `electron .` launches and behaves identically.
- `node mcp-server.js` (or its TS equivalent) starts and lists the same 16 tools.
- No feature, command, IPC channel, MCP tool, or test is dropped.

Out of scope for this migration: changing runtime behavior, adding new features, or switching test runners. This is a behavior-preserving port to TypeScript.

---

**## 2. Inventory of Files to Convert**

**### Root (Electron main / preload / scripts)**

| File | Purpose |

|------|---------|

| `main.js` | Electron main process: window lifecycle, IPC handlers, engine |

| `preload.js` | contextBridge `synAPI` exposed to renderer |

| `bootstrap.js` | Electron module loading patch |

| `wrapper.js` | Electron module resolution patch |

| `reindex.js` | Standalone re-index CLI |

| `check_codex_sessions.js` | Diagnostic SQLite inspector |

**### packages/core (indexing engine + brainmaxxing)**

| File | Purpose |

|------|---------|

| `packages/core/index.js` | IndexingEngine: schema, indexing, search, BM25, sessions |

| `packages/core/db-compat.js` | sql.js -> better-sqlite3 API wrapper |

| `packages/core/brainmaxxing.js` | /reflect /meditate /ruminate /plan /review /brain* + containment |

**### packages/adapters (12 harness parsers)**

| File | Purpose |

|------|---------|

| `packages/adapters/base.js` | BaseAdapter class |

| `packages/adapters/registry.js` | AdapterRegistry + per-harness validators + detectHarness |

| `packages/adapters/claude-code.js` | Claude Code JSONL adapter |

| `packages/adapters/codex.js` | Codex SQLite + archived JSONL adapter |

| `packages/adapters/json.js` | JSON session adapter |

| `packages/adapters/jsonl.js` | JSONL/NDJSON adapter |

| `packages/adapters/opencode.js` | OpenCode better-sqlite3 adapter |

| `packages/adapters/sqlite.js` | SQLite session / Copilot / T3 adapter |

| `packages/adapters/text.js` | Markdown/Text paragraph adapter |

**### Renderer UI**

| File | Purpose |

|------|---------|

| `renderer/app.js` | Terminal, search, session list, brainmaxxing UI, context menus |

| `renderer/index.html` | Main window HTML |

| `renderer/brain-vault.html` | Brain Vault window HTML |

| `renderer/brain-vault.js` | Graph view, note tabs, edit/save/rename/delete, imports |

| `renderer/style.css` | All styling (stays `.css`; not converted) |

**### MCP server**

| File | Purpose |

|------|---------|

| `mcp-server.js` | stdio MCP server with 16 `syn_*` tools |

**### Tests (must keep passing, file-for-file behavior)**

| File | Purpose |

|------|---------|

| `test/search.test.js` | Simple in-memory search simulation |

| `test/search-quality.test.js` | BM25 ranking + snippets + filters |

| `test/validator-precision.test.js` | Adapter validator precision |

| `test/fixture-tests.js` | 47 fixture-based adapter/incremental tests |

| `test/indexing.test.js` | Fixture-based indexing engine tests |

| `test/security.test.js` | Redaction + exclusions |

| `test/brainmaxxing.test.js` | Containment + brain round-trips + commands |

| `test/session-delete.test.js` | Index-only deletion (no disk writes) |

| `test/g3-filter-forwarding.test.js` | Terminal filter forwarding parity |

| `test/mcp.test.js` | MCP server coverage |

| `test/real-world-integration.test.js` | Real user data (opt-in / env-dependent) |

| `test/harness-test.js` | Harness tests |

**### Config / docs / skills**

| File | Notes |

|------|-------|

| `package.json` | Scripts, deps, build config — updated for TS |

| `tsconfig.json` | To be created |

| `.eslintrc.json` | Extended to lint `.ts` |

| `skills/`, `.agents/skills/` | Documentation only (no code change) |

---

**## 3. Migration Strategy (Behavior-Preserving)**

The migration is done file-by-file with these rules:

1. **Rename** `.js` **->** `.ts` and convert syntax to TypeScript.
2. **Add explicit types** for function params, returns, class fields, and module exports using JSDoc-style inline types or TS interfaces/types.
3. **Preserve CommonJS** `requiremodule.exports` where the runtime needs it (Electron main, preload, MCP server, adapters). TS compiles CommonJS by default with `module: commonjs`.
4. **Do not change runtime behavior** — same IPC channel names, same MCP tool names/schemas, same search ranking, same test assertions.
5. **Every converted file must pass** `node --check` **equivalent** `tsc --noEmit`**) and ESLint.**
6. **Tests run against compiled output or via** `ts-nodetsx` — decide in Phase 0; recommended: keep tests as `.ts` and run with `tsx` so `npm test` stays `node test/*.js` equivalent via a test runner wrapper. Simplest drop-in: convert tests to `.ts` and execute with `tsx test/<name>.ts`, or keep `package.json` `test` script invoking `tsx`.

Type strictness: start with `strict: true` but allow `noImplicitAny` violations to be fixed per-file; do not weaken `strictNullChecks` or `strictFunctionTypes`.

---

**## 4. Type Declaration Strategy (modules without .d.ts)**

| Module | Has types? | Action |

|--------|-----------|--------|

| `better-sqlite3` | No bundled `.d.ts` | Add `@types/better-sqlite3` devDep OR write a minimal `src/types/better-sqlite3.d.ts` declaration. |

| `sql.js` | No bundled `.d.ts` | Write a minimal `src/types/sql.js.d.ts` declaring `Database`, `Statement`, `initSqlJs`. |

| `@modelcontextprotocol/sdk` | Yes `types.d.ts`) | Import types directly. |

| `electron` | Yes `electron.d.ts`) | Import types directly. |

| `ws` | Yes `@types/ws` may already be transitive) | Verify; add declaration if missing. |

---

**## 5. Phase Plan**

| Phase | Goal | Exit criteria |

|-------|------|---------------|

| **P0** | Setup: tsconfig, types, package.json scripts, devDeps | `tsc --noEmit` clean on a stub; `npm install` clean |

| **P1** | Convert `packages/adapters/`* (leaf modules, no internal deps except base) | Each adapter `.ts` type-checks; `fixture-tests` still pass |

| **P2** | Convert `packages/core/db-compat.js` + `packages/core/index.js` | Core engine type-checks; `indexing` + `search` + `search-quality` + `validator-precision` + `security` tests pass |

| **P3** | Convert `packages/core/brainmaxxing.js` | `brainmaxxing` tests pass; containment (G1) preserved |

| **P4** ✅ COMPLETED | Convert `preload.js` + `mcp-server.js` → `preload.ts` + `mcp-server.ts` | MCP server lists 16 tools; preload exposes synAPI; `src/types/electron-preload.d.ts` added; `packages/core/index.ts` exports `SecretPattern` + `indexed_at` on `listSessions`. Committed as `cfa537b`. |

| **P5** ✅ COMPLETED | Convert `main.js` + `reindex.js` + `check_codex_sessions.js` + `bootstrap.js` + `wrapper.js` → `main.ts` + `reindex.ts` + `check_codex_sessions.ts` + `bootstrap.ts` + `wrapper.ts` | `tsc --noEmit` clean; ESLint 0 warnings; IPC handlers intact; old `.js` deleted via `git rm`. Committed as `19416e5`. |

| **P6** ✅ COMPLETED | Convert `renderer/app.js` + `renderer/brain-vault.js` | Renderer type-checks; ESLint clean; UI behavior unchanged. Old `.js` deleted via `git rm`. Committed as `ce46f51`. |

| **P7** ✅ COMPLETED | Convert `test/*.js` to `test/*.ts` | Full `npm test` passes (identical results). All 11 test .ts files converted; tsc 0 errors; ESLint 0 warnings; all tests pass (search 13/13, search-quality 24/24, validator-precision 65/65, fixture-tests 46/46, indexing 8/8, security 34/34, brainmaxxing 104/104, session-delete 10/10, g3-filter-forwarding 30/30, mcp 34/34, real-world-integration 39/39). Old .js test files deleted via `git rm`. Committed and pushed. |

| **P8** ✅ COMPLETED | Final review + regression | `npm ci` + `npm test` + `npm run lint` + `tsc --noEmit` all green on clean checkout. All criteria met — migration complete. Committed and pushed. |

Tests are converted last (P7) so they can assert against the now-TS source via `tsx`. Each phase has its own validation loop; do not proceed until the phase's exit criteria are met.

---

**## 6. Review Checklist (applied to every converted file)**

- [] File renamed `.js` -> `.ts`.

- [ ] All `require()` calls updated to TS import or kept as `require` with types.
- [ ] `module.exports` replaced with `export =` or `export {}` matching consumers.
- [ ] Function params/returns have explicit types (no implicit `any`).
- [ ] Class fields initialized or marked `readonlyoptional`.
- [ ] `strictNullChecks` respected (null checks before property access).
- [ ] Runtime behavior unchanged (same IPC names, same MCP schemas, same logic).
- [ ] `tsc --noEmit` reports no errors for the file.
- [ ] ESLint reports 0 errors / 0 warnings on the file.
- [ ] Related test suite still passes.

---

**## 7. How an Agent Uses This Guide**

1. Pick the lowest unfinished phase (P0 -> P8).
2. For each file in the phase, convert `.js` -> `.ts` per Section 3.
3. Run the phase's exit-criteria commands (see each phase detail below).
4. Mark the file complete only when type-check + lint + related tests pass.
5. Update this guide's phase status as work completes; an agent or reviewer can resume at any phase by reading the status table.

---

**## 8. Commit Rule (MANDATORY — read before every commit)**

Before committing any changes during this migration, follow this procedure exactly:

1. **`git status`** — review all modified, deleted, and untracked files. Confirm only migration-related files are included.
2. **`git diff --stat`** — review the scope of changes. Ensure no unrelated files are being committed.
3. **Delete duplicate `.js` files** — for every `.js` file that has been converted to `.ts` and committed, delete the old `.js` from the repo with `git rm <file.js>`. This prevents duplicate source files (a `.js` and `.ts` with the same logic coexisting).
4. **`git add`** — stage only the files intentionally changed by this migration step (converted `.ts` files, updated configs, deleted `.js` files being replaced, migration.md itself).
5. **Run validation before commit:** `npx tsc --noEmit` must pass with 0 errors, and `npx eslint <changed-files> --ext .ts --max-warnings 0` must pass with 0 warnings on all changed TypeScript files.
6. **`git commit`** — commit with a descriptive message in the format: `migration: <phase> <description>` (e.g., `migration: P2 index.ts — convert to TypeScript, fix all tsc errors`).
7. **`git log --oneline -3`** — verify the commit landed correctly on `main`.
8. **Push** — after committing, push to remote so the `.js` deletions propagate.

Do NOT commit unrelated changes, debug scripts, temporary files, or build output (`dist/`, `node_modules/`). If validation fails, fix before committing.

Next: Part 2 — Phase P0 setup details (tsconfig, package.json, type declarations).  
**# [migration.md](http://migration.md) — Syn: 100% Native TypeScript Migration Guide (Part 2: Phase P0 Setup)**

Continues from Part 1. Append this content after Part 1 in the same file.

---

**## Phase P0 — Tooling Setup (tsconfig, package.json, type declarations)**

**Goal:** Establish the TypeScript toolchain so every subsequent file can be type-checked. No source conversion yet.

**### P0.1 Create** `tsconfig.json` **at repo root**

```json

{

  "compilerOptions": {

    "target": "ES2022",

    "module": "commonjs",

    "moduleResolution": "node",

    "outDir": "./dist",

    "rootDir": ".",

    "strict": true,

    "esModuleInterop": true,

    "allowSyntheticDefaultImports": true,

    "resolveJsonModule": true,

    "skipLibCheck": true,

    "forceConsistentCasingInFileNames": true,

    "noImplicitReturns": true,

    "noFallthroughCasesInSwitch": true,

    "noUnusedLocals": false,

    "noUnusedParameters": false,

    "declaration": false,

    "sourceMap": true,

    "baseUrl": ".",

    "paths": {

      "@packages/core/*": ["packages/core/*"],

      "@packages/adapters/*": ["packages/adapters/*"]

    }

  },

  "include": [

    "packages/**/*.ts",

    "mcp-server.ts",

    "main.ts",

    "preload.ts",

    "renderer/**/*.ts",

    "scripts/**/*.ts",

    "test/**/*.ts",

    "src/types/**/*.d.ts"

  ],

  "exclude": ["node_modules", "dist", "release", "brain", "assets", "docs", "skills"]

}

```

Notes:

- `module: commonjs` keeps `requiremodule.exports` runtime compatible with Electron and the existing tests.
- `strict: true` enables `noImplicitAny`, `strictNullChecks`, etc. Fix violations per-file; do not downgrade `strictNullChecks`.
- `skipLibCheck: true` avoids noise from third-party `.d.ts` files.
- `noUnusedLocalsnoUnusedParameters` set to `false` initially to reduce churn during conversion; enable them in P8 for final hygiene.

**### P0.2 Update** `package.json`

Add devDependencies and scripts:

```json

{

  "devDependencies": {

    "electron": "^31.0.0",

    "electron-builder": "^25.0.0",

    "eslint": "^8.57.1",

    "eslint-config-standard": "^17.1.0",

    "eslint-plugin-import": "^2.32.0",

    "eslint-plugin-n": "^15.7.0",

    "eslint-plugin-promise": "^6.6.0",

    "@typescript-eslint/parser": "^6.0.0",

    "@typescript-eslint/eslint-plugin": "^6.0.0",

    "typescript": "^5.4.0",

    "tsx": "^4.0.0",

    "@types/better-sqlite3": "^7.6.0",

    "@types/node": "^20.0.0"

  },

  "scripts": {

    "start": "electron .",

    "dev": "electron .",

    "build": "electron-builder",

    "tsc": "tsc --noEmit",

    "lint": "eslint . --ext .js,.ts --max-warnings 0",

    "test": "node -e \"require('tsx'); process.exit(0)\" && tsx test/search.test.ts && tsx test/search-quality.test.ts && tsx test/validator-precision.test.ts && tsx test/fixture-tests.ts && tsx test/indexing.test.ts && tsx test/security.test.ts && tsx test/brainmaxxing.test.ts && tsx test/session-delete.test.ts && tsx test/g3-filter-forwarding.test.ts && tsx test/mcp.test.ts && tsx test/real-world-integration.test.ts"

  }

}

```

Important: keep `"type": "commonjs"` in package.json (do not switch to ESM). tsx executes `.ts` as CommonJS by default matching the current runtime.

**Why tsx:** It runs TypeScript directly without a separate compile step, so `npm test` continues to invoke `test/<name>` files (now `.ts`) with identical behavior and no `dist/` output required for tests. `tsc --noEmit` is the separate type-check gate.

**### P0.3 Create minimal type declarations for modules lacking** `.d.ts`

Create directory `src/types/`:

`src/types/sql.js.d.ts`:

```ts

declare module 'sql.js' {

  export interface Database {

    exec(sql: string): void;

    prepare(sql: string): Statement;

    close(): void;

    export(): Uint8Array;

  }

  export interface Statement {

    bind(params?: any[] | Record<string, any>): void;

    step(): boolean;

    get(): any[];

    getColumnNames(): string[];

    reset(): void;

    changes: number;

    lastInsertRowid: number;

    all(params?: any[] | Record<string, any>): any[];

    get(params?: any[] | Record<string, any>): any;

    run(params?: any[] | Record<string, any>): { changes: number; lastInsertRowid: number };

  }

  export function initSqlJs(opts?: { locateFile?: (file: string) => string }): Promise<{ Database: new (buffer?: Uint8Array | null) => Database }>;

  export const Database: new (buffer?: Uint8Array | null) => Database;

}

```

`src/types/better-sqlite3.d.ts` (minimal subset used by opencode adapter):

```ts

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

```

Adjust if `@types/better-sqlite3` is installed instead (then delete this file).

**### P0.4 Update** `.eslintrc.json` **for TypeScript**

```json

{

  "env": { "browser": true, "es2022": true, "node": true },

  "extends": ["standard", "plugin:@typescript-eslint/recommended"],

  "parser": "@typescript-eslint/parser",

  "parserOptions": {

    "ecmaVersion": 2022,

    "sourceType": "script"

  },

  "plugins": ["@typescript-eslint", "import", "n", "promise"],

  "rules": {

    "indent": ["error", 2],

    "quotes": ["error", "single"],

    "no-unused-vars": "off",

    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],

    "no-console": "off",

    "@typescript-eslint/no-explicit-any": "warn"

  }

}

```

`@typescript-eslint/no-explicit-any` is `warn` (not error) because adapters legitimately use `any` for dynamic JSON; keep warnings at 0 via `--max-warnings 0` by fixing or explicitly annotating `any` where intentional.

**### P0.5 Install and verify toolchain**

```bash

npm install

npx tsc --noEmit   # should report no errors (nothing converted yet)

npx eslint . --ext .js --max-warnings 0  # baseline: 0 errors, 0 warnings on existing JS

```

Exit criteria for P0:

- `tsc --noEmit` runs without crashing.
- `npm install` succeeds.
- ESLint baseline passes on existing `.js` files.

Next: Part 3 — Phase P1 (adapters).

**# [migration.md](http://migration.md) — Syn: 100% Native TypeScript Migration Guide (Part 3: Phase P1 Adapters)**

Continues from Part 2. Append after Part 2.

---

**## Phase P1 — Convert** `packages/adapters/`* **(leaf modules)**

**Goal:** Convert the 9 adapter files to TypeScript. These are leaf modules (depend only on `pathfscryptosql.jsbetter-sqlite3` and each other only through the registry), so they are the safest starting point.

**Exit criteria:** Every adapter `.ts` passes `tsc --noEmit` + ESLint; `test/fixture-tests.ts` (47 tests) still passes against the converted adapters.

**### P1.1 Conversion order (least to most dependent)**

1. `packages/adapters/base.ts` — `BaseAdapter` class (no internal deps)
2. `packages/adapters/text.ts` — `TextAdapter` (depends on base)
3. `packages/adapters/json.ts` — `JsonAdapter` (depends on base; conditionally requires jsonl)
4. `packages/adapters/jsonl.ts` — `JsonlAdapter` (depends on base)
5. `packages/adapters/sqlite.ts` — `SQLiteAdapter` (depends on base + sql.js)
6. `packages/adapters/codex.ts` — `CodexAdapter` (depends on base + sql.js)
7. `packages/adapters/opencode.ts` — `OpencodeAdapter` (depends on base + better-sqlite3)
8. `packages/adapters/claude-code.ts` — `ClaudeCodeAdapter` (depends on base)
9. `packages/adapters/registry.ts` — `AdapterRegistry` (depends on all adapters above) — convert LAST in this phase

**### P1.2 Conversion patterns to apply (per file)**

**Imports:** Replace

```js

const path = require('path')

const fs = require('fs')

const { BaseAdapter } = require('./base')

```

with

```ts

import path from 'path'

import fs from 'fs'

import { BaseAdapter } from './base'

```

Keep `require` for `sql.js` and `better-sqlite3` if their type declarations are awkward; otherwise use `import initSqlJs from 'sql.js'` and `import Database from 'better-sqlite3'` consistent with the declarations in P0.3.

**Class fields:** Add explicit types and initialization.

```ts

// before

[this.name](http://this.name) = [options.name](http://options.name) || 'Unknown'

this.sessionTable = options.sessionTable || 'sessions'

// after

[this.name](http://this.name): string = [options.name](http://options.name) ?? 'Unknown'

this.sessionTable: string = options.sessionTable ?? 'sessions'

this.sessionIdCol: string = options.sessionIdCol ?? 'session_id'

```

**Method signatures:** Add param/return types.

```ts

// before

canHandle (filePath) { ... }

parseSession (filePath) { throw new Error('...') }

// after

canHandle (filePath: string): boolean { ... }

parseSession (filePath: string): SessionData | null { ... }

```

Define a shared `SessionData` interface in `base.ts`:

```ts

export interface Message {

  session_id: string

  message_index: number

  role: string

  timestamp: string

  content: string

  tool_calls: any | null

}

export interface SessionData {

  sessionId: string

  title: string

  createdAt: string

  messages: Message[]

  filePath: string

  harness: string

  _meta?: Record<string, any>

}

```

`parseAllSessions`*:** Return `Promise<SessionData[]>`.

`_readFile` *helper:** keep returning `string`.

**Static regex helpers** `extractTextFromJsonValue` in sqlite.ts, `splitConcatJson` in jsonl.ts): type params as `any` or `Record<string, unknown>` and return `string`.

`module.exports`*:** Replace with `export { ... }` named exports matching what consumers import.

**### P1.3 File-by-file notes**

**base.ts:** Add `SessionData` and `Message` interfaces. Keep `discover`, `parseSession`, `extractText`, `_readFile`, `_fingerprint`.

**text.ts:** Straightforward conversion; `parseSession` returns `SessionData`.

**json.ts:** `parseSession` falls back to `JsonlAdapter` — keep the dynamic `require('./jsonl')` or import at top and reference. Since `jsonl.ts` is converted in the same phase, a top-level import is fine.

**jsonl.ts:** Keep `splitConcatJson` as a module-level function with types. `parseSession` tries whole-file JSON, then chunked, then line-by-line; preserve all three fallback paths exactly.

**sqlite.ts:** Large file (~500 lines). Preserve `_parseCopilotStore`, `_parseSessionTable`, `_parseMessageStoreTable`, `extractTextFromJsonValue`. Type the `db` wrapper returned by `wrapDb` as `any` or import the db-compat types (see P2). The `wrapDb` import comes from `../core/db-compat` which is not yet converted — use `require` with a type assertion or `// @ts-expect-error` temporarily, then fix in P2 when db-compat is TS. Simplest: in P1, keep `const { wrapDb } = require('../core/db-compat')` and type the result as `any`.

**codex.ts:** Same pattern; `wrapDb` from `../core/db-compat` typed `any` until P2. Keeps `findCodexDbs` exported.

**opencode.ts:** Uses `import Database from 'better-sqlite3'` (or require). `parseAllSessions` returns `Promise<SessionData[]>`.

**claude-code.ts:** `findClaudeProjectsDirfindClaudeDesktopDir` return `string | null`. `discover` returns `{ filePath: string; ext: string }[]`.

**registry.ts:** Convert last. Imports all adapter classes. `AdapterRegistry` class methods typed: `findAdapterForFile(filePath: string): BaseAdapter | null`, `discover(dirPath, harness?): { filePath; ext; adapter; harness }[]`, etc. `detectHarness(dirPath: string): string`. `getSessionValidator(harness: string): (filePath: string) => boolean`. The validator map values typed as `(filePath: string) => boolean`.

**### P1.4 Validation loop**

After all adapters converted:

```bash

npx tsc --noEmit          # no type errors

npx eslint packages/adapters --ext .ts --max-warnings 0

tsx test/fixture-tests.ts   # 47 passed, 0 failed

```

If `fixture-tests.ts` imports `../packages/core/index` (not yet converted), use `require('../packages/core/index')` with `// @ts-expect-error` or point it at the `.js` file temporarily. The index engine is converted in P2; until then, fixture tests can `require` the JS version. Mark this as a known P1->P2 dependency.

Next: Part 4 — Phase P2 (core engine + db-compat).  
**# [migration.md](http://migration.md) — Syn: 100% Native TypeScript Migration Guide (Part 4: Phase P2 Core Engine)**

Continues from Part 3. Append after Part 3.

---

**## Phase P2 — Convert** `packages/core/db-compat.ts` **+** `packages/core/index.ts`

**Goal:** Convert the SQLite compatibility wrapper and the large IndexingEngine (~1740 lines). This is the most complex conversion because the engine has rich JSDoc typedefs already `SessionResult`, `IndexOptions`, `Message`) that map directly to TypeScript interfaces.

**Exit criteria:** `tsc --noEmit` clean; ESLint clean on `packages/core`; `test/indexing.ts`, `test/search.ts`, `test/search-quality.ts`, `test/validator-precision.ts`, `test/security.ts` all pass against the converted engine.

**### P2.1 Convert** `db-compat.ts` **first (index depends on it)**

`wrapDb(db)` mutates a sql.js Database in place and returns it with a better-sqlite3-compatible API. Type it as:

```ts

import type { Database as SqlJsDatabase, Statement as SqlJsStatement } from 'sql.js'

export interface PreparedStatement {

  all(...args: any[]): any[]

  get(...args: any[]): any | undefined

  run(...args: any[]): { changes: number; lastInsertRowid: number }

}

export interface SqlJsDatabase {

  prepare(sql: string): SqlJsStatement

  exec(sql: string): void

  transaction(fn: () => void): () => void

  export(): Uint8Array

  close(): void

}

export function wrapDb(db: SqlJsDatabase): SqlJsDatabase { ... }

```

The returned object shape `{ all, get, run }` plus the original `exectransactionexportcloseprepare`. Cast carefully; use `as SqlJsDatabase` where the wrapper mutates `db.prepare`.

**### P2.2 Convert** `index.ts` **— overall approach**

The file is ~1740 lines. Convert in this order within the file:

1. **Imports** at top: `path`, `fs`, `crypto`, `initSqlJs`, `wrapDb`, `AdapterRegistry`.
2. **Module-level constants**: `SUPPORTED_EXTS`, `DEFAULT_SECRET_PATTERNS`, `NON_SESSION_NAMES`.
3. **Module-level functions**: `redactSecrets`, `sleep`, `isNonSessionFile`.
4. *`sqlPromise` / `SQL`**: module-level `let SQL: any = null` and the `initSqlJs` promise.
5. **Interfaces** (from existing JSDoc): `SessionResult`, `IndexOptions`, `Message`.
6. `IndexingEngine` *class**: constructor, `open`, `rebuild`, `_createSchema`, `close`, `_fingerprint`, `_isExcluded`, `_normalizePath`, static text-extraction methods, `parseMessages`, `collectSessionFiles`, source management `addSource`, `listSources`, `removeSource`, `removeSession`), `_detectHarness`, `_analyzeDirectory`, indexing `indexSource`, `indexAllSources`, `incrementalIndex`, `_incrementalIndexSource`), session extraction `_getFileSessions`, `_uniqueSessionId`), search `search`, `searchMessages`), retrieval `getSession`, `getContext`, `listSessions`, `getAllHarnesses`, `countSessions`), helpers `_getSessionContent`, `_bm25Score`, `_countOccurrences`, `_snippet`, `_excerpt`), static weights.
7. `module.exports = { IndexingEngine, SUPPORTED_EXTS }`* -> `export { IndexingEngine, SUPPORTED_EXTS }`.

**### P2.3 Key typing decisions**

`DEFAULT_SECRET_PATTERNS`*:**

```ts

interface SecretPattern {

  name: string

  pattern: RegExp

  replacement: string

}

const DEFAULT_SECRET_PATTERNS: SecretPattern[] = [ ... ]

```

`redactSecrets(content: string, patterns: SecretPattern[]): string`*

**Constructor options:**

```ts

interface EngineOptions {

  redactSecrets?: boolean

  secretPatterns?: SecretPattern[]

  excludedPaths?: string[]

}

constructor(dbPath: string, options: EngineOptions = {}) { ... }

```

**Class fields:** `db: SqlJsDatabase | null = null`, `initialized = false`, `registry: AdapterRegistry`, `redactSecrets: boolean`, `secretPatterns: SecretPattern[]`, `excludedPaths: string[]`, `dbHealth: 'healthy' | 'corrupt' | 'rebuilding' | null = null`.

`dbHealth` *type:** define `type DbHealth = 'healthy' | 'corrupt' | 'rebuilding' | null`.

`open()`*:** returns `Promise<IndexingEngine>` (i.e., `Promise<this>`). Uses `fs.readFileSync`, `fs.existsSync`, `fs.mkdirSync`, `fs.writeFileSync`, `fs.copyFileSync`, `fs.unlinkSync` — all typed by `@types/node`.

`_createSchema()`*:** `this.db.exec(...)`. Since `this.db` may be `null`, guard: `if (!this.db) throw new Error('Database not open')` at the start of methods that need it, or use non-null assertion after verifying `open()` was called. Cleaner: add a private `requireOpen()` helper that throws if `!this.db`.

**Transaction:** `const tx = this.db.transaction(() => { ... })` — sql.js `transaction` returns a function via db-compat wrapper. Type as `() => void`; call `tx()`.

`search()` *returns* `SessionResult[]`*.** Define `SessionResult` interface matching existing JSDoc.

**Static methods** `readTextFile`, `extractTextFromJsonl`, `extractTextFromJsonValue`, `extractTextFromJsonFile`, `extractTextFromSqlite`, `readSessionFileContent`, `parseMessages`, `collectSessionFiles`, `_uniqueSessionId`, `readSessionFileContent`): mark `static` with types. `extractTextFromSqlite` is `async`.

`parseMessages(filePath: string, sessionId: string): Promise<Message[]>`* — large method; preserve all extension branches (.jsonl, .json, .md/.txt, .db/.sqlite) exactly.

`_getFileSessions(filePath: string): Promise<{ sessionId; title; createdAt; messages; content; filePath; harness }[]>[]`* — define an inline interface or reuse `SessionData` from adapters. Since index imports `AdapterRegistry` (already converted in P1), it can import `SessionData` from `../adapters/base` or define a local `FileSession` interface. Recommend defining local interface `ParsedSession` to avoid coupling, or import from adapters base. Importing from adapters base is cleaner (single source of truth).

`indexSource(sourceId, options)`*:** `batchSize` default 10; returns `{ sourceId, sourcePath, indexed, skipped, total, sessionCount, durationMs }`. Define `IndexSourceResult` interface.

`indexAllSources(options)` */* `incrementalIndex(options)` */* `_incrementalIndexSource(sourceId, options)`*:** similar result types.

`search(query, options)`*:** complex method with filter parsing, IDF, SQL building, BM25 scoring, snippets. Preserve logic exactly; add types to locals `limit`, `harness`, `project`, `dateFrom`, `dateTo`, `brain`, `role`, `enabledHarnesses`, `excerptLength`, `filteredTerms`, `idfWeights`, `termClauses`, `params`, `rows`, `results`).

`searchMessages(query, options)`*:** returns message-result array; define `MessageResult` interface.

`getSession(sessionId): SessionWithMessages | null`* — define `SessionWithMessages` = session row + `messages: Message[]`.

`getContext(sessionId, messageIndex, before, after)`*:** returns `{ session, messages, centerIndex } | null`.

`listSessions(options)`*:** returns session rows array; define `SessionRow` interface (subset of fields).

`_bm25Score(terms, title, content, idfWeights)`*:** returns `number`.

`_snippet(text, terms, maxLength)`*:** returns `string`; builds regex from terms — type `RegExp`.

`TITLE_WEIGHT = 5`*,* `CONTENT_WEIGHT = 1`*,* `TITLE_PRESENCE_BONUS = 10`* as `static` readonly numbers.

`SUPPORTED_EXTS: Set<string>`* exported const.

**### P2.4** `any` **usage allowance**

For the sql.js wrapped statement and dynamic row objects, using `any` is acceptable in P2 as long as `--max-warnings 0` is satisfied. Prefer explicit `Record<string, any>` over bare `any` where the shape is a DB row. Add `// @ts-expect-error` only as a last resort and document why.

**### P2.5 Validation loop**

```bash

npx tsc --noEmit

npx eslint packages/core --ext .ts --max-warnings 0

tsx test/indexing.ts

tsx test/search.ts

tsx test/search-quality.ts

tsx test/validator-precision.ts

tsx test/security.ts

```

`test/security.ts` constructs `new IndexingEngine(...)` — ensure the constructor signature matches. `test/indexing.ts` uses `indexSource`, `listSources`, `search`, `getSession` — preserve signatures.

Next: Part 5 — Phase P3 (brainmaxxing).  
**# [migration.md](http://migration.md) — Syn: 100% Native TypeScript Migration Guide (Part 5: Phase P3 Brainmaxxing)**

Continues from Part 4. Append after Part 4.

---

**## Phase P3 — Convert** `packages/core/brainmaxxing.ts`

**Goal:** Convert the brainmaxxing module (~647 lines) including path containment (G1 security), brain vault read/write/list/rename/delete/import, index rebuild, and the five commands (/reflect, /meditate, /ruminate, /plan, /review).

**Exit criteria:** `tsc --noEmit` clean; ESLint clean; `test/brainmaxxing.ts` (89 tests) passes; containment (G1) still rejects all traversal/absolute/symlink escapes.

**### P3.1 Conversion patterns**

**Module-level** `BRAIN_DIR`**:**

```ts

let BRAIN_DIR: string = path.join(__dirname, '..', '..', 'brain')

export { BRAIN_DIR }

export function setBrainDir(newDir: string): void {

  if (!path.isAbsolute(newDir)) throw new Error('Brain dir must be absolute')

  BRAIN_DIR = newDir

  ensureDir(BRAIN_DIR)

}

```

`containBrainPath(relativePath: string): string`* — keep all validation: reject non-string/empty, absolute paths, mixed separators, `..` segments, resolved target outside `BRAIN_DIR`, symlink escapes via `fs.realpathSync`. Return `resolved` absolute path. Throw `Error` on violation.

`brainRead(relativePath): { ok: boolean; path?: string; content?: string; error?: string }`* — define `BrainReadResult` interface. Use `containBrainPath`, `fs.existsSync`, `fs.readFileSync`.

`brainWrite(relativePath, content): { ok: boolean; path?: string; error?: string }`* — define `BrainWriteResult`. `ensureDir`, `fs.mkdirSync(path.dirname(...), { recursive: true })`, `fs.writeFileSync`.

`brainList(): string[]`* — recursive walk with `fs.readdirSync(dir, { withFileTypes: true })`, skip symlinked dirs, collect `.md` files relative to `BRAIN_DIR`, sort.

`brainNextSerial(): { ok: boolean; serial?: number; tag?: string; error?: string }`* — scan all vault files for `Serial:\s*#(\d{6})`, return next padded tag.

`brainRename(oldPath, newPath)`***,* `brainDelete(relativePath)`, ***`brainImport(sourcePath)` — define result interfaces; preserve copy logic and symlink-skip in `walkDir`.

`rebuildIndex(): { ok: boolean; files: number }`* — builds `brain/index.md` content, calls `brainWrite('index.md', content)`.

`readIndexMd(): string`* — returns `brainRead('index.md').content || ''`.

**### P3.2 Command functions**

Each command is `async` and takes `(..., engine: IndexingEngine)`. Define an `EngineLike` interface to avoid importing the full engine (circular dep risk): engine needs `getSession`, `listSessions`. 

```ts

interface EngineLike {

  getSession(sessionId: string): { messages?: Message[]; title?: string; harness?: string } | null

  listSessions?(options?: any): { session_id: string }[]

}

```

Import `Message` type from adapters base or define locally. Import `IndexingEngine` type only as a type `import type { IndexingEngine } from './index'`) to avoid runtime circular require.

`extractLearnings(content: string): string[]`* — keyword scan, dedup, slice(0,20).

`reflect(sessionId, engine)`* — `async`, returns reflect result with `path, title, learningsCount, learnings`. Calls `engine.getSession(sessionId)`.

`meditate(engine)`* — audits brain files, extracts principle keywords, detects stale notes (<40 chars), writes `principles/meditate-<date>.md`, rebuilds index.

`ruminate(engine)`* — scans up to 50 sessions via `engine.listSessions()engine.getSession()`, keyword hits, writes `sessions/ruminate-<date>.md`.

`plan(task, engine)`* — writes `plans/plan-<date>-<slug>.md`.

`review(content, engine)`* — issues array, writes `plans/review-<date>-<slug>.md`.

`slugify(text: string): string`* — lowercase, hyphenate, trim, slice(0,80).

`module.exports`* -> `export { BRAIN_DIR, containBrainPath, setBrainDir, brainRead, brainWrite, brainRename, brainDelete, brainList, brainNextSerial, brainImport, rebuildIndex, readIndexMd, reflect, meditate, ruminate, plan, review }`.

**### P3.3 Type details**

`LEARNING_KEYWORDS: string[]`. `principleKeywords: string[]`. All local arrays typed.

File-writing helpers return `void` or result objects; `brainWrite` is the primitive used by all commands.

`brainNextSerial` uses regex `/Serial:\s*#(\d{6})/g` — type as `RegExp`; `parseInt(m[1], 10)`.

**### P3.4 Circular dependency note**

`brainmaxxing.ts` imports `IndexingEngine` type only (type-only import, erased at compile). `index.ts` does not import brainmaxxing. `main.ts` and `mcp-server.ts` import both at runtime — that's fine, no cycle there.

**### P3.5 Validation loop**

```bash

npx tsc --noEmit

npx eslint packages/core --ext .ts --max-warnings 0

tsx test/brainmaxxing.ts   # 89 passed, 0 failed

```

Security spot-check (G1): `brainWrite("../../../escape.txt","x")` -> `{ok:false,error}`; no file created outside `brain/`. The existing test/brainmaxxing.ts covers this.

Next: Part 6 — Phase P4 (preload + MCP server).  
**# [migration.md](http://migration.md) — Syn: 100% Native TypeScript Migration Guide (Part 6: Phase P4 Preload + MCP Server)** ✅ COMPLETED

Continues from Part 5. Append after Part 5.

---

**## Phase P4 — Convert** `preload.ts` **+** `mcp-server.ts` ✅ DONE

**Status:** Completed and committed as `cfa537b`. `preload.js` → `preload.ts`, `mcp-server.js` → `mcp-server.ts`, new `src/types/electron-preload.d.ts`, `packages/core/index.ts` updated (exported `SecretPattern`, added `indexed_at` to `listSessions`). All `.js` originals deleted from repo.

**Goal:** Convert the Electron preload bridge `synAPI`) and the stdio MCP server (16 `syn_`* tools).

**Exit criteria:** `tsc --noEmit` clean; ESLint clean; MCP server starts and `tools/list` returns 16 tools (verified via `tsx mcp-server.ts` with a ListTools request, or inspect the tools array statically); preload exposes the same `synAPI` shape.

**### P4.1 Convert** `preload.ts`

`preload.js` uses Electron's `contextBridge` and `ipcRenderer`. In the renderer (contextIsolation: true, nodeIntegration: false), `preload.ts` runs in a Node-enabled isolated world, so `require('electron')` works.

Conversion:

```ts

import { contextBridge, ipcRenderer } from 'electron'

interface SynAPI {

  getConfig: () => Promise<any>

  setConfig: (updates: any) => Promise<any>

  addHarness: (dirPath: string, harness?: string) => Promise<any>

  removeHarness: (dirPath: string) => Promise<any>

  listHarnesses: () => Promise<any[]>

  getHarnessSettings: () => Promise<any[]>

  setHarnessSetting: (name: string, enabled: boolean) => Promise<any>

  autodetectHarnesses: () => Promise<string[]>

  indexSource: (sourceId: number) => Promise<any>

  indexAllSources: (options?: any) => Promise<any>

  incrementalIndex: (options?: any) => Promise<any>

  listSessions: (sourcePath?: string) => Promise<any[]>

  listAllSessions: () => Promise<any[]>

  readSession: (sessionId: string) => Promise<any>

  deleteSession: (sessionId: string) => Promise<any>

  searchSessions: (query: string, options?: any) => Promise<any[]>

  getContext: (sessionId: string, messageIndex: number, before?: number, after?: number) => Promise<any>

  brainIndex: () => Promise<any>

  getBrainIndex: () => Promise<any>

  brainRead: (relativePath: string) => Promise<any>

  brainWrite: (relativePath: string, content: string) => Promise<any>

  brainRename: (oldPath: string, newPath: string) => Promise<any>

  brainDelete: (relativePath: string) => Promise<any>

  brainList: () => Promise<string[]>

  brainNextSerial: () => Promise<any>

  brainImport: (sourcePath: string) => Promise<any>

  brainSetDir: (newDir: string) => Promise<any>

  brainReflect: (sessionId: string) => Promise<any>

  brainMeditate: () => Promise<any>

  brainRuminate: () => Promise<any>

  brainPlan: (task: string) => Promise<any>

  brainReview: (content: string) => Promise<any>

  brainVaultOpen: () => Promise<any>

  brainVaultWindowMinimize: () => Promise<any>

  brainVaultWindowMaximize: () => Promise<any>

  brainVaultWindowClose: () => Promise<any>

  brainVaultWindowSetBounds: (bounds: any) => Promise<any>

  brainVaultWindowGetBounds: () => Promise<any>

  brainDir: () => Promise<{ path: string }>

  synWindow: { minimize: () => Promise<void>; maximize: () => Promise<void>; close: () => Promise<void> }

  onBvWindowShown: (cb: (event: any) => void) => void

  onBvEnterFullscreen: (cb: (event: any) => void) => void

  onBvLeaveFullscreen: (cb: (event: any) => void) => void

  openFileDialog: () => Promise<string[] | null>

  openFolderDialog: () => Promise<string | null>

  showItemInFolder: (fullPath: string) => Promise<void>

  dbHealth: () => Promise<any>

  dbRebuild: (preserveCorrupt?: boolean) => Promise<any>

}

const synAPI: SynAPI = {

  getConfig: () => ipcRenderer.invoke('config:get'),

  setConfig: (updates) => ipcRenderer.invoke('config:set', updates),

  ...

  synWindow: {

    minimize: () => ipcRenderer.invoke('SynWindow:minimize'),

    maximize: () => ipcRenderer.invoke('SynWindow:maximize'),

    close: () => ipcRenderer.invoke('SynWindow:close')

  },

  onBvWindowShown: (cb) => ipcRenderer.on('bv:window-shown', cb),

  ...

}

contextBridge.exposeInMainWorld('synAPI', synAPI)

contextBridge.exposeInMainWorld('locateAPI', synAPI)

```

Keep `locateAPI` alias for backward compatibility (mentioned in [nextphase.md](http://nextphase.md) Phase 0.1).

Type the `ipcRenderer.invoke` results as `Promise<any>` to avoid over-specifying; the renderer `app.ts`) will cast as needed.

**Note on renderer globals:** `renderer/app.ts` and `renderer/brain-vault.ts` read `window.synAPI`. Since `contextBridge.exposeInMainWorld` attaches to `window`, declare in a `.d.ts` or via `declare global`:

```ts

declare global {

  interface Window {

    synAPI: SynAPI

    locateAPI: SynAPI

  }

}

export {}

```

Place this declaration in `preload.ts` or a `src/types/electron-preload.d.ts` so renderer files can reference `window.synAPI` without `any`.

**### P4.2 Convert** `mcp-server.ts`

The MCP server uses `@modelcontextprotocol/sdk`. Import types from the SDK (types already bundled):

```ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js'

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import {

  CallToolRequestSchema,

  ListToolsRequestSchema

} from '@modelcontextprotocol/sdk/types.js'

```

With `esModuleInterop: true` and `module: commonjs`, these named imports work. If ESM interop errors occur, fall back to `require`:

```ts

const { Server } = require('@modelcontextprotocol/sdk/server/index.js')

```

typed via `// @ts-expect-error` or `as any`. Prefer ESM imports; verify with `tsc`.

**Server construction:**

```ts

const server = new Server(

  { name: 'syn', version: '2.0.0' },

  { capabilities: { tools: {} } }

)

```

`ListToolsRequestSchema` *handler:** return the same 16 tools with identical `inputSchema` definitions. Type the `tools` array as `any[]` or define a `Tool` interface matching the schema. Simplest: `return { tools: [...] as any }` to avoid fighting the SDK's strict tool schema types. Keep descriptions identical.

`CallToolRequestSchema` *handler:** `async (request) => { const { name, arguments: args } = request.params; switch (name) { ... } }`. Type `request` as `any` or use the SDK's `CallToolRequest` type. The `args` object is `Record<string, any> | undefined`.

Each case preserves the existing logic exactly:

- `syn_search`: `engine.search(args.query, {...})` with coercion (same as main.js session:search). Return JSON text content.
- `syn_get_session`, `syn_get_context`, `syn_list_sessions`, `syn_list_harnesses`, `syn_add_harness`, `syn_index_source`, `syn_index_all`, `syn_status`.
- `syn_read_brain`, `syn_write_brain` via `bm.brainReadbm.brainWrite`.
- `syn_reflect`, `syn_meditate`, `syn_ruminate`, `syn_plan`, `syn_review` via `bm.*`.

Preserve the `isError: true` error-return shape and the default `throw new Error(\`Unknown tool: ${name}`)`.

`engine` *instantiation:** `const engine = new IndexingEngine(INDEX_DB_PATH, {...})` then `await engine.open()`. Import `IndexingEngine` from `./packages/core/index` and `bm` from `./packages/core/brainmaxxing`.

**Config paths:** Keep `CONFIG_FILE` and `INDEX_DB_PATH` using `process.env.APPDATA || process.env.HOME || os.homedir()` + `syn/` — identical to current `mcp-server.js`.

**Startup:** `async function main() { const transport = new StdioServerTransport(); await server.connect(transport); console.error('[syn-mcp] Syn MCP server running on stdio') }` then `main().catch(...)`.

`module.exports`* -> none needed; `mcp-server.ts` is a script (no exports). It's executed directly.

**### P4.3 Validation loop**

```bash

npx tsc --noEmit

npx eslint preload.ts mcp-server.ts --ext .ts --max-warnings 0

```

MCP tool-count check (static, no server start needed): the `tools` array in `ListToolsRequestSchema` handler must contain exactly 16 entries. Verify by reading the source or running:

```bash

tsx -e "import('./mcp-server.ts')"  # may hang (server connects stdio); instead inspect statically

```

Safer: `grep -c "name: 'syn_" mcp-server.ts` -> expect 16. Or write a tiny check script that imports the tools array. Since `mcp-server.ts` runs `main()` on import (connects stdio), avoid importing it directly; instead statically count tool registrations in the source or run the server and send a ListTools request over stdio in a test `test/mcp.ts` already does this — see P7).

Next: Part 7 — Phase P5 (main + scripts).  
**# [migration.md](http://migration.md) — Syn: 100% Native TypeScript Migration Guide (Part 7: Phase P5 Main + Scripts)**

Continues from Part 6. Append after Part 6.

---

**## Phase P5 — Convert** `main.ts` **+ scripts** `reindex.ts`**,** `check_codex_sessions.ts`**,** `bootstrap.ts`**,** `wrapper.ts`**)** ✅ DONE

**Goal:** Convert the Electron main process (~856 lines) and standalone scripts. `main.ts` is the largest conversion: window lifecycle, `app.whenReady`, ~40 IPC handlers, engine + brainmaxxing wiring, config load/save.

**Exit criteria:** `tsc --noEmit` clean; ESLint clean; `electron .` launches (or `tsx main.ts` type-checks; actual launch requires Electron runtime — verify `npm start` works after P6 renderer conversion); all IPC channel names identical to current `main.js`.

**Status:** Completed and committed as `19416e5`. `main.js` → `main.ts`, `reindex.js` → `reindex.ts`, `check_codex_sessions.js` → `check_codex_sessions.ts`, `bootstrap.js` → `bootstrap.ts`, `wrapper.js` → `wrapper.ts`. All `.js` originals deleted from repo via `git rm`.

**### P5.1 Convert** `main.ts`

**Imports:**

```ts

import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'

import path from 'path'

import fs from 'fs'

import { IndexingEngine } from './packages/core/index'

import * as brainmaxxing from './packages/core/brainmaxxing'

```

`shell` is required inline in `main.js` `const { shell } = require('electron')` inside a handler); hoist to top import in TS.

**Config & constants** (identical values):

```ts

const CONFIG_FILE = path.join(app.getPath('userData'), 'syn', 'config.json')

const INDEX_DB_PATH = path.join(app.getPath('userData'), 'syn', 'syn-index.db')

interface SynConfig {

  harnessDirectories: string[]

  batchSize: number

  windowBounds: { width: number; height: number }

  harnessSettings: Record<string, boolean>

  redactSecrets: boolean

  secretPatterns: string[] | null

  excludedPaths: string[]

}

const DEFAULT_CONFIG: SynConfig = { ... }

let config: SynConfig = { ... DEFAULT_CONFIG }

```

`loadConfig()` */* `saveConfig()`*:** identical logic, `JSON.parseJSON.stringify`.

`ALL_POSSIBLE_HARNESSES: string[]`* and `getEnabledHarnesses(): string[]` — identical.

**Engine:**

```ts

const engine = new IndexingEngine(INDEX_DB_PATH, {

  redactSecrets: config.redactSecrets,

  secretPatterns: config.secretPatterns,

  excludedPaths: config.excludedPaths

})

```

**Windows:** `let mainWindow: BrowserWindow | null = null`, `let brainVaultWindow: BrowserWindow | null = null`.

`createWindow()`*:** identical options `frame: false`, `contextIsolation: true`, `nodeIntegration: false`, preload path, icon, title 'Syn', backgroundColor). Load `renderer/index.html`. `Menu.setApplicationMenu(null)`. Resize handler saves `config.windowBounds`.

`createBrainVaultWindow()`*:** identical spawn (x=300, y=80, width=1003, height=933), loads `renderer/brain-vault.html`, `bv:window-shownenter-fullscreenleave-fullscreen` forwarding.

*`openBrainVaultWindow()`**: focus-or-create.

`injectBrainIndex()` */* `watchBrainIndex()`*:** `brainIndexMd: string = ''`; `fs.watch(brainDir, { recursive: true })` with debounce timer. `brainmaxxing.readIndexMd()` / `rebuildIndex()`.

**Auto-register brain/ vault** in `app.whenReady()`.

`app.whenReady()` *sequence:** `await engine.open()`, log health, `injectBrainIndex()`, `watchBrainIndex()`, auto-register brain, `createWindow()`, `app.on('activate')`.

`app.on('window-all-closed')`*:** quit unless darwin.

**IPC handlers** — convert each `ipcMain.handle('channel', async (event, ...) => { ... })` identically. Type event as `Electron.IpcMainInvokeEvent` or `any`. Return types preserved. Key handlers:

- `SynWindow:minimize/maximize/close`
- `config:get`, `config:set`
- `db:health` -> `{ health, dbPath, initialized }`
- `db:rebuild` -> `{ status, health, ...result }`
- `harness:add/remove/list`, `harness:settings:get/set`, `dialog:openFolder`
- `session:list/listAll/read/delete/deleteFile/getContext`
- `source:index/indexAll/incrementalIndex`
- `session:search` — filter coercion identical to current (limit, excerptLength, harness, role, project, brain, dateFrom, dateTo, enabledHarnesses).
- `brain:getIndex/index/read/write/list/nextSerial/reflect/meditate/ruminate/plan/review`
- `brainVault:open`, `brain:dir`, `brainVaultWindow:minimize/maximize/close/setBounds/getBounds`, `brain:rename/delete/import/setDir`
- `dialog:openFile`, `shell:showItemInFolder`
- `harness:autodetect` — `getDriveRoots()` helper scanning C:–Z: for `Users/*/<knownHarnessDirs>`.

`getDriveRoots()`*:** uses `fsExtra.existsSync` in current code `const fsExtra = require('fs')` — redundant alias). In TS, just use `fs.existsSync`; preserve the drive scan logic (C-Z), `Users` dir enumeration, known harness dirs list, `await sleep(30)` between drives.

`session:deleteFile`*:** throws "Archive deletion is not supported" (G2) — preserve exactly.

`session:delete`*:** index-only `engine.removeSession(sessionId)`.

`module.exports`* -> none; `main.ts` is a script executed by Electron.

**### P5.2 Convert scripts**

`reindex.ts`*:** standalone CLI. Hardcoded `C:\Users\luizy\...` paths — preserve exactly as-is (they're non-runtime, user-specific; [nextphase.md](http://nextphase.md) portable-paths audit confirms hardcoded K:\ paths only in non-runtime files). Convert to TS with types; `INDEX_DB_PATH: string`, `harnessDirs: string[]`, `main()` async.

`check_codex_sessions.ts`*:** uses `better-sqlite3` directly. Import `Database from 'better-sqlite3'`, type `db`, `cols`, `rows`.

`bootstrap.ts` */* `wrapper.ts`*:** Electron module-patching hacks that manipulate `Module._loadModule._resolveFilename`. Convert to TS: `import { Module } from 'module'` (or `require('module')`), patch functions with types `(request: string, parent: any, isMain: boolean) => any`. These are runtime hacks; type loosely `any`) to avoid fighting Node's internal module types. Preserve behavior exactly.

**### P5.3** `electron` **entry point**

Update `package.json` `"main": "main.ts"`? Electron's `main` field must point to a JS file that Electron can run. Electron does not run TypeScript directly. Options:

1. Keep `"main": "main.js"` where `main.js` is a tiny shim that `require('./dist/main.js')` after `tsc` build — adds a build step.
2. Use `tsxts-node` to run `main.ts` directly via `"main": "main.ts"` with a loader — Electron won't natively handle `.ts`.
3. Keep `main.js` as-is (unconverted) and only convert for type-checking via `tsc --noEmit` — but then main.js drifts from main.ts.

Recommended approach for an Electron app: compile to `dist/` with `tsc` (emit), and set `"main": "dist/main.js"`, plus a `prebuildbuild` script. However `preload.js` is referenced by `webPreferences.preload` — also must be compiled to `dist/preload.js`, and renderer paths `renderer/index.html`) stay relative to the compiled main.

Given the goal is "100% native TypeScript app," the cleanest end state:

- `tsc` emits `dist/main.js`, `dist/preload.js`, `dist/mcp-server.js`, `dist/packages/**/*.js`, `dist/scripts/**/*.js`.
- `package.json` `"main": "dist/main.js"`.
- `preload` path in `main.ts`: `path.join(__dirname, '..', 'dist', 'preload.js')` — but `__dirname` after compile is `dist/`, so preload is `path.join(__dirname, 'preload.js')`. Adjust paths in `main.ts` to reference `dist/` layout OR keep source-relative paths and compile with `rootDir` preserving structure so `dist/packages/core/index.js` requires `dist/packages/core/db-compat.js` correctly (CommonJS require resolves relative to the compiled file — works automatically).

Simplest minimal-change approach that still satisfies "100% TypeScript source":

- Keep `"main": "main.js"` but make `main.js` a generated shim? No — that leaves a JS file.

Decision documented here: compile with `tsc` (emit to `dist/`), set `"main": "dist/main.js"`, update `main.ts` preload/window paths to be `__dirname`-relative (compiled layout), add `"build": "tsc && electron-builder"` or keep `electron-builder` separate with a `prebuild` step. `npm start` -> `tsc` not needed in dev; use `tsx main.ts` for dev via `"dev": "tsx main.ts"`, and `"start": "electron ."` relies on `dist/main.js` existing (run `npm run tsc` first, or `tsc` emits on save).

For the migration guide, specify:

- `tsc` emits to `dist/` (rootDir preserves `packages/`, `scripts/`, `renderer/` referenced via absolute paths in HTML).
- `"main": "dist/main.js"`.
- In `main.ts`, `preload: path.join(__dirname, 'preload.js')` (compiled alongside main), `mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))` — renderer stays at repo root `renderer/` (HTML/CSS not compiled), OR compile renderer too. Simplest: keep `renderer/` at repo root and load from source location; `__dirname` = `dist`, so `path.join(__dirname, '..', 'renderer', 'index.html')`.

The guide should note: `npm start` requires `tsc` to have run at least once (or use `tsx` for dev). Add script `"prestart": "tsc"` or document `tsc && electron .`.

Keep this decision lightweight in the guide; the exact output layout is a P5 implementation detail as long as type-checking passes and the app launches.

**### P5.4 Validation loop**

```bash

npx tsc --noEmit

npx eslint main.ts reindex.ts check_codex_sessions.ts bootstrap.ts wrapper.ts --ext .ts --max-warnings 0

tsc        # emit to dist/ (verify dist/main.js, dist/preload.js, dist/mcp-server.js produced)

```

Then (after P6 renderer conversion) `npm start` launches Electron.

Next: Part 8 — Phase P6 renderer `app.ts`, `brain-vault.ts`).  
**# [migration.md](http://migration.md) — Syn: 100% Native TypeScript Migration Guide (Part 8: Phase P6 Renderer)**

Continues from Part 7. Append after Part 7.

---

**## Phase P6 — Convert** `renderer/app.ts` **+** `renderer/brain-vault.ts`

**Goal:** Convert the two renderer script files (~1570 lines + ~1555 lines). These run in the Electron renderer (contextIsolation: true) and access `window.synAPI`, DOM, and IPC.

**Exit criteria:** `tsc --noEmit` clean; ESLint clean on `renderer/`; `npm start` launches Electron and the UI behaves identically (search, terminal, session reader, brain vault, context menus, drag/resize).

**### P6.1 Shared renderer type declarations**

Create `src/types/renderer-globals.d.ts` (or include in preload.ts):

```ts

declare global {

  interface Window {

    synAPI: import('./preload').SynAPI

    locateAPI: import('./preload').SynAPI

  }

  interface Document {

    // nothing extra

  }

}

export {}

```

Renderer files import the `SynAPI` type from `../preload` (type-only import to avoid runtime require of electron in renderer context — actually renderer can `import type` only; values come from `window.synAPI`).

Since renderer uses classic `<script src="app.js">` (no bundler, no ESM imports in HTML), TypeScript modules in renderer need care. Options:

1. Keep renderer as classic scripts compiled by `tsc` to `dist/renderer/app.js`, referenced via `<script src="app.js">`. `tsc` with `module: commonjs` emits `require()` calls — but renderer has `nodeIntegration: false`, so `require` is NOT available in the renderer! Current `renderer/app.js` uses NO `require` — it only touches `window.synAPI` and DOM. Good: keep it that way. Compiled `app.js` from TS will not contain `requireimport` if we don't use imports. So renderer TS files must be **standalone scripts** (no import/export statements), compiled by tsc to plain JS, loaded via `<script src>`.
2. Declare types via `/// <reference path="..." />` or a global `.d.ts` included in `tsconfig include`.

Approach: renderer `.ts` files contain no `importexport` — they're global scripts. Types come from `src/types/*.d.ts` (global `declare global`). `window.synAPI: SynAPI` declared globally. Compile with `tsc` (emit) to `dist/renderer/app.js` etc. HTML `<script src="app.js">` still works if we keep HTML at repo root referencing `renderer/app.js` — but compiled output goes to `dist/renderer/app.js`. Either update HTML to `dist/renderer/app.js`, or keep source-relative by not emitting renderer to dist. 

Simplest consistent story: `tsc` emits everything to `dist/` preserving structure; `index.html` (copied or referenced at `dist/renderer/index.html`) loads `dist/renderer/app.js`. `main.ts` `loadFile(path.join(__dirname, 'renderer', 'index.html'))` — `__dirname` is `dist/`, so this loads `dist/renderer/index.html`. So we must also emit/copy `renderer/index.html`, `brain-vault.html`, `style.css`, `assets/` into `dist/`. `electron-builder` copies `renderer/` and `assets/` as "extra resources" or we add a `copyfiles` step.

To keep the migration scope manageable, the guide will specify:

- `tsc` emits JS to `dist/` preserving `packages/`, `scripts/`, `renderer/`.
- A `copy-assets` step (or electron-builder `extraResourcesfiles`) copies `renderer/*.html`, `renderer/style.css`, `assets/` to `dist/`.
- `main.ts` loads `path.join(__dirname, 'renderer', 'index.html')` (works since `__dirname` = `dist` and `dist/renderer/index.html` exists).
- `preload: path.join(__dirname, 'preload.js')`.

This is an implementation detail; the critical contract is type-checking + identical runtime behavior.

**### P6.2 Convert** `renderer/app.ts`

No imports (global script). Types:

- `declare const synAPI: SynAPI` — via global `window.synAPI`. Access as `window.synAPI` or `const synAPI = window.synAPI` (current code does `const synAPI = window.synAPI`).
- DOM element types: `HTMLInputElement`, `HTMLDivElement`, `HTMLButtonElement`, etc., via `document.getElementById('x') as HTMLInputElement | null`. Current code uses `document.getElementById(...)` without null checks — in TS with `strictNullChecks`, add `!` non-null assertions or null guards. Preserve behavior: assume elements exist (they do in index.html).

**State variables:** type them:

```ts

let allSessions: any[] = []

let selectedSessionId: string | null = null

let menuOpen = false

let brainmaxxingOpen = false

let currentMode: 'code' | 'brain' = 'code'

let batchSize: number = 10

let harnessSettings: Record<string, boolean> = {}

let ctxTargetSessionId: string | null = null

let pendingConfirm: (() => void | Promise<void>) | null = null

const terminalHistory: string[] = []

let terminalHistoryIndex: number = -1

let searchQuery: string = ''

```

**Terminal command parsing:** `executeTerminalCommand(raw: string)` — the `switch (cmd)` with cases `/locate`, `/reflect`, etc. Preserve exactly. `parseSearchFilters(raw: string): { query: string; options: Record<string, any> }` — same logic.

`performSearch()`*:** calls `synAPI.searchSessions(query, { batchSize, ...options })` and `searchBrainVault(raw)`.

`searchBrainVault(query: string): Promise<any[]>`* — reads vault files via `synAPI.brainList()synAPI.brainRead()`, scores, returns results. Preserve.

**Rendering functions:** `renderSearchResultsList(results, query)`, `renderSessionList(sessions)`, `loadSessionContent(session)`, `loadVaultContent(result)`, `renderMessages(messages)`, `renderSearchResults(results)`, `appendTerminalLine(text, type)`, `highlightText(html, query)`, `escapeHtml(text)`, `updateModeUI()`, `switchMode(newMode)`, `checkDbHealth()`, `updateTogglePosition()`, resize handlers `startResizeendResizedoResize`), `init()`, `loadSessions()`, `scanAndAutodetectHarnesses()`, `renderHarnesses()loadHarnesses()`, `renderHarnessSettings()`, `showBrainResult(title, result)`, `showConfirmhideConfirm`, `closeSession()`.

**Event listeners:** terminalInput keydown, searchInput keydown, button clicks, contextmenu, Escape keydown, arrow navigation, mousemove/mouseup for resizers, `document.readyStateDOMContentLoaded`.

**Type** `session` **objects:** `{ id, session_id, title, harness, source_path, file_path, created_at, indexed_at, rank?, snippet?, excerpt?, source?, path?, matchScore? }` — type as `Record<string, any>` or a `SessionRecord` interface to keep it simple.

`setStatusLoadingsetStatusIdle`*:** `statusIndicatorImg.src = '../assets/idle.gif'` — relative path works at runtime from `renderer/`; after compile to `dist/renderer/app.js`, the relative `../assets/` resolves to `dist/assets/` — ensure assets copied to `dist/assets/`. Or change to absolute via `path` — not available in renderer. Keep `../assets/idle.gif` and copy assets to dist.

**### P6.3 Convert** `renderer/brain-vault.ts`

No imports (global script). Uses `window.synAPI` (current code does `const _synAPI = window.synAPI`).

**State:** `brainFiles: string[]`, `nodes: Map<string, {id,label,x,y,vx,vy,fixed}>`, `edges: Array<{source,target}>`, `selectedNode`, `hoveredNode`, `ctxTargetNode`, `ctx` (CanvasRenderingContext2D | null), `scale`, `offsetX`, `offsetY`, flags, `noteDirty: Map<string, boolean>`, `noteContentMap: Map<string, string>`, `noteFileMap: Map<string, string>`, `notesOpening: Set<string>`, `pendingCloseTabId: string | null`, `brainVaultInitialized: boolean`, `loadBrainVaultRunning: boolean`, `isResizing`, `resizeEdge`, etc.

**Functions:** `startResizeonResizeMoveonResizeUp` (use `_synAPI.brainVaultWindowGetBounds/SetBounds`), `init`, `loadBrainVault` (large — force-directed layout, [[wikilink]] extraction via regex `/\[\[([^\]]+)\]\]/g`), `resizeCanvas`, `recenterGraph`, `centerGraph`, `worldToScreenscreenToWorld`, `getNodeAt`, `drawNode`, `resolveLabelOverlaps`, `drawEdge`, `render` (requestAnimationFrame loop), `renderNoteContent`, `openNote`, `createBvTab`, `startEditMode`, `saveNote`, `closeNoteTabdoCloseTab`, `switchBvTab`, `startRenamehideRename`, `loadBrainIndexContent`, `showCreatehideCreate`, `showImporthideImport`, `showCreateGroup`, `confirmDelete`, `checkUnsavedClose`, `hideConfirm`, `escapeHtml`, `escapeCssId`.

**DOM typing:** `document.getElementById('bvGraphCanvas') as HTMLCanvasElement`, `ctx = canvas.getContext('2d')`, `ctx` may be null — guard `if (!ctx) return`.

**Event listeners:** canvas mousedown/mousemove/mouseup/wheel, button clicks, overlays, `beforeunload`, `window loadresize`.

`loadBrainVault` *idempotency guard** and `brainVaultInitialized` flag — preserve.

**### P6.4 HTML script references**

`renderer/index.html` ends with `<script src="app.js"></script>`. After compile, if HTML is at `dist/renderer/index.html`, `<script src="app.js">` resolves to `dist/renderer/app.js` — consistent. `brain-vault.html` similarly `<script src="brain-vault.js"></script>`.

CSS `renderer/style.css`) is NOT converted — stays `.css`, copied to dist.

**### P6.5 Validation loop**

```bash

npx tsc --noEmit          # type-check everything incl. renderer

npx eslint renderer --ext .ts --max-warnings 0

tsc                       # emit to dist/

# copy renderer html/css + assets to dist (see P5 layout)

npm start                 # Electron launches; verify UI behaviors

```

Manual verification checklist for P6:

- [ ] Terminal opens, `/help` lists commands, `/locate <query>` returns results.

- [ ] Clicking a result opens the session; meta (harness/session id/path) shows.

- [ ] Header search bar searches + highlights.

- [ ] Brainmaxxing buttons (/reflect etc.) work with a session selected.

- [ ] Context menu (Archive on Vault / Copy Session ID / Delete Entry) works.

- [ ] Column resizers + terminal toggle work.

- [ ] Mode switcher (Syn Code / Syn Brain) toggles panels.

- [ ] DB health badge + Rebuild button work.

- [ ] Brain Vault window opens (btnBrain), graph renders nodes, note tabs open/edit/save/rename/delete, context menus, import.

Next: Part 9 — Phase P7 (tests) + P8 final review.  
**# [migration.md](http://migration.md) — Syn: 100% Native TypeScript Migration Guide (Part 9: Phase P7 Tests + Phase P8 Final Review)**

Continues from Part 8. Append after Part 8.

---

**## Phase P7 — Convert** `test/*.js` **to** `test/*.ts`

**Goal:** Convert all 13 test files to TypeScript and run them via `tsx` so `npm test` produces identical results. Tests assert behavior of the now-TS source.

**Exit criteria:** Full `npm test` passes with identical counts to the pre-migration baseline:

- search.test.js: 13/13 (verify exact count in file)
- search-quality.test.js: 24/24
- validator-precision.test.js: 65/65
- fixture-tests.js: 47/47
- indexing.test.js: all pass
- security.test.js: all pass
- brainmaxxing.test.js: 89/89
- session-delete.test.js: 10/10
- g3-filter-forwarding.test.js: 30/30
- mcp.test.js: all pass
- real-world-integration.test.js: explicit skips when data absent (env-dependent)

**### P7.1 Conversion approach per test file**

Tests are Node CommonJS scripts using `assert`-style counters `passedfailed`, `console.log PASS/FAIL`). Convert to `.ts`:

1. Rename `.js` -> `.ts`.
2. Add `importrequire` at top. Since `tsx` runs TypeScript and supports ESM/CJS, use `import { IndexingEngine } from '../packages/core/index'` — with `module: commonjs` this compiles to `require`. Alternatively keep `const { IndexingEngine } = require('../packages/core/index')` to minimize diff; `tsx` handles both.
3. Type test locals `let passed = 0`, `let failed = 0`, temp dirs as `string`, DB paths as `string`).
4. `strictNullChecks`: guard `fs.existsSync`, `fs.statSync` results; use `!` where current JS assumed existence.
5. Assert helper: `function assert(condition: boolean, message: string): void { ... }`.
6. Async `main()` functions typed `async function main(): Promise<void>`.

**Specific notes per file:**

- `test/fixture-tests.ts`: imports `../packages/core/index` and `../packages/adapters/registry` — both converted by P1/P2. Uses `os.tmpdir()`, `fs.copyFileSync`, `fs.mkdtempSync`. Type all paths.
- `test/security.ts`: constructs `new IndexingEngine(dbPath, { redactSecrets, secretPatterns, excludedPaths })`. Match P2 constructor signature.
- `test/brainmaxxing.ts`: imports `../packages/core/brainmaxxing` — P3 converted.
- `test/mcp.ts`: starts MCP server on stdio, sends ListTools/CallTool requests. Imports `mcp-server.ts`? That runs `main()` on import (connects stdio). Instead the test likely spawns `node mcp-server.js` as a child process or imports with care. Preserve whatever mechanism the JS test uses; type child-process handles.
- `test/real-world-integration.ts`: uses real `C:\Users\luizy\...` paths. Keep `test.skip`-style explicit skips when paths absent.

**### P7.2 Update** `package.json` **test script**

```json

"test": "tsx test/search.test.ts && tsx test/search-quality.test.ts && tsx test/validator-precision.test.ts && tsx test/fixture-tests.ts && tsx test/indexing.test.ts && tsx test/security.test.ts && tsx test/brainmaxxing.test.ts && tsx test/session-delete.test.ts && tsx test/g3-filter-forwarding.test.ts && tsx test/mcp.test.ts && tsx test/real-world-integration.test.ts"

```

**### P7.3 Validation loop**

```bash

npx tsc --noEmit          # includes test/ per tsconfig include

npm test                  # all suites; compare counts to baseline above

```

Record actual per-file pass counts in this guide after the first run (baseline comparison). Any count decrease = regression; fix before proceeding.

---

**## Phase P8 — Final Review & Regression ✅ DONE**

**Goal:** Confirm the migration is complete, behavior-preserving, and reviewable by an agent.

**Exit criteria:** All of the following green on a clean checkout:

```bash

git stash -u   # or use a clean clone/checkout

npm ci

npx tsc --noEmit      # 0 errors

npm run lint          # 0 errors, 0 warnings on .js + .ts

npm test              # all suites pass (baseline counts)

npm start             # Electron launches (optional, needs tsc emit + assets copied)

```

**### P8.1 Review checklist (agent applies to every converted file)**

| # | Check |

|---|-------|

| R1 | File renamed `.js` -> `.ts` (no `.js` source remains in `packages/`, `main.ts`, `preload.ts`, `mcp-server.ts`, `renderer/*.ts`, `scripts/*.ts`, `test/*.ts`) |

| R2 | No `requiremodule.exports` remaining where `importexport` could be used (optional; CommonJS allowed where runtime needs it) |

| R3 | Function params + returns have explicit types (no implicit `any` errors from tsc) |

| R4 | `strictNullChecks` respected — no `.property` on possibly-null values without guard |

| R5 | Runtime behavior unchanged (same IPC channel names, same MCP tool names/schemas, same search ranking, same test assertions) |

| R6 | `tsc --noEmit` reports no errors for the file |

| R7 | ESLint reports 0 errors / 0 warnings on the file |

| R8 | Related test suite passes (same pass/fail counts as baseline) |

**### P8.2 Regression evidence to capture**

Before marking P8 complete, an agent or reviewer should record:

1. Pre-migration baseline test counts (from `npm test` on the JS version) — from [nextphase.md](http://nextphase.md) Phase 12: search 13/13, search-quality 24/24, validator-precision 65/65, fixture-tests 47/47, security 34/34 (phase 8 said 14+ expanded), brainmaxxing 89/89, session-delete 10/10, g3-filter-forwarding 30/30, indexing 25/25.
2. Post-migration `npm test` counts — must match.
3. `npx tsc --noEmit` output — clean.
4. `npx eslint . --ext .js,.ts --max-warnings 0` — 0 errors, 0 warnings.

**### P8.3 "Nothing lost" verification matrix**

Confirm each Syn capability still exists post-migration:

| Capability | Pre (JS) | Post (TS) | Verified by |

|------------|----------|-----------|-------------|

| Indexing engine (search, BM25, filters) | `packages/core/index.js` | `packages/core/index.ts` | search/security/indexing tests |

| 12 harness adapters | `packages/adapters/*.js` | `packages/adapters/*.ts` | fixture-tests (47) |

| Brainmaxxing /reflect.. /review + containment | `packages/core/brainmaxxing.js` | `packages/core/brainmaxxing.ts` | brainmaxxing tests (89) |

| Electron main + IPC (~40 handlers) | `main.js` | `main.ts` | app launch + manual UI check |

| preload synAPI bridge | `preload.js` | `preload.ts` | renderer loads |

| MCP server 16 tools stdio | `mcp-server.js` | `mcp-server.ts` | mcp.test |

| Renderer UI (terminal, search, reader, vault) | `renderer/app.js`, `brain-vault.js` | `.ts` | `npm start` manual check |

| Tests | `test/*.js` | `test/*.ts` | `npm test` |

**### P8.4 Completion**

When all P8 criteria are met, the migration is complete: Syn is a 100% native TypeScript application (source in `.ts`, compiled to JS for Electron/runtime), behavior identical to the pre-migration version, with full type-checking, linting, and test coverage. Update `nextphase.md` to record the migration as done, then proceed to any post-v1 phases (Phase K: SQLCipher, native FTS5, etc.) as desired.

---

**End of [migration.md](http://migration.md).**  