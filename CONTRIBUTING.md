# Contributing to Syn

Syn is a unified agent memory environment: search sessions + Memory Vault via the `/locate` engine and brainmaxxing console. This guide covers the development workflow and how to write a new harness adapter.

## Development Workflow

Follow this loop for every change:

```
BUILD → TEST → FIX → DOCUMENT → COMMIT → PUSH
```

1. **BUILD** — Make your code change.
2. **TEST** — Run `npm test` and `npm run lint`. Both must pass clean.
3. **FIX** — Address any test or lint failures.
4. **DOCUMENT** — Update `nextphase.md` progress log and any affected docs.
5. **COMMIT** — Commit with a descriptive message (phase-focused).
6. **PUSH** — Push to `origin/main`.

### Available scripts

| Script | Purpose |
|--------|---------|
| `npm start` / `npm run dev` | Launch the Electron app |
| `npm run build` | Build installer via electron-builder |
| `npm test` | Run the full test suite |
| `npm run lint` | Run ESLint with zero warnings allowed |

## Writing a New Harness Adapter

Syn discovers and indexes agent conversation archives (sessions) from many AI coding harnesses (Cline, Cursor, Codex, Claude Code, etc.). Each harness has its own adapter that implements discovery, parsing, and text extraction.

### Adapter anatomy

Adapters live in `packages/adapters/`. Every adapter extends `BaseAdapter` (`packages/adapters/base.js`) and implements:

- `canHandle(filePath)` — Return `true` if this adapter can handle a file by extension.
- `discover(dirPath)` — Recursively find session files in a directory (inherited from `BaseAdapter`; override only if special handling is needed).
- `parseSession(filePath)` — Parse a session file into `{ sessionId, title, createdAt, messages: [], filePath, harness }`.
- `extractText(filePath)` — Return full text content of a file for indexing.

### Example: a minimal text adapter

```js
const path = require('path')
const { BaseAdapter } = require('./base')

class MyHarnessAdapter extends BaseAdapter {
  constructor (options = {}) {
    super({
      name: options.name || 'MyHarness',
      harness: options.harness || 'MyHarness',
      extensions: ['.json', '.jsonl'],
      ...options
    })
  }

  parseSession (filePath) {
    const content = this._readFile(filePath)
    const sessionId = path.basename(filePath, path.extname(filePath))
    // ... parse content into messages ...
    return {
      sessionId,
      title: 'Session Title',
      createdAt: '',
      messages: [],
      filePath,
      harness: this.harness
    }
  }

  extractText (filePath) {
    return this._readFile(filePath)
  }
}

module.exports = { MyHarnessAdapter }
```

### Registering the adapter

Adapters are registered through `AdapterRegistry` in `packages/adapters/registry.js`. Add your adapter to the registry so the engine discovers it when indexing a source directory:

```js
const registry = new AdapterRegistry()
registry.register('MyHarness', new MyHarnessAdapter({ name: 'MyHarness', harness: 'MyHarness' }))
```

### Rules

- **Read-only**: Original archive files are never modified. All access is read-only.
- **Graceful failure**: Corrupted or unparseable files must be skipped without aborting the whole indexing run.
- **Fingerprinting**: Use `_fingerprint(filePath)` (from `BaseAdapter`) for incremental indexing — unchanged files are skipped on re-index.

## Submitting Changes

1. Fork or branch from `main`.
2. Make your change following the workflow above.
3. Add or update tests in `test/` if you change behavior.
4. Open a pull request against `main`.
5. Ensure CI passes (lint + tests on every push).

## Code Style

- CommonJS modules (`require` / `module.exports`).
- No semicolons, single quotes, 2-space indent (ESLint `standard` config).
- No console statements in production code paths (except intentional logging in `main.js`/`mcp-server.js`).
- JSDoc comments on all public methods and classes.