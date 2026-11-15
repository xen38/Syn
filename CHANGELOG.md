# Changelog

All notable changes to Syn are documented in this file.

## [1.0.0] — 2026-11-14

### Phase 0 — Project Setup & Rename
- Renamed app from Locate to Syn (package.json, main.js, preload.js, renderer/).
- Local folder kept as `K:\Repos\locate` (user-directed).
- Engine name `locate` kept internally; human-facing copy uses "Syn".

### Phase 1 — Memory Vault & Brainmaxxing Port
- Created `brain/` vault (index.md, principles.md, codebase/, memories/, plans/, sessions/).
- Added `packages/core/brainmaxxing.js` with reflect/meditate/ruminate/plan/review/brainRead/brainWrite/brainList/rebuildIndex.
- Wired brainmaxxing into main.js IPC, preload.js synAPI, renderer/app.js menu buttons.
- Session-start hook: `injectBrainIndex()` reads brain/index.md at launch.
- Auto-index hook: `watchBrainIndex()` rebuilds index.md on .md changes.

### Phase 2 — Terminal UI Revision
- Terminal replaces search bar; `/locate`, `/reflect`, `/meditate`, `/ruminate`, `/plan`, `/review`, `/brain`, `/syn`, `/help` commands.
- Search bar restored at top (search-only, no terminal features); terminal in its own right column.
- Search result highlighting via `.highlight` CSS class.

### Phase 3 — MCP Server
- Renamed all tools from `locate_*` to `syn_*` (17 tools total).
- Added 7 brainmaxxing MCP tools.
- Full case handler bodies; smoke-tested.

### Phase 4 — /syn Skill
- Created `/syn` skill at `skills/syn/skill.md`.
- Mirrored to `.agents/skills/syn/SKILL.md`.

### Phase 5 — Skill Consolidation
- Consolidated skills under `skills/` directory; removed old root-level `skill/`.

### Phase 6 — CI/CD
- Added `.github/workflows/ci.yml` (install, lint, test on push/PR).
- Added `.github/workflows/release.yml` (electron-builder Windows/macOS/Linux).
- Resolved `better-sqlite3` native module build.

### Phase 7 — Fixture Tests
- Created `test/fixtures/` with 12 harness sample archives.
- Created `test/fixture-tests.js` (47 passed, 0 failed).
- Fixed `better-sqlite3` to `^13.2.0`.

### Phase 8 — Privacy & Security
- `DEFAULT_SECRET_PATTERNS` (7 patterns) + `redactSecrets()`.
- Constructor options: `redactSecrets`, `secretPatterns`, `excludedPaths`.
- `_isExcluded()` method; redaction applied in indexing loops.
- `test/security.test.js` (14 passed, 0 failed).

### Phase 9 — Search Quality
- BM25-style ranking + snippets + filters (harness/date/role/brain).
- All search tests pass (37 passed, 0 failed).

### Phase 10 — Engineering Hygiene
- Enforced CI lint (removed `|| true` from ci.yml).
- Tidied root: `scripts/` created, `setup-dbs.js` moved.
- License mismatch resolved: GPL-3.0 → MIT LICENSE.
- JSDoc added to all `packages/core/` files.
- `npm run lint` passes with 0 errors, 0 warnings.
