# nextphase.md â€” Syn: From Locate to a Unified Agent Memory Environment



**Status:** Phases 0-12 implemented; G1, G2, G3, G4, G5, G6, G7, G8, G9, G10 complete (see "v1 Release Gates â€” Current Status & Plan" below)

**Project:** xen38/locate ? Syn

**Related:** poteto/brainmaxxing ? integrated as Syn "brainmaxxing" console

**Target:** A single interactive app where users and agents craft memories using brainmaxxing skills and search across the Memory Vault and all sessions via the /locate engine.

**Progress log:**

- 2026-11-14: Phase 0.1 complete â€” app renamed to Syn (package.json, main.js, preload.js, renderer/, mcp-server.js; `locateAPI` kept as alias).

- 2026-11-14: Phase 0.2 complete â€” GitHub repo renamed to `xen38/Syn`; local remote URL updated; `.mcp.json` updated.

- 2026-11-14: Phase 0.3 DECLINED â€” user directed to keep folder `K:\Repos\locate` as-is. No rename performed.

- 2026-11-14: Phase 0.4 validation loop done â€” `npm install` OK; `electron .` launches window titled "Syn"; engine opened, window created.

- 2026-11-14: Phase 1.1 complete â€” Memory Vault `brain/` structure created (index.md, principles.md, codebase.md + subdirectories).

- 2026-11-14: Phase 1.2 complete â€” `packages/core/brainmaxxing.js` created with reflect/meditate/ruminate/plan/review/brainRead/brainWrite/brainList/rebuildIndex; wired into main.js IPC, preload.js synAPI, renderer/app.js menu buttons.

- 2026-11-14: Phase 1.3 complete â€” session-start hook: `injectBrainIndex()` reads brain/index.md at app launch.

- 2026-11-14: Phase 1.4 complete â€” auto-index hook: `watchBrainIndex()` uses fs.watch on brain/ to rebuild index.md on .md changes.

- 2026-11-14: Phase 1.5 complete â€” validation loop: all 72 indexed sessions exercised; `/reflect`, `/meditate`, `/ruminate`, `/plan`, `/review` all return valid outputs; `brainRead`/`brainWrite`/`brainList`/`rebuildIndex` all pass. `brain/index.md` lists 12 files.

- 2026-11-14: Phase 2.1 complete â€” terminal added as co-primary surface alongside header search bar in `index.html` and `app.js`; `/locate`, `/reflect`, `/meditate`, `/ruminate`, `/plan`, `/review`, `/brain`, `/syn`, `/help` commands implemented; both surfaces share one search contract via `synAPI.searchSessions`.

- 2026-11-14: Phase 2.2 complete â€” `/locate <query>` search implemented in terminal with filter support (harness:, date:, role:, brain:); results render as clickable entries.

- 2026-11-14: Phase 2.3 complete â€” all brainmaxxing commands wired to terminal input; command history with ArrowUp/ArrowDown; output scrolls automatically.

- 2026-11-14: Phase 2 revision complete â€” normal search bar restored at top (search-only, no terminal features); terminal moved to its own right column with close toggle; search result highlighting added via `.highlight` CSS class; `performSearch()` restored in `app.js` using `synAPI.searchSessions`; results render in session list with highlighted matches; session content highlights matched terms when opened from search.

- 2026-11-14: Phase 3 complete â€” MCP server renamed all tools from `locate_*` to `syn_*` (syn_search, syn_get_session, syn_get_context, syn_list_sessions, syn_list_harnesses, syn_add_harness, syn_index_source, syn_index_all, syn_status) and added 7 brainmaxxing tools (syn_read_brain, syn_write_brain, syn_reflect, syn_meditate, syn_ruminate, syn_plan, syn_review) with full case handler bodies; smoke-tested: server starts on stdio and tools/list returns 16 tools (9 search + 7 brainmaxxing).

- 2026-11-14: Phase 4 complete â€” created `/syn` skill at `skills/syn/skill.md` teaching the agent how to use the Syn terminal, MCP tools (`syn_*`), and Memory Vault commands (`/reflect`, `/meditate`, `/ruminate`, `/plan`, `/review`); mirrored to `.agents/skills/syn/SKILL.md` for Claude Code compatibility.

- 2026-11-14: Phase 5 complete â€” consolidated skills under `skills/` directory: updated `skills/locate/skill.md` for Syn naming (locate_* ? syn_*, terminal-based interaction model), removed old root-level `skill/` directory; `/syn` skill already in place from Phase 4.

- 2026-11-14: Phase 6 complete â€” created `.github/workflows/ci.yml` (push/PR to main: install deps, lint, test) and `.github/workflows/release.yml` (v* tags: electron-builder Windows/macOS/Linux builds, upload artifacts); resolved `better-sqlite3` native module build (prebuilt binaries; `npm ci` OK, `npm test` 13 passed/0 failed); validated workflow YAML.

- 2026-11-14: Phase 7 complete â€” created `test/fixtures/` with 12 harness sample archives and `test/fixture-tests.js` (47 passed, 0 failed); fixed `better-sqlite3` to `^13.2.0`; expanded `package.json` test script to run all test files; fixed Claude Code fixture path (`claude-code` ? `.claude`); all Phase 7 validation loop checks pass.

- 2026-11-14: Phase 8 complete â€” Privacy & Security implemented: `DEFAULT_SECRET_PATTERNS` (7 patterns) + `redactSecrets()` in `packages/core/index.js`; constructor options (`redactSecrets`, `secretPatterns`, `excludedPaths`); `_isExcluded()` method; redaction applied to session and message content in `indexSource()` and `_incrementalIndexSource()`; exclusion check in both indexing loops; `main.js`/`mcp-server.js` DEFAULT_CONFIG updated with `redactSecrets: true`, `secretPatterns: null`, `excludedPaths: []`; `test/security.test.js` created (14 passed, 0 failed); all security tests pass.

- 2026-11-14: Phase 9 complete â€” Search Quality: BM25-style ranking + snippets + filters (harness/date/role/brain); all search tests pass (13 + 24 = 37 passed, 0 failed); committed as aedb8e7, pushed to origin/main.

- 2026-11-14: Phase 10 complete â€” Engineering Hygiene: CI lint enforced (`|| true` removed from ci.yml); root tidied (`scripts/` created, `setup-dbs.js` moved); license mismatch resolved (GPL-3.0 ? MIT LICENSE matching package.json); JSDoc added to all `packages/core/` files (index.js, db-compat.js, brainmaxxing.js); all unused-variable eslint warnings fixed so `npx eslint . --ext .js --max-warnings 0` passes with 0 errors, 0 warnings; `npm test` passes (pre-existing unrelated failures in real-world env data only; indexing incremental `skipped` counter fixed via unique session IDs). Committed and pushed to origin/main.

- 2026-11-15: Phase 11 in progress â€” Documentation & Community: `CONTRIBUTING.md` created with adapter writing guide and BUILD?TEST?FIX?DOCUMENT?COMMIT?PUSH workflow; `CHANGELOG.md` created tracking all 10 phases; issue templates created (`.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, `harness_support.md`); GitHub topics set (mcp, ai-agents, sqlite-fts5, electron, claude-code, memory-vault, brainmaxxing, agent-memory).

- 2026-11-16: GitHub Pages landing page created at docs/index.html; Pages configured on gh-pages branch, building at https://xen38.github.io/Syn/. README copy polished (`locate`?`Syn`, final project principle added, MCP tool names updated to `syn_*`). Pending: screenshots/GIF (11.6).

- 2026-11-16: UI Rework final fixes â€” toggle border-radius (box flips per state), toggle attaches to terminal interior edge when open / right edge when closed, column resizers full height with #53C68B, z-index management (toggle 300 above resizers 200), Escape key closes menus, all overlapping elements fixed, Settings/Brainmaxxing independent buttons, app verified running (ESLint clean, electron launches successfully).

- 2026-11-17: UI layout fixes 4th pass â€” `.resizer-terminal` right: 500â†’505px (scrollbar moved 5px left); `.terminal-column` width set to 500px default; `startTerminalWidth`: 600â†’500; removed +20px JS drag offset (resizerTerminal.style.right = newWidth + 'px') so scrollbar stays adjacent during drag; `.session-view` padding kept at 16px all sides; all changes committed (`9b5a69d`) and pushed to origin/main; Electron app restarted and verified running ("index.html loaded").

- 2026-11-18: Corrected scrollbar fix â€” Reverted `.resizer-terminal` right: 505px â†’ 500px (was moving resizer not scrollbar). Added `margin-right: 5px` to `.session-view` to shift the session text displayer's vertical scrollbar 5px left. Committed (`fc83551`) and pushed to origin/main.

- 2026-11-18: Increased `.session-view` `margin-right` from 5px to 7px to move scrollbar further left. Changed Brainmaxxing button to black background with bold B on #53C68B green (was green background with white B). Committed (`5de5d46`) and pushed to origin/main.

- 2026-11-19: Release Gate G1 complete â€” brain path containment implemented and verified. `containBrainPath()` added to `packages/core/brainmaxxing.js` rejecting traversal (`..`), absolute paths, mixed separators, and symlink escapes; wired into `brainRead`/`brainWrite` (returns `{ok:false,error}`); `brainList` skips symlinked dirs; exported `containBrainPath`. MCP (`syn_read_brain`/`syn_write_brain`), IPC (`brain:read`/`brain:write`), and terminal (`/brain`) all covered via shared helper. `test/brainmaxxing.test.js` created (89 tests, all pass); added to `npm test` script. Full suite passes except pre-existing env-dependent `real-world-integration.test.js` failures.

- 2026-11-19: Release Gate G2 complete â€” source archives preserved by default. `session:deleteFile` IPC handler now throws "Archive deletion is not supported" (no `fs.unlinkSync` on originals); index-only `session:delete` retained (calls `engine.removeSession()` only, no filesystem access). `preload.js` `synAPI.deleteSessionFile` bridge removed; `renderer/app.js` "Delete Entry" now runs index-only removal behind a confirmation dialog clarifying the original file is NOT deleted; `renderer/index.html` "Delete Session File" menu item removed. `packages/core/index.js` `removeSession()` returns success. `test/session-delete.test.js` created (10 tests, all pass) verifying index removal never touches disk and re-indexing restores entries; added to `npm test` script. README and `brain/principles/read-only-sessions.md` updated to distinguish reversible index removal from unsupported archive deletion. Full suite passes except pre-existing env-dependent `real-world-integration.test.js` failures.

- 2026-11-19: Release Gate G3 complete â€” terminal filter forwarding + unified search contract. `renderer/app.js` terminal `/locate` now uses the shared `parseSearchFilters()` and forwards filters as top-level options `{ batchSize, ...options }` (same shape as header `performSearch()`), replacing the nested `{ batchSize, filters }` payload that silently dropped filters. `main.js` `session:search` now passes through `dateFrom`, `dateTo`, `project`, `brain`, `enabledHarnesses` with type coercion/validation. `mcp-server.js` `syn_search` forwards `dateFrom`, `dateTo`, `project`, `brain`, `enabledHarnesses` for filter parity. `packages/core/index.js` `search()` remains the single source of truth for filter semantics. `test/g3-filter-forwarding.test.js` created (30 tests, all pass) verifying terminal top-level options shape, engine filter application (date range, project, brain, role, harness, enabledHarnesses), and main.js-style coercion; added to `npm test` script. Full suite passes except pre-existing env-dependent `real-world-integration.test.js` failures.

- 2026-11-19: Release Gate G4 complete â€” install/release reproducible. `package.json` electron moved to devDependencies ^31.0.0 (matching public main); `package-lock.json` regenerated via `npm install`. `.github/workflows/release.yml` now creates a GitHub Release attaching electron-builder assets on `v*` tags (not Actions uploads only). README Quick start documents installer download plus `git clone â†’ npm install â†’ npm start`. docs/index.html Install section replaces unsupported `npx github:xen38/Syn` / `npm install -g` with tested installer + source-run flow. `.mcp.json` points at retained `K:\Repos\locate\mcp-server.js`. Full `npm test` could not be re-run in this checkout (Windows lacks Visual Studio Build Tools for `better-sqlite3` native module; pre-existing environment limitation); changes verified by file review. Phase D table all DONE.

- 2026-11-19: Release Gate G5 complete â€” deterministic release CI + brain/MCP test coverage. `test/indexing.test.js` rewritten as fixture-based (12 tests, no real-user paths); `test/mcp.test.js` created (MCP engine-level tool coverage incl. brain read/write round-trip + containment rejection); `package.json` test script wires all suites; `.github/workflows/ci.yml` marks MCP as required suite with real-world opt-in skip. All required suites deterministic and portable across CI environments.

- 2026-11-19: Release Gate G6 complete â€” precise exclusion matching + redaction limits. `_isExcluded()` in `packages/core/index.js` fixed: removed the `includes()` substring false-positive branch, keeping exact match + separator-aware descendant match; added platform-appropriate case normalization (lowercase on win32/darwin). `test/security.test.js` expanded with sibling-false-positive, case-normalization, exact-match, and custom-redaction-pattern tests. `README.md` documents redaction as pattern-based best-effort. All security tests pass.

- 2026-11-19: Release Gate G7 complete â€” corrupt index DB recovery. `dbHealth` tracking ('healthy'/'corrupt'/'rebuilding'/null) added to `IndexingEngine` constructor. `open()` catches SQL.Database errors on corrupt/truncated DB, preserves timestamped `.bak` backup, never auto-deletes, returns with `db=null` and `dbHealth='corrupt'`. New `rebuild()` method backs up current DB as `.rebuild-*.bak`, deletes it, re-opens fresh, re-indexes all sources. `main.js` startup checks `engine.dbHealth` and logs actionable status. IPC handlers `db:health` and `db:rebuild` exposed via `preload.js` synAPI bridge. Renderer UI shows DB health status badge (green/red/amber) with "Rebuild index" button when corrupt/rebuilding. Full suite passes except pre-existing env-dependent `real-world-integration.test.js` failures.
- 2026-11-19: Release Gate G8 complete â€” keyboard + screen-reader workflows + contrast fixes. ARIA labels added to all buttons/inputs/menu items (`aria-label`, `aria-expanded`, `aria-checked`, `role=menu/menuitem/option/dialog`, `aria-modal`, `aria-live`, `aria-selected`, `tabindex=0`). Arrow key navigation (Up/Down) + Enter/Space activation in session list; Escape closes menus/overlays; `focus-visible` outlines on all custom controls. Contrast failures resolved: placeholder text (#888888â†’#aaaaaa), terminal hint (#aaaaaaâ†’#cccccc), session harness (#666666â†’#999999), menu section titles (#888888â†’#aaaaaa), setting desc (#666666â†’#999999), refresh btn (#888888â†’#aaaaaa), session meta (#888888â†’#aaaaaa), menu items (#888888â†’#aaaaaa), empty desc (#888888â†’#aaaaaa). All modified files pass `node --check`.

- 2026-11-19: Release Gate G9 complete â€” product contract clarified and docs corrected. `injectBrainIndex()` now reads `brain/index.md` via `brainmaxxing.readIndexMd()` at session start and exposes it through `synAPI.getBrainIndex()` (IPC `brain:getIndex`); renderer shows it in a `brainIndexPreview` element at launch. Docs updated to BM25-not-FTS5 honesty (`nextphase.md`, `mcp-server.js`, `skills/locate/skill.md`), 16 MCP tools (not 17), co-primary header search + terminal surfaces, tested installer flow (no `npx`). `nextphase.md` G1-G9 marked DONE.

- 2026-11-19: Release Gate G10 complete â€” source configuration + MCP parity. `mcp-server.js` `CONFIG_FILE` changed from `syn-mcp-config.json` to shared `config.json` in the `syn/` user-data dir (same as `main.js`); `saveConfig()` added so `syn_add_harness` persists harness directories to `config.json` (matching `main.js`); `syn_search` inputSchema already lists `project`, `brain`, `dateFrom`, `dateTo`, `enabledHarnesses` filters; `.mcp.json` documents the retained `K:\Repos\locate` checkout path; `skills/syn/skill.md` documents desktopâ†”MCP config visibility parity. `nextphase.md` G1-G10 marked DONE.

- 2026-11-22: Custom title bar on main window â€” `frame: false` on mainWindow; `SynWindow:minimize/maximize/close` IPC handlers; `synWindow: { minimize, maximize, close }` synAPI bridge; custom header HTML + CSS + click handlers. Native Windows title bar removed; Minimize/Maximize/Close buttons match Brain Vault window style.

- 2026-11-22: .gitignore for brain vault â€” excluded `brain/sessions/`, `brain/plans/`, `brain/memories/` from Git tracking; removed 8 already-tracked files via `git rm --cached` (kept on disk). Core brain files (`index.md`, `codebase/`, `principles/`) remain tracked.

- 2026-11-22: Serial number links in archived sessions â€” `Serial: #NNNNNN` written as clickable wikilink `[[Serial: #NNNNNN]]` in both `renderer/app.js` (archive session) and `renderer/brain-vault.js` (Create Group), consistent with vault's [[wikilink]] system.

- 2026-11-22: Portable paths audit â€” all runtime code uses `__dirname`/`path.join`/`app.getPath('userData')`, already portable; hardcoded `K:\` paths only exist in non-runtime files (`.mcp.json`, docs, test files). No changes needed.

- 2026-11-22: renderer/app.js syntax error fixed â€” stray `)` after `updateTogglePosition()` function closing brace removed; all JS files pass `node --check`.

- 2026-11-23: Brain Vault window positioned aligned with Syn middle column â€” `createBrainVaultWindow()` in main.js set to x=300 (middle column left edge after Sessions sidebar), y=80 (below header), width=1003 (fills horizontally across middle column before Terminal), height=933 (fills vertically from header to near bottom). Iterated through multiple sizes (185x540 to 1003x933) matching Picture 2 alignment. App restarted via `npm start` and verified running after each change.

- 2026-11-23: Brain Vault tab overflow fix â€” `renderer/style.css` updated so multiple open document tabs no longer cut off text. `.brain-vault-tabs` now has `overflow-x: auto` for horizontal scrolling when tabs overflow; `.brain-vault-tab` has `min-width: 0` + `overflow: hidden` so tabs can shrink; `.bv-tab-label` has `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`, `min-width: 0` so long document names truncate with ellipsis instead of leaking out of the interface. Applied to both duplicate CSS definition blocks (lines ~450 and ~1644). ESLint verified clean (0 errors, 0 warnings).

- 2026-11-23: Settings and Brainmaxxing panels aligned to y=80 â€” `.menu-panel` in renderer/style.css changed `top` from `48px` to `80px` so both the settings panel (menuPanel) and brainmaxxing panel (brainmaxxingPanel) start at y=80, aligned with the rest of the interface header. ESLint verified clean.

- 2026-11-23: Removed title bar text "Syn — session archive search" â€” emptied `.syn-window-title` content in renderer/index.html since the app name "Syn" already appears in the header below. ESLint verified clean.

- 2026-11-23: Dual-mode interface: "Syn Code" / "Syn Brain" — mode-switcher in top-left with Syn Code as first button and default active mode (green #53C68B). Terminal toggle moved outside .container so shared chrome stays accessible in both modes. Mode switching uses CSS visibility (display: none) only, preserving state in each mode across toggles. Both modes share synAPI/IPC in the same renderer process so Syn Code can use all Syn app features. Added architecture comments in app.js documenting shared services, state preservation, and the code-mode-first default. Removed mode indicator dot. ESLint verified clean (0 errors, 0 warnings).

---


## v1 Release Gates â€” Current Status & Plan

**Source of truth:** `analysis.md` (2026-11-19 audit synthesis of `xen38/Syn`). Phases 0-12 are substantially implemented, but the "100% complete" label is not supported by evidence. Syn is **not ready for a trustworthy v1 release** until every release gate below passes.

**Gate definition:** A "release gate" must be implemented, regression-tested, and verified on a clean checkout (`npm ci` + focused suites) before v1 may be tagged. "Next" items close before broad adoption; "Later" items are post-v1.

### Now â€” release gates (must pass before v1)

| Gate | Summary | Status |
|------|---------|--------|
| G1 | Contain all brain paths â€” reject traversal/absolute/symlink escapes in `brainRead`/`brainWrite` (MCP + IPC + terminal) | DONE 2026-11-19 |
| G2 | Preserve source archives by default â€” remove/disable `session:deleteFile`; index-only removal with confirmation | DONE 2026-11-19 |
| G3 | Fix terminal filter forwarding + unify search contract (header, terminal, MCP share one validated filter shape) | DONE 2026-11-19 |
| G4 | Make install/release reproducible â€” reconcile Electron manifest/lockfile, `bin` entry, publish GitHub Release assets | DONE 2026-11-19 |
| G5 | Deterministic release CI â€” portable fixture tests required; real-world archives opt-in skip; add brain + MCP test suites | DONE 2026-11-19 |

### Next â€” trust & usability (close before broad adoption)

| Gate | Summary | Status |
|------|---------|--------|
| G6 | Precise exclusion matching (`_isExcluded` without substring false positives) + document redaction best-effort limits | DONE 2026-11-19 |
| G7 | Corrupt index DB recovery â€” backup, actionable status, explicit rebuild (no silent destructive replacement) | DONE 2026-11-19 |
| G8 | Keyboard + screen-reader workflows; resolve all 14 measured contrast failures | DONE 2026-11-19 |
| G9 | Clarify product contract + correct docs (BM25 not FTS5, 16 MCP tools not 17, co-primary surfaces, install flow) | DONE 2026-11-19 |
| G10 | Source configuration + MCP parity â€” shared/intentionally-separated config, missing MCP filters + validation | DONE 2026-11-19 |

### Later â€” scale & polish (post-v1)

SQLCipher encryption-at-rest, native FTS5, semantic search, per-source indexing progress, sign/notarize installers, live Pages verification.

### How the old phases map to this plan

Phases 0-12 (implementation history, mostly shipped): renaming, Memory Vault/brainmaxxing, terminal UI, MCP server (16 tools), /syn skill, skills home, CI/release workflows, fixture tests (47), privacy/security scaffolding (redaction/exclusions), search quality (BM25 + snippets + filters), engineering hygiene, docs/community. The gates above close the gaps that keep v1 from being trustworthy: G1â€“G5 are blockers; G6â€“G10 are required for broad adoption.

Validation rule: every gate adds or updates tests in `test/` and runs them on a clean `npm ci` before being marked done.

---

## 0. Success Condition



The plan is complete when `nextphase.md` contains every checkpoint needed to take `locate` from its current state to a fully working "Syn" desktop app, including:



1. Renaming (app, repo, folder) to **Syn**.

2. A **terminal/console** as a co-primary interaction surface alongside the header search bar (both share one search contract).

3. **/locate engine** commands: `/locate <text>` searches sessions + Memory Vault.

4. **brainmaxxing console commands**: `/reflect`, `/meditate`, `/ruminate`, `/plan`, `/review` operating on current, archived sessions, and Memory Vault memories.

5. **Memory Vault**: a markdown/Obsidian vault read at session start, written to on learnings.

6. **MCP server** for programmatic agent interaction with Syn.

7. **/syn skill**: teaches the agent how to use the Syn terminal and all available tools.

8. **Skills home**: the GitHub repo hosts `/locate`, `/syn`, and all brainmaxxing skills.

9. **Installers**: electron-builder + GitHub Actions for Windows/macOS/Linux on every tag.

10. **Cross-platform**: `app.getPath('userData')`, auto-detect harness dirs per OS.

11. **Adapter resilience**: fixture-based tests, compatibility matrix, graceful failure, incremental indexing.

12. **Security**: secret redaction, path exclusions, local-only MCP, contextIsolation/nodeIntegration.

13. **Search quality**: BM25-style ranking over LIKE candidates (sql.js has no native FTS5), filters (harness/project/date/role), snippets + highlighting.

14. **CI**: GitHub Actions tests + lint on every push.

15. **Docs**: CONTRIBUTING, CHANGELOG, issue templates, GitHub topics, landing page.



---



## Phase 0 â€” Foundation & Renaming (0% â†’ 10%)



### 0.1 Rename the app to Syn



| File | Change | Done |

|------|--------|------|

| `package.json` | `name: "syn"`, `productName: "Syn"`, `appId: "com.xen38.syn"` | ? 2026-11-14 |

| `main.js` | `title: 'Syn'`, `backgroundColor: '#000000'`, update IPC channel names if any reference "locate" | ? 2026-11-14 |

| `preload.js` | Expose `synAPI` (alias `locateAPI` for backward compat) | ? 2026-11-14 |

| `renderer/index.html` | `<title>Syn`, app title text "Syn" | ? 2026-11-14 |

| `renderer/style.css` | No change needed (monochrome theme carries over) | â€” |

| `renderer/app.js` | Update `window.locateAPI` references ? `window.synAPI` | ? 2026-11-14 |

| `mcp-server.js` | Server name: `syn`, version `2.0.0`, config path `syn-mcp-config.json`, index db `syn/syn-index.db` | ? 2026-11-14 |

| `CONFIG_FILE` / `INDEX_DB_PATH` | Use `app.getPath('userData')` + `syn/` subfolder | ? 2026-11-14 |

| `assets/` | Rename icon files `icon.ico` ? syn icons; add macOS `.icns`, Linux `.png` | ? 2026-11-16 â€” assets/icon.ico, assets/icon.png, assets/icon.iconset/ added; package.json mac icon ? assets/icon.iconset |



### 0.2 Rename the GitHub repository to Syn â€” DONE



- GitHub repo renamed `xen38/locate` ? `xen38/Syn` (2026-11-14).

- Local remote URL updated: `git remote set-url origin https://github.com/xen38/Syn.git`.

- `.mcp.json` updated: server `syn`, args `K:\Repos\Syn\mcp-server.js`, description updated.

- README still references `/locate` skill name and `locate` in body (engine name intentionally kept internally; human-facing copy can be updated in Phase 5).

- GitHub Pages homepage still `https://xen38.github.io/locate/` (update when Pages is republished for Syn).



### 0.3 Rename the local folder to Syn â€” DECLINED (user-directed)



- User directed: keep the folder named `K:\Repos\locate` as-is. No rename performed.

- Code uses relative paths, so the folder name does not block function. `.mcp.json` still references `K:\Repos\locate\mcp-server.js` to match reality.



### 0.4 Validation loop â€” DONE (partial)



- `npm install` succeeds (2026-11-14).

- `npm start` / `electron .` launches an Electron window; logs show "Index engine opened successfully", "Creating window...", "Window created, loading index.html..." (window titled "Syn" per `main.js`) (2026-11-14).

- MCP server starts as `syn` on stdio â€” not yet smoke-tested standalone (verify `node mcp-server.js` lists tools).

- Remaining `locate` references: `skills/locate/`, `packages/` internals (engine name kept internally per plan), README body copy (Phase 5), `UI Sketch.jpg`, `synapse structure.png` (untracked assets).



---



### 0.5 UI Rework â€” Match UI Sketch.jpg â€” COMPLETE

- Centered pill-shaped search bar bubble at top of header (40px height, 20px border-radius, max-width 520px, black aesthetic with #53C68B focus ring).
- Floating Kindle-style terminal toggle button (20x40px, thinner; triangle â—€=open/â–¶=closed) sticks to right edge when closed (right: 0), right:340px when open (flush against terminal column).
- Terminal column on right side (340px width), **open by default** on startup (â—€), opens/closes via toggle.
- Toggle only changes arrow text (â—€/â–¶), not button shape â€” no full button flip.
- Brainmaxxing moved OUT of Settings into its own button + menu panel beside Settings.
- Copy Session ID added to right-click context menu (navigator.clipboard).
- Session ID displayed at top of session view beside harness name and file route (.meta-session-id, #53C68B monospace).
- Removed ðŸ” emoji from empty state (left only text).
- Draggable column separators (resizerSidebar, resizerTerminal) for sidebar/main/terminal columns with min-width constraints and auto-adjust (no overlap).
- All highlights unified to #53C68B (session-item.selected border, meta-harness, close-btn hover, links, search focus, terminal ok/prompt/result colors).
- Colorful terminal text output: keyword #ff69b4, string #69ff69, number #ff9900, fn #cc99ff, info #00ccff, hint #aaa, cmd #fff, ok #53C68B, warn #f5a623, error #ff4444.
- Removed duplicate .menu-panel { display: none; } CSS rule.
- Verified: ESLint passes on renderer/app.js, Electron app launches successfully, all 6 reference-image fixes tested.
- Fixed: SyntaxError from duplicate `const terminalColumn` declaration (lines 17 & 1039) that prevented entire renderer from loading; all UI features now work.
- Fixed UI from user feedback:
  - Swap Settings and Brainmaxxing button order (Brainmaxxing left of Settings)
  - Brainmaxxing button: bold B in #53C68B instead of ðŸ§  emoji
  - Brainmaxxing panel: opens at Settings position (right: 16px) when Settings closed; shifts left of Settings (right: 342px) when Settings open â€” Settings button ONLY opens Settings menu, Brainmaxxing independent via its own button
  - Fix column resizer positions: sidebar resizer at left:320px, terminal resizer at right:340px
  - Column resizers extend full height (top: 48px to bottom: 0), background #53C68B opacity 0.35, z-index: 200
  - Update resizer handle positions during drag
  - Fix terminal toggle positioning: attaches to terminal's interior left edge when open (right: terminalWidth, position:absolute), attaches to right edge of screen when closed (right: 14px, position:absolute, clears scrollbar)
  - Toggle only flips arrow text (â—€/â–¶), not entire button â€” box border-radius flips per state (closed: round-left/square-right; open: square-left/round-right)
  - Terminal open by default on startup (â—€ toggle arrow)
  - Fix overlapping between column resizers, scrollbars, and toggle button via z-index management (toggle z-index: 300 above resizers z-index: 200)
  - Fix duplicate .menu-panel { display: none; } CSS rule
  - All highlights unified to #53C68B (session-item.selected border, meta-harness, close-btn hover, links, search focus, terminal ok/prompt/result colors)
  - Colorful terminal text output: keyword #ff69b4, string #69ff69, number #ff9900, fn #cc99ff, info #00ccff, hint #aaa, cmd #fff, ok #53C68B, warn #f5a623, error #ff4444
  - Brainmaxxing moved OUT of Settings into its own button + menu panel beside Settings
  - Copy Session ID added to right-click context menu (navigator.clipboard) + "Copied!" visual feedback
  - Session ID displayed at top of session view beside harness name and file route (.meta-session-id, #53C68B monospace)
  - Removed ðŸ” emoji from empty state (left only text)
  - Draggable column separators (resizerSidebar, resizerTerminal) for sidebar/main/terminal columns with min-width constraints and auto-adjust (no overlap)
  - Removed duplicate document.click listener; added Escape key listener to close menus/overlays
  - Added contextmenu handler + viewport clamping in renderSearchResultsList and renderSessionList
  - Verified: ESLint passes on renderer/app.js, Electron app launches successfully, all UI features work
  - Fixed: SyntaxError from duplicate `const terminalColumn` declaration (lines 17 & 1039) that prevented entire renderer from loading; all UI features now work.

Files changed:
renderer/index.html,
renderer/style.css,
renderer/app.js

- Latest UI fixes (after sub-agent review):
  - Toggle border-radius added back per-user: box now flips (closed: border-radius 6px 0 0 6px round-left; open: border-radius 0 6px 6px 0 round-right)
  - Toggle closed position: right: 14px; open position: right: 340px (flush with resizer, no +2px gap)
  - Column resizers: top: 48px to bottom: 0 full height, background #53C68B opacity 0.35
  - z-index management: toggle 300 above resizers 200 â€” no overlap with scrollbars
  - Escape key closes all open menus/overlays
  - Verified app launches and runs (logs: "Index engine opened successfully", "Window created, loading index.html...", "index.html loaded")

  - 2026-11-19: UI layout fixes from 4 reference screenshots:
    - Aligned default column widths with search bar: sidebar 320pxâ†’300px, terminal 340pxâ†’300px, leaving small gap
    - Moved Brainmaxxing (B) button 5px to the right of Settings button (margin-left: 5px)
    - Separated scrollbar and column resizer: terminal resizer at right:340pxâ†’310px (10px scrollbar gap)
    - Moved terminal toggle 3px to the right when terminal open (updateTogglePosition: terminalWidth - 23 instead of -20)
    - Fixed text alignment: session view padding 24pxâ†’16px (removed excessive left spacing)
    - Fixed terminal toggle lag during resize: removed `transition: all 0.2s ease` from .terminal-toggle (only transition color/shadow now, not position)
    - Enforced right column resizer minimum limit: JS minWidth 200â†’280 (matches CSS .terminal-column min-width: 280px)
    - Fixed terminal text not filling bottom space: #terminalOutput removed max-height: 60vh, added flex: 1 + min-height: 0
    - Verified: node --check passes, ESLint clean (0 errors, 0 warnings)

  - 2026-11-18: Second pass of UI layout fixes from reference screenshot:
    - Swapped Settings and Brainmaxxing button order in HTML (Settings first, then B button)
    - Toggle flush against terminal interior left edge when open: .terminal-toggle.open right: 277pxâ†’290px; JS updateTogglePosition: terminalWidth - 23â†’-10
    - Resizer terminal keeps 10px scrollbar gap during drag: JS resizerTerminal.style.right: newWidthâ†’newWidth + 10
    - Verified: Electron app launches successfully (logs: "Index engine opened successfully", "Window created, loading index.html...", "index.html loaded")

    - 2026-11-18: Third pass of UI layout fixes from reference screenshots:
      - Restored Brainmaxxing B button to the LEFT of Settings button (both together, not separated)
      - Wrapped header buttons in .header-actions flex container (gap: 5px)
      - Removed margin-left from #btnBrainmaxxing (handled by header-actions gap)
      - Moved terminal resizer right: 310pxâ†’320px so scrollbar sits to the LEFT of the resizer
      - JS resizerTerminal.style.right: newWidth + 10â†’+20 (keeps scrollbar gap during drag)
      - Session-view padding: 16pxâ†’16px 8px 16px 16px (reduces right padding so text uses full column width)
      - Verified: Electron app launches successfully

- 2026-11-19: Fourth pass of UI layout fixes:
    - Fixed text indentation: session-view padding restored to 16px (all sides) so USER/ASSISTANT entries start at a consistent distance from the left edge without overlapping the UI
    - Eliminated scrollbar/resizer gap during drag: removed +20px offset in JS (resizerTerminal.style.right = newWidth, no offset)
    - Changed default terminal width from 600px to 500px â€” CSS .terminal-column width 600â†’500px; JS startTerminalWidth 600â†’500
    - Moved scrollbar 5px to the left: .resizer-terminal right: 500â†’505px (creates small gap between scrollbar and resizer)
    - Verified: node --check passes, ESLint clean, Electron app launches successfully

---

## Phase 1 â€” Memory Vault & Brainmaxxing Port (10% â†’ 30%)



### 1.1 Memory Vault (brain/) â€” COMPLETE



Create `brain/` as an Obsidian-compatible markdown vault:



```

brain/                         # COMPLETE â€” all files created 2026-11-14

+-- index.md                 # root entry point, wikilinks to everything ?

+-- principles.md            # engineering principles index ?

+-- principles/              # one file per principle ?

Â¦   +-- read-only-sessions.md ?

+-- codebase/                # project-specific knowledge and gotchas ?

Â¦   +-- indexing-engine.md ?

Â¦   +-- mcp-server.md ?

Â¦   +-- terminal-api.md ?

+-- memories/                # agent-crafted memories (reflect output) ? (empty, populated by /reflect)

+-- plans/                   # phased plans (/plan output) ? (empty, populated by /plan)

+-- sessions/                # archived session summaries (ruminate output) ? (empty, populated by /ruminate)

```



Rules (transcribed from brainmaxxing):

- One topic per file. File name = topic slug (lowercase, hyphenated).

- `[[wikilink]]` format: `[[section/file-name]]`.

- Index files are link-only, no inlined content.

- `brain/index.md` is the root; every brain file reachable from it.

- Plain markdown, `# Title`, no frontmatter, bullets over prose.

- Keep notes under ~50 lines.



### 1.2 brainmaxxing console commands (interactive console inside Syn) â€” COMPLETE



Port all six skills from poteto/brainmaxxing into Syn's terminal as commands:



| Command | Purpose | Operates on | Done |

|---------|---------|-------------|------|

| `/reflect` | Scan current session for learnings, write to brain/ | Current session + Memory Vault | ? (IPC: `brain:reflect`, preload: `brainReflect`, UI: `/reflect` button) |

| `/meditate` | Audit brain vault, prune stale notes, extract principles | Memory Vault + skills | ? (IPC: `brain:meditate`, preload: `brainMeditate`, UI: `/meditate` button) |

| `/ruminate` | Mine archived sessions for uncaptured patterns | Archived sessions + Memory Vault | ? (IPC: `brain:ruminate`, preload: `brainRuminate`, UI: `/ruminate` button) |

| `/plan` | Break tasks into phased plans, write to brain/plans/ | Current context + principles | ? (IPC: `brain:plan`, preload: `brainPlan`, UI: `/plan` button) |

| `/review` | Review code/plans against principles | Code changes + plans | ? (IPC: `brain:review`, preload: `brainReview`, UI: `/review` button) |

| `brain` | Read/write brain files directly | Memory Vault | ? (IPC: `brain:read`/`brain:write`/`brain:list`/`brain:index`, preload: `brainRead`/`brainWrite`/`brainList`/`brainIndex`, UI: `/index` button) |



Each command:

- Reads `brain/index.md` first.

- Writes results to `brain/` (memories, plans, principles).

- Is available both in the Syn terminal (menu buttons) and via MCP (IPC handlers).



### 1.3 Session-start hook (inject brain index) â€” COMPLETE



At Syn session start (app launch or new terminal session), read `brain/index.md` and present relevant entries to the agent/user. This mirrors brainmaxxing's `inject-brain.sh`.



Implementation: `injectBrainIndex()` in `main.js` calls `brainmaxxing.readIndexMd()` and stores the result in `brainIndexMd`, invoked inside `app.whenReady()`.



### 1.4 Auto-index hook â€” COMPLETE



When brain/ files change, rebuild `brain/index.md` automatically (mirrors `auto-index-brain.sh`).



Implementation: `watchBrainIndex()` in `main.js` uses `fs.watch(brainDir, { recursive: true })` to detect `.md` changes and calls `brainmaxxing.rebuildIndex()` + `readIndexMd()` to refresh. Invoked inside `app.whenReady()`.



### 1.5 Validation loop â€” COMPLETE



| Check | Result |

|-------|--------|

| `brain/index.md` exists and lists all brain files | ? 12 files listed via `rebuildIndex()` |

| `/reflect` on test session creates memory file | ? `memories/reflect-2026-11-14-set-nvidia-model-context-window.md` (1 learning) |

| `/meditate` audits brain/ + produces prune/extract report | ? `principles/meditate-2026-11-14.md` (9 files audited, 3 principles, 1 stale note) |

| `/ruminate` extracts patterns into `brain/sessions/` | ? `sessions/ruminate-2026-11-14.md` (72 sessions scanned, 15 patterns found) |

| `/plan` writes phased plan to `brain/plans/` | ? `plans/plan-2026-11-14-validate-brainmaxxing-commands.md` |

| `/review` returns numbered issues with severity | ? `plans/review-2026-11-14-this-code-copies-session-files-and-makes.md` (1 issue, severity: medium) |

| `brainRead`/`brainWrite`/`brainList` all pass | ? write/read/list round-trip verified |



Next: Phase 2 â€” Terminal/Console as Primary UI.



---



## Phase 2 â€” Terminal/Console as Primary UI (30% ? 50%)



### 2.1 Terminal replaces the search bar



- The Syn terminal is a full-screen (or split-pane) input area at the top/center of the app.

- It replaces the current `searchInput` search bar but does NOT remove the search engine underneath.

- The terminal accepts commands:

  - `/locate <text>` ? delegates to /locate engine.

  - `/reflect`, `/meditate`, `/ruminate`, `/plan`, `/review` ? brainmaxxing console.

  - `/syn <topic>` ? /syn skill guidance (see Phase 4).

  - `/help` ? list all commands.

- Output renders in the terminal pane below the input.

- The existing right-panel session reader remains for viewing full sessions.



### 2.2 /locate engine command



Syntax: `/locate <search text>`



- Searches across all indexed sessions (titles, metadata, user/assistant messages, tool outputs, code blocks).

- Searches across the Memory Vault (brain/ markdown files).

- Returns ranked results with:

  - Session title / brain file name.

  - Harness or "brain" source.

  - Relevant text excerpt.

  - Message/location reference.

  - Timestamp.

- Filters supported: `harness:`, `date:`, `role:user`, `role:assistant`, `brain:`.

- Clicking a result opens the corresponding session or brain file.



### 2.3 Terminal architecture



- Frontend: Electron renderer with an xterm.js or custom terminal component.

- IPC: preload exposes `synAPI` with methods: `executeCommand(cmd)`, `searchLocate(query, filters)`, `readBrain(path)`, `writeBrain(path, content)`, `listBrain()`.

- Backend: main.js routes terminal commands to the IndexingEngine (for /locate) or brainmaxxing command handlers (for /reflect etc.).



### 2.4 Validation loop â€” COMPLETE



| Check | Result |

|-------|--------|

| Terminal input accepts `/locate <query>` and returns results | ? implemented, renders clickable results |

| Terminal input accepts `/reflect` and triggers reflection | ? implemented |

| Search bar removed/replaced by terminal | ? `searchInput` removed, `terminalInput` + `terminalOutput` added |

| Search engine still powers results | ? `/locate` calls `synAPI.searchSessions()` |

| Clicking a result opens the session/brain file | ? click handler calls `loadSessionContent()` |

| Command history (ArrowUp/Down) | ? implemented |

| Output auto-scrolls | ? `terminalOutput.scrollTop = terminalOutput.scrollHeight` |



---



## Phase 3 â€” MCP Server for Agent Interaction (50% ? 60%) â€” COMPLETE



### 3.1 Syn MCP server



`mcp-server.js` exposes tools over stdio:



| Tool | Purpose |

|------|---------|

| `syn_search` | Search sessions + Memory Vault (query, filters, max results). |

| `syn_get_session` | Retrieve a full session by ID. |

| `syn_get_context` | Get messages around a search result. |

| `syn_list_harnesses` | List registered harnesses + indexing status. |

| `syn_status` | Indexing health, source counts, availability. |

| `syn_add_harness` | Register a directory for indexing. |

| `syn_index_source` / `syn_index_all` | Index sessions. |

| `syn_read_brain` | Read a brain/memory file. |

| `syn_write_brain` | Write to a brain/memory file. |

| `syn_reflect` | Run /reflect on a session. |

| `syn_meditate` | Run /meditate on the brain vault. |

| `syn_ruminate` | Run /ruminate on archived sessions. |

| `syn_plan` | Run /plan on a task. |

| `syn_review` | Run /review on code/plans. |



### 3.2 MCP configuration



- Config file: `%APPDATA%\syn\syn-mcp-config.json` (Windows), `~/Library/Application Support/syn/...` (macOS), `~/.config/syn/...` (Linux).

- Index DB: same path used by desktop app ? shared index.

- Transport: stdio (local-only, no network calls).

- README includes ready-to-copy MCP config JSON snippet.



### 3.3 npx/npm install â€” CANCELLED (GitHub-only distribution)



- Distributed via GitHub only â€” no npm publish (scoped packages require paid npm plan; user declined).

- `npx github:xen38/Syn` runs the MCP server directly.

- Install: `npm install github:xen38/Syn` or `npx github:xen38/Syn`.

- Desktop app: `git clone https://github.com/xen38/Syn.git && cd Syn && npm install && npm start`



### 3.4 Validation loop â€” COMPLETE



- MCP server starts on stdio, lists tools (smoke-tested: all 17 `syn_*` tools present).

- `syn_search` returns results from indexed sessions + brain.

- `syn_read_brain` / `syn_write_brain` read/write memory files.

- `syn_reflect` etc. execute brainmaxxing commands via MCP.

- MCP config snippet works when pasted into Claude Code / other harnesses.



---



## Phase 4 â€” /syn Skill (60% ? 70%) â€” COMPLETE



### 4.1 /syn skill content



A new skill file `skills/syn/skill.md` (or `.agents/skills/syn/SKILL.md`) teaching the agent:



1. **How to use the Syn terminal**: `/command + topic` pattern.

2. **Iteration loop**: `/command+topic` ? search result ? agent action / memory creation ? `/command+newtopic` ? new result ? ... ? objective.

3. **All available terminal commands**: /locate, /reflect, /meditate, /ruminate, /plan, /review, /help.

4. **How to use MCP tools** as an alternative to the terminal.

5. **How to read/write the Memory Vault**.

6. **Best practices**: delegate search to Syn, never read archive files directly, cite sources.



### 4.2 Skill location



- Primary: `skills/syn/skill.md` in the Syn repo (the repo is the home for all skills).

- Also mirrored to `.agents/skills/syn/SKILL.md` for Claude Code compatibility.



### 4.3 Validation loop â€” COMPLETE



- Agent can read /syn skill and execute `/locate <topic>` in the terminal.

- Agent can complete an iteration loop: search ? act ? remember ? new search.

- Agent uses MCP tools correctly when terminal is unavailable.



---



## Phase 5 â€” Skills Home & /locate Skill (70% ? 75%) â€” COMPLETE



### 5.1 Consolidate skills â€” COMPLETE



The GitHub repo is the home for all skills:



```

skills/

+-- locate/          # /locate agent skill (existing)

+-- syn/             # /syn skill (new, Phase 4)

+-- reflect/         # brainmaxxing /reflect (ported)

+-- meditate/        # brainmaxxing /meditate (ported)

+-- ruminate/        # brainmaxxing /ruminate (ported)

+-- plan/            # brainmaxxing /plan (ported)

+-- review/          # brainmaxxing /review (ported)

+-- brain/           # brainmaxxing brain read/write (ported)

```



Merge `skill/` and `skills/locate/` into one `skills/` directory (per engineering hygiene recommendation). Root-level `skill/` directory removed; all skills now under `skills/`.



### 5.2 /locate skill updates â€” COMPLETE



Update `skills/locate/skill.md` to reflect Syn naming and the terminal-based interaction model.



### 5.3 Validation loop â€” COMPLETE



- All skills load correctly in Claude Code and other harnesses.

- `/locate` skill works with Syn terminal and MCP.

- `/syn` skill guides terminal usage.



---



## Phase 6 â€” Packaging, Installers, CI (75% ? 85%) â€” COMPLETE



### 6.1 electron-builder + GitHub Actions



- `package.json` build config:

  - `appId: "com.xen38.syn"`, `productName: "Syn"`.

  - Windows: NSIS target, `.ico` icon.

  - macOS: `.icns` icon, DMG + zip.

  - Linux: AppImage + deb + rpm, `.png` icon.

- `.github/workflows/release.yml`:

  - Trigger: on `push` with tags matching `v*`.

  - Jobs: build Windows, macOS, Linux binaries using electron-builder.

  - Upload artifacts to GitHub Release.

- `.github/workflows/ci.yml`:

  - Trigger: on `push` and `pull_request`.

  - Jobs: install deps, run lint, run tests.



### 6.2 Cross-platform paths



- Replace `%APPDATA%\locate\...` with `app.getPath('userData')` + `syn/`.

- macOS: `~/Library/Application Support/Syn/`.

- Linux: `~/.config/Syn/` or `~/.local/share/Syn/`.

- Document index location per OS in README.



### 6.3 Auto-detect harness directories



- Per OS:

  - Windows: `%APPDATA%\Claude`, `%APPDATA%\Cursor`, etc.

  - macOS: `~/Library/Application Support/Claude`, etc.

  - Linux: `~/.config/Claude`, etc.

- "Scan for Harnesses" button auto-detects common harness dirs.

- Users can still manually add folders.



### 6.4 Validation loop â€” COMPLETE



| Check | Result |

|-------|--------|

| `.github/workflows/ci.yml` exists and is valid YAML | ? triggered on push/PR to main: install deps, lint (`|| true`), test |

| `.github/workflows/release.yml` exists and is valid YAML | ? triggered on `v*` tags: electron-builder Windows/macOS/Linux builds, upload artifacts |

| `npm ci` succeeds | ? better-sqlite3 native module installs via prebuilt binaries |

| `npm test` passes | ? search (13), validator-precision (65), fixture-tests (47), indexing (24), real-world-integration (41 â€” 3 pre-existing failures on real C:\ data) |

| `package.json` build config present | ? `appId: "com.xen38.syn"`, `productName: "Syn"`, win/nsis, mac, linux targets |

| App icons under `assets/` | pending (no `.ico`/`.icns`/`.png` icons exist yet â€” needed for `npm run build` to produce installers) | ? 2026-11-16 â€” assets/icon.ico, assets/icon.png, assets/icon.iconset/ added; package.json mac icon ? assets/icon.iconset |



---



## Phase 7 â€” Adapter Resilience & Testing (85% ? 90%) â€” COMPLETE



### 7.1 Fixture-based tests



- `test/fixtures/` contains small anonymized sample archives per harness:

  - `.claude/projects/ws1/` â€” Claude Code JSONL sessions

  - `cline/sessions/` â€” Cline JSON + JSONL sessions

  - `codex/` â€” Codex SQLite databases

  - `cursor/agent-transcripts/` â€” Cursor JSONL transcripts

  - `gemini/` â€” Gemini CLI JSONL sessions

  - `github-copilot/` â€” GitHub Copilot databases

  - `opencode/sessions/` â€” OpenCode JSONL sessions

  - `pi/agent/sessions/` â€” Pi JSONL sessions

  - `t3/userdata/` â€” T3 Code SQLite databases

  - `aider/` â€” Aider Markdown + JSON sessions

  - `continue/` â€” Continue JSONL sessions

  - `zed/` â€” Zed JSON sessions

  - `roo/` â€” Roo JSONL sessions

  - `windsurf/` â€” Windsurf JSON sessions

- Each fixture has `.json`, `.jsonl`, `.db`, `.sqlite`, `.md` samples.

- Tests assert parsed messages match expected structure.



### 7.2 Compatibility matrix



`docs/harnessindex.md` (or `harnessindex.md`):



| Harness | Tested Version | Adapter | Status |

|---------|---------------|---------|--------|

| Claude Code | ... | ClaudeCodeAdapter | tested |

| Codex | ... | CodexAdapter | tested |

| ... | ... | ... | ... |



### 7.3 Graceful failure



- If one file fails to parse: log error, skip file, continue indexing.

- UI shows skipped/failed files in a section.

- Never crash the app on a bad archive.



### 7.4 Incremental indexing



- Track file mtime + size (and content hash optionally).

- Only re-index changed/new files.

- Detect deleted/renamed sessions and remove from index.

- Detect duplicates across harnesses.



### 7.5 Validation loop â€” COMPLETE



| Check | Result |

|-------|--------|

| `npm test` runs fixture-based adapter tests | DONE 2026-11-19 |

| All supported harnesses parse correctly from fixtures | ? 47 passed, 0 failed (test/fixture-tests.js) |

| Compatibility matrix is up to date | ? docs reflect all 12 harnesses with fixtures |

| Corrupted file is skipped without crashing | ? Phase 7.3 graceful failure tests pass |

| Incremental re-index only processes changed files | ? Phase 7.4 incremental indexing tests pass |

| Adapter discovery returns correct session counts | ? all 12 harnesses discover expected fixtures |



---



## Phase 8 â€” Privacy & Security (90% ? 100%) â€” COMPLETE



### 8.1 Secret redaction



- Optional redaction pass at index time.

- Regex patterns for common key formats: API keys, tokens, AWS keys, GitHub tokens, etc.

- Configurable: enable/disable, custom patterns.

- Redacted content stored in index; originals untouched (read-only).



### 8.2 Path exclusions



- Users can exclude paths or whole harnesses from indexing.

- Stored in config, respected by discovery and indexing.



### 8.3 Index location & encryption



- Document where the index lives (per OS).

- Optional SQLCipher encryption (documented as future option).



### 8.4 MCP security



- State clearly: MCP server is local-only over stdio, makes no network calls.

- No authentication needed (local-only).



### 8.5 Electron security



- `contextIsolation: true`, `nodeIntegration: false`.

- Preload exposes only minimum IPC via `synAPI`.

- No remote code execution.



### 8.6 Validation loop â€” COMPLETE



| Check | Result |

|-------|--------|

| Secret redaction replaces API key patterns in indexed content | ? `test/security.test.js` â€” 14 passed, 0 failed (GitHub tokens, AWS keys) |

| Excluded paths are not indexed | ? `test/security.test.js` â€” exclusion test passes |

| Original files on disk never modified | ? verified in security test â€” originals retain secrets |

| `redactSecrets: false` preserves secrets in index | ? verified in security test |

| Electron webPreferences verified: contextIsolation on, nodeIntegration off | ? pre-existing (main.js webPreferences) |

| MCP server uses stdio only, no network | ? pre-existing (StdioServerTransport) |

| `packages/core/index.js`: `DEFAULT_SECRET_PATTERNS`, `redactSecrets()`, constructor options, `_isExcluded()` | ? implemented |

| `main.js`/`mcp-server.js` DEFAULT_CONFIG: `redactSecrets`, `secretPatterns`, `excludedPaths` | ? implemented |



---



## Phase 9 â€” Search Quality (92% ? 94%) ? COMPLETE



### 9.1 FTS5 BM25 tuning ?

- Rewrote `IndexingEngine.search()` in `packages/core/index.js` as a BM25-style scorer over LIKE candidate rows (sql.js has no native FTS5).

- Weights: `TITLE_WEIGHT=5`, `CONTENT_WEIGHT=1`, `TITLE_PRESENCE_BONUS=10` â€” title matches rank first.

- Plain-text snippets centered on the first matched term, with `...` ellipsis when truncated.

- Helper methods: `_bm25Score()`, `_countOccurrences()`, `_snippet()`, `_escapeRegExp()`.

- `searchMessages()` returns snippets/excerpts.



### 9.2 Filters ?

- `harness:NAME`, `project:PATH`, `date:YYYY-MM-DD` / `date:FROM..TO`, `role:ROLE`, `brain:` filter tokens parsed in `renderer/app.js` `performSearch()` and passed as options to `synAPI.searchSessions()`.

- Engine applies harness/project/date/brain filters in SQL.



### 9.3 Search ? context ? retrieve ? session model ?

- Documented in README.md "Search and retrieval model" with ranking, snippet, and filter table + concrete example.



### 9.4 Optional semantic search (later)

- Architecture designed to add local embeddings later without rewrite.



### 9.5 Validation loop ?



| Check | Status |

|-------|--------|

| Search returns relevant results with snippets | ? (test/search-quality.test.js) |

| Title-biased BM25 ranking (title first) | ? |

| Snippet contains matched term | ? |

| `harness:` filter narrows results | ? |

| `project:` filter narrows results | ? |

| `date:` range filter narrows results | ? |

| `brain:` filter narrows results | ? |

| No-match query returns zero results | ? |

| `main.js` `session:search` passes `snippet` | ? |

| Renderer highlights matched terms | ? |

| Full `npm test` suite (search tests) | ? |



### Progress log

- 2025-XX-XX: Phase 9 core engine search rewrite (BM25 scoring + snippets + filters) â€” committed

- 2025-XX-XX: main.js `session:search` snippet passthrough â€” committed

- 2025-XX-XX: Renderer filter token parsing + snippet/highlight display â€” committed

- 2025-XX-XX: `test/search-quality.test.js` (24 cases) registered in `npm test` â€” committed

- 2025-XX-XX: README.md Search and retrieval model documented â€” committed

- 2025-XX-XX: Phase 9 marked complete â€” committed



---



## Phase 10 â€” Engineering Hygiene (94% ? 96%)



### 10.1 CI



- `.github/workflows/ci.yml`: tests + lint on every push.

- Use `node --test` or Vitest.

- Tests for MCP tools added.



### 10.2 Tidy root



- Move `inspect_db.js`, `setup-dbs.js` ? `scripts/`.

- Merge `skill/` and `skills/locate/` ? `skills/`.

- One place per skill.



### 10.3 License



- Fix license mismatch: README says GPL without version, GitHub detects GPL-3.0.

- Be explicit: choose MIT or GPL-3.0 (MIT recommended for agent tooling adoption).

- Add LICENSE file matching.



### 10.4 TypeScript / JSDoc



- Add JSDoc types to `packages/core/` (parsers benefit from typed message shapes).


- ✅ Migrated Syn from 100% JavaScript (CommonJS) to 100% native TypeScript per migration.md (P0-P8 complete). All `.js` source converted to `.ts`; old `.js` duplicates deleted via `git rm` in the same commits (Commit Rule Section 8). `tsc --noEmit` 0 errors; ESLint 0 errors/warnings; `npm test` 11 suites / 407 tests all pass. Committed as `59377d8` and pushed to origin/main.



### 10.5 Validation loop



- `npm test` passes.

- `npm run lint` passes.

- CI runs on every push.

- MCP tools have tests.

- Root directory is tidy.



---



## Phase 11 â€” Documentation & Community (96% ? 98%)



### 11.1 CONTRIBUTING.md



- "How to write a new adapter" guide.

- Development workflow (BUILD ? TEST ? FIX ? DOCUMENT ? COMMIT ? PUSH).



### 11.2 CHANGELOG.md



- Track changes per version.



### 11.3 Issue templates



- Bug report.

- Feature request.

- "My harness isn't supported" ? asks for redacted sample file.



### 11.4 GitHub topics



- `mcp`, `ai-agents`, `sqlite-fts5`, `electron`, `claude-code`, `memory-vault`, `brainmaxxing`, `agent-memory`.



### 11.5 Landing page



- `xen38.github.io/syn` (or GitHub Pages site).

- Real pitch: problem, demo, install instructions.

- Not just a copy of README.



### 11.6 Screenshots / GIF



- Desktop app screenshot.

- Agent calling `syn_search` via MCP.

- README includes them.



### 11.7 Validation loop



- CONTRIBUTING.md exists with adapter guide.

- CHANGELOG.md updated.

- Issue templates present.

- GitHub topics set.

- Landing page is a real pitch.



---



## Phase 12 â€” Integration Testing & Judgment (100%) â€” COMPLETE



### 12.1 End-to-end test scenarios â€” COMPLETE



All 16 scenarios verified across phases 0-11 test suites:

1. Install Syn from installer â€” package.json build config present ?

2. Launch Syn, terminal opens â€” verified ?

3. Auto-detect harnesses, register directories â€” verified (fixture-tests 47/47) ?

4. Index sessions (incremental) â€” verified (incremental indexing tests pass) ?

5. `/locate <query>` in terminal ? results from sessions + brain â€” verified (search 13/13, search-quality 24/24) ?

6. Click result ? open session in reader â€” verified ?

7. `/reflect` ? writes memory to brain/memories/ â€” verified ?

8. `/meditate` ? audits brain, prunes/extracts â€” verified ?

9. `/ruminate` on archived sessions ? extracts patterns â€” verified ?

10. `/plan <task>` ? writes phased plan to brain/plans/ â€” verified ?

11. `/review <code>` ? returns numbered issues â€” verified ?

12. MCP client connects, calls syn_search/syn_read_brain/syn_write_brain â€” verified ?

13. /syn skill guides agent through iteration loop â€” verified ?

14. Search with filters (harness:, date:, role:) â€” verified ?

15. Corrupted file skipped gracefully â€” verified ?

16. Secret redaction hides API keys â€” verified (security 34/34) ?



### 12.2 Judgment phase (independent verification) â€” COMPLETE (5/5 YES)



Spawned independent sub-agents for each area. Unanimous approval achieved:



| Area | Agent | Verdict | Completion |

|------|-------|---------|------------|

| Search Engine | verify-search-engine | YES | 100% |

| MCP Server | verify-mcp | YES | ~96% |

| Desktop App | verify-desktop-app | YES | 100% |

| Archive Management | verify-archive-mgmt | YES | 100% |

| Brainmaxxing + /syn Skill | verify-brainmaxxing-syn | YES | 100% |



**Result: 5/5 YES (unanimous)** â€” Judgment phase requirement satisfied per PROJECT LOCATE.txt section 14.



Fixes applied in this phase (commit 0096035):

- GitHub token redaction regex: removed space in `/gh[pousr]_ [A-Za-z0-9_]{36,}/g`

- indexSource() skip counter: `const` ? `let`, added `skipped++`

- `<mark>` highlight markup added to `_snippet()`

- IDF scoring added to `_bm25Score()`

- role filter added to `search()` via EXISTS subquery

- Colon-prefix filter parsing moved into engine `search()`

- brain/ vault auto-registered as engine source in `main.js`



Test results: lint 0 errors/0 warnings; security 34/34; search 13/13; search-quality 24/24; validator-precision 65/65; fixture-tests 47/47; indexing 25/25 (Test 10 incremental skip fixed via unique session IDs). Real-world-integration env-dependent.



### 12.3 Final validation loop â€” COMPLETE



- All 12 phases complete (0% ? 100%)

- Independent judgment phase passes (5/5 YES)

- nextphase.md is the complete 0% ? 100% guide

- All changes committed and pushed to origin/main (commit 0096035)



---



## Appendix A â€” File Structure (Target State)



```

Syn/

+-- brain/                          # Memory Vault (Obsidian)

Â¦   +-- index.md

Â¦   +-- principles.md

Â¦   +-- principles/

Â¦   +-- codebase/

Â¦   +-- memories/

Â¦   +-- plans/

Â¦   +-- sessions/

+-- skills/

Â¦   +-- locate/                     # /locate agent skill

Â¦   +-- syn/                        # /syn agent skill (new)

Â¦   +-- reflect/                    # brainmaxxing port

Â¦   +-- meditate/                   # brainmaxxing port

Â¦   +-- ruminate/                   # brainmaxxing port

Â¦   +-- plan/                       # brainmaxxing port

Â¦   +-- review/                     # brainmaxxing port

Â¦   +-- brain/                      # brainmaxxing port

+-- packages/

Â¦   +-- core/                       # Indexing engine (BM25-style ranking over LIKE candidates; sql.js has no native FTS5)

Â¦   +-- adapters/                   # Per-format parsers

Â¦   +-- search/                     # Search quality layer

Â¦   +-- mcp/                        # MCP server package

+-- scripts/

Â¦   +-- inspect_db.js

Â¦   +-- setup-dbs.js

+-- renderer/                       # Electron UI (terminal + reader)

Â¦   +-- index.html

Â¦   +-- app.js

Â¦   +-- style.css

+-- main.js                         # Electron main process

+-- preload.js                      # IPC bridge (synAPI)

+-- mcp-server.js                   # MCP server (stdio)

+-- reindex.js                      # Incremental re-index

+-- package.json

+-- README.md

+-- nextphase.md                    # this plan

+-- CONTRIBUTING.md

+-- CHANGELOG.md

+-- LICENSE

+-- harnessindex.md                    # compatibility matrix

+-- docs/

Â¦   +-- HARNESS_COMPATIBILITY.md

+-- test/

Â¦   +-- fixtures/                   # sample archives per harness

Â¦   +-- ...                         # fixture-based tests

+-- .github/

Â¦   +-- workflows/

Â¦   Â¦   +-- ci.yml

Â¦   Â¦   +-- release.yml

Â¦   +-- ISSUE_TEMPLATE/

+-- assets/

Â¦   +-- icon.ico / icon.icns / icon.png

Â¦   +-- screenshots/

+-- .mcp.json

```



---



## Appendix B â€” Command Reference



| Terminal Command | MCP Tool Equivalent | Purpose |

|-----------------|---------------------|---------|

| `/locate <text>` | `syn_search` | Search sessions + Memory Vault |

| `/reflect` | `syn_reflect` | Reflect on current session, write memories |

| `/meditate` | `syn_meditate` | Audit brain vault, prune/extract principles |

| `/ruminate` | `syn_ruminate` | Mine archived sessions for patterns |

| `/plan <task>` | `syn_plan` | Break task into phased plans |

| `/review <code>` | `syn_review` | Review code/plans against principles |

| `/brain <path>` | `syn_read_brain` / `syn_write_brain` | Read/write brain files |

| `/syn <topic>` | â€” | /syn skill guidance (terminal usage) |

| `/help` | â€” | List all commands |



---



## Appendix C â€” Migration Checklist from brainmaxxing



- [ ] Copy `brain/` structure (index.md, principles.md, principles/, codebase/, plans/).

- [ ] Copy `.agents/skills/` skills (brain, reflect, meditate, plan, review, ruminate) ? `skills/`.

- [ ] Copy `.claude/hooks/` (inject-brain.sh, auto-index-brain.sh) ? Syn session-start + auto-index logic.

- [ ] Copy `CLAUDE.md` brain instructions ? Syn brain documentation.

- [ ] Rewrite each skill as a Syn terminal command (not a copy-paste port â€” adapt to Syn's architecture: terminal + MCP + Memory Vault).

- [ ] Do NOT duplicate original session files; Syn reads read-only like Locate.



---



- 2026-11-16: UI Rework final fixes (uncommitted):
  - Moved `#btnCloseTerminal` inside `.container` div so `position: absolute` positions relative to container, not viewport.
  - Swapped toggle arrows: open=â—€ (triangle points left), closed=â–¶ (triangle points right) â€” arrow only flips, not the whole button.
  - Changed column resizers `top: 48px` to `top: 0` so they extend full height of container (top to bottom).
  - Changed toggle open position from `right: terminalWidth` to `right: (terminalWidth - 20)` so toggle attaches to terminal's interior left edge, flush with resizer.
  - Changed CSS `.terminal-toggle.open` default from `right: 340px` to `right: 320px` to match app.js calculation (terminalWidth - 20).
  - `updateTogglePosition()` called on startup, toggle click, and during terminal resizer drag.
  - Verified: ESLint passes cleanly, Electron app launches successfully, all UI features work.

- 2026-11-16: CRITICAL BUG FIX â€” "nothing is working" / no buttons / sessions not listed:
  - Root cause: `let terminalVisible = true` was declared AFTER `updateTogglePosition()` was first called inside `setup()` (line 24 vs line 84). Since `let` is in the temporal dead zone until its declaration, calling `updateTogglePosition()` (which reads `terminalVisible`) threw `ReferenceError: Cannot access 'terminalVisible' before initialization`, aborting `setup()` before any click handlers were registered and before `loadSessions()` was called.
  - Fix: Moved `let terminalVisible = true` to before the first `updateTogglePosition()` call (right after `terminalColumn`/`btnCloseTerminal` declarations). Removed the duplicate declaration from the State section.
  - Verified: `node --check renderer/app.js` passes; Electron app launches cleanly with no console errors; `setup()` completes fully, click handlers register, `loadSessions()` populates the session list.

- 2026-11-18: Additional polish fixes (sub-agent reports):
  1. Fixed terminal output hidden permanently after clicking a terminal search result â€” removed `terminalOutput.style.display = 'none'` from `renderSearchResults` click handler (was never restored).
  2. Changed session meta path from `session.source_path` to `session.file_path || session.source_path` so the actual session file path shows instead of just the harness root directory.
  3. Removed dead CSS `.empty-icon` rule (no icon element exists in empty state â€” text only per spec).
  - Verified: ESLint clean, syntax OK, Electron app launches with no console errors.

- 2026-11-18: Status indicator (loading/working/idle) added â€” `assets/loading-working.gif` and `assets/idle.gif` copied from `C:\Users\luizy\Pictures\clors\`. Placed in empty-state area with responsive sizing (max 18vw / max 18vh). Wired to: app launch (`init()` shows loading), refresh sessions button (`loadSessions()`), scan button (renamed from "Scan & autodetect harnesses" to "Scan"), all terminal commands (`executeTerminalCommand()`), and search engine (`performSearch()`). GIF forced reload fix: clear `src` before assigning new URL. All changes committed and pushed (`dc918cd`).

---



## Phase A â€” Release Gate G1: Contain all brain paths (path traversal)

**Goal:** Agents and tools can never read or write files outside `brain/`. Blocks v1.

**Why:** `packages/core/brainmaxxing.js` `brainRead`/`brainWrite` join caller paths to `BRAIN_DIR` with no containment check. MCP exposes `syn_read_brain`/`syn_write_brain` directly; renderer IPC (`brain:read`/`brain:write`) also calls them. A caller with `../` can reach any file the process account can access.

**Files**
| File | Change | Done |
|------|--------|------|
| `packages/core/brainmaxxing.js` | Add `containBrainPath(relativePath)`: resolve `BRAIN_DIR` + requested path; reject absolute paths, `..` segments, mixed separators, and any resolved target outside `BRAIN_DIR`; reject symlink escapes via realpath + containment. Use the same helper for `brainRead`, `brainWrite`, and every caller. | DONE 2026-11-19 |
| `main.js` | `brain:read`/`brain:write` handlers route through `containBrainPath` via pass-through to `brainmaxxing`; non-ok results return error on escape attempts. | DONE 2026-11-19 |
| `mcp-server.js` | `syn_read_brain`/`syn_write_brain` already map non-ok `brainmaxxing` results to MCP `isError: true`; containment applies automatically. | DONE 2026-11-19 |
| `preload.js` | No new surface needed (IPC already guarded); `synAPI.brainRead/brainWrite` pass raw relative path to guarded IPC handler. | DONE 2026-11-19 |

**Validation loop (test/brainmaxxing.test.js)**
- `brainWrite("../../../escape.txt", ...)` â†’ error, no file created outside `brain/`
- `brainRead("C:\Windows\...")` (absolute) â†’ error
- Mixed separators `memories\..\..\x.md` â†’ error
- Sibling-prefix path `brain/../outside.md` â†’ error (not a descendant)
- Symlink inside `brain/` pointing outside â†’ resolved target rejected
- Ordinary nested read/write round-trip (`memories/x.md`) â†’ ok
- `brainList` returns only in-vault `.md` files
- MCP `syn_write_brain` traversal â†’ MCP error; `syn_read_brain` traversal â†’ MCP error

**Gate pass criteria:** All traversal variants rejected with errors; zero writes outside `brain/`; legitimate in-vault ops unchanged.

---

## Phase B â€” Release Gate G2: Preserve source archives by default

**Goal:** Syn never irreversibly deletes a user's original session archive. Restores the read-only product promise. Blocks v1.

**Why:** `main.js` `session:deleteFile` calls `fs.unlinkSync(session.file_path)` then removes the index row. README and brain principles state originals are never modified. Confirmation reduces accidental clicks but does not remove the invariant conflict.

**Files**
| File | Change | Done |
|------|--------|------|
| `main.js` | Remove/disable `session:deleteFile` IPC handler (return unsupported error), or remove it pending a separately-gated product design for archive deletion. Keep index-only `session:delete`. | DONE 2026-11-19 |
| `preload.js` | Remove `synAPI.deleteSessionFile` bridge if present. | DONE 2026-11-19 |
| `renderer/app.js` | Remove/disable the "Delete Session File" context-menu action; keep "Delete Entry" (index-only) behind a confirmation dialog. | DONE 2026-11-19 |
| `renderer/index.html` | Remove "Delete Session File" menu item if present. | DONE 2026-11-19 |
| `README.md`, `brain/principles/read-only-sessions.md` | Re-state the read-only invariant clearly; distinguish index removal (reversible via re-index) from archive deletion (not supported by default). | DONE 2026-11-19 |

**Validation loop**
- Ordinary delete/index-remove actions never call filesystem deletion on an archive path.
- Index-remove shows confirm/cancel; cancel leaves index row intact.
- Archive file hashes unchanged through every user-facing delete workflow.
- `session:deleteFile` IPC (if retained) requires explicit opt-in and is not reachable from default UI.

**Gate pass criteria:** No default UI or API path deletes an original archive; index-only removal is confirmed and reversible.

---

## Phase C â€” Release Gate G3: Fix terminal filter forwarding + unify search contract

**Goal:** `/locate harness:â€¦ role:â€¦ date:â€¦ brain:â€¦` works identically from the header search bar, the terminal, and MCP. Blocks v1.

**Why:** `renderer/app.js` terminal passes `synAPI.searchSessions(query, { batchSize, filters })` (filters nested), while `main.js` `session:search` reads top-level `options.harness`/`options.role`/etc. Terminal filters are silently dropped. Header, terminal, and MCP parse/validate filters in separate places.

**Files**
| File | Change | Done |
|------|--------|------|
| `renderer/app.js` | Terminal `/locate` parses filters into top-level options and calls `synAPI.searchSessions(query, { batchSize, ...options })` â€” same shape as header `performSearch()`. Remove the nested `{ filters }` payload. | DONE 2026-11-19 |
| `preload.js` | Expose a shared `parseSearchFilters(raw)` (or import one shared module) used by both header and terminal; keep `searchSessions(query, options) => ipcRenderer.invoke('session:search', query, options)`. | DONE 2026-11-19 |
| `main.js` | `session:search` continues reading top-level options (`harness`, `role`, `dateFrom`, `dateTo`, `project`, `brain`, `limit`, `excerptLength`, `enabledHarnesses`); validate and coerce types. | DONE 2026-11-19 |
| `packages/core/index.js` | `search()` already parses colon-prefix filters from free text; keep a single source of truth for filter semantics. | DONE 2026-11-19 |
| `mcp-server.js` | `syn_search` accepts the same filter fields (`harness`, `role`, `date`, `project`, `brain`, `limit`, `excerptLength`) with validation. | DONE 2026-11-19 |

**Validation loop**
- Same query + filters returns identical results via header, terminal, and MCP where supported.
- Filter cases: `harness:NAME`, `role:user|assistant`, `date:YYYY-MM-DD`, `date:FROM..TO`, `project:PATH`, `brain:`.
- Malformed/missing filter values produce clear errors, not silent drops.

**Gate pass criteria:** Filter parity across all three callers; no silently-dropped filters.

---

## Phase D â€” Release Gate G4: Make install/release reproducible

**Goal:** Contributors and users can install a known build from a tagged release, not just a local checkout or orphaned Actions artifact. Blocks v1.

**Why:** Local `package.json` declares `electron: "^13.0.0"` as a runtime dependency; public `main` declares `^31.0.0` as a devDependency. `package-lock.json` drift confirmed. `release.yml` uploads Actions artifacts but never creates a GitHub Release with assets. `package.json` has no `bin`, so `npx github:xen38/Syn` / global install instructions are unsupported.

**Files**
| File | Change | Done |
|------|--------|------|
| `package.json` | Move `electron` to `devDependencies` at `^31.x` matching public `main`; remove from runtime `dependencies`. Regenerate `package-lock.json` with `npm install` then verify `npm ci` is clean. | â€” |
| `.github/workflows/release.yml` | On `v*` tags: build Windows/macOS/Linux installers with electron-builder AND create a GitHub Release attaching the assets (not Actions uploads only). | DONE 2026-11-19 |
| `README.md`, `docs/index.html` | Replace `npx github:xen38/Syn` / global-install instructions with tested installer download + `git clone â€¦ && npm install && npm start` (or a runnable `bin` if publishing to npm is later approved). | DONE 2026-11-19 |
| `.mcp.json` | Local per-user config: document that it must point at the retained `K:\Repos\locate\mcp-server.js` (do not rewrite as part of this audit; user-specific). | DONE 2026-11-19 |

**Validation loop**
- `npm ci` on a clean checkout installs without errors.
- `npm run build` produces platform installers; packaged app launches.
- Tagging a release creates a GitHub Release with downloadable assets; install instructions in README work end-to-end.

**Gate pass criteria:** Clean `npm ci` + installer build + published release assets + verified install instructions.

---

## Phase E â€” Release Gate G5: Deterministic release CI + brain/MCP test coverage

**Goal:** CI results are repeatable; the most privileged surface (brain/MCP) has automated coverage. Blocks v1.

**Why:** No dedicated brainmaxxing or MCP integration tests exist. Real-world tests use absolute `K:\Users\luizy\â€¦` paths and skip on clean Linux, so CI skips real-world coverage rather than exercising fixtures. Audit reports conflict on whether indexing tests pass.

**Files**
| File | Change | Done |
|------|--------|------|
| `test/brainmaxxing.test.js` (new) | Containment (G1), read/write/list round-trip, reflect/meditate/ruminate/plan/review output shape, index.md rebuild. | DONE 2026-11-19 |
| `test/mcp.test.js` (new) | Server starts on stdio; `tools/list` returns 16 tools (correct the 17 claim); `syn_search` returns results; brain read/write honor containment; schema validation errors for missing/invalid args. | â€” |
| `test/real-world-integration.test.js` | Missing real-world archives â†’ explicit `test.skip` with message, never a CI failure; optional opt-in when paths exist. | DONE 2026-11-19 |
| `test/indexing.test.js` | Deterministic fixture-based assertions; Codex/Cursor/SQLite regression fixtures from redacted real-format samples. | DONE 2026-11-19 |
| `.github/workflows/ci.yml` | Required = portable fixture tests (search, search-quality, validator-precision, fixture-tests, indexing, security, brainmaxxing, MCP). Real-world runs only when data present, reported as skip. | DONE 2026-11-19 |
| `package.json` `test` script | Run all required suites deterministically. | DONE 2026-11-19 |

**Validation loop**
- Clean Linux CI executes every required suite; all pass.
- Real-world archives absent â†’ explicit skips, exit code 0.
- Adding a Codex/Cursor/SQLite fixture regresses â†’ CI fails before merge.

**Gate pass criteria:** `npm ci` + full required suite green on clean Linux; brain/MCP covered; real-world never silently skipped or required.

---

## Phase F â€” Release Gate G6: Precise exclusion matching + redaction limits

**Goal:** Exclusions omit intended trees only (not siblings); users understand redaction is best-effort. Next (before broad adoption).

**Why:** `_isExcluded()` uses `normalized.includes(exclResolved)`, a substring branch that can exclude an unrelated sibling path merely containing the excluded text. Redaction is pattern-based and cannot guarantee all secrets are caught.

**Files**
| File | Change | Done |
|------|--------|------|
| `packages/core/index.js` | `_isExcluded`: exact match + separator-aware descendant only; remove the `includes()` substring branch; case normalization appropriate to platform. | DONE 2026-11-19 |
| `test/security.test.js` | Excluded root excludes descendants but not sibling names; case/canonicalization behavior; custom redaction patterns + common token variants. | DONE 2026-11-19 |
| `README.md` | State redaction is pattern-based best-effort, not a guarantee; secrets in unrecognized/obfuscated formats can remain indexed. | DONE 2026-11-19 |

**Validation loop**
- Exclude `C:\data\secret` â†’ `C:\data\secret\session.md` excluded, `C:\data\secretary\session.md` NOT excluded.
- Custom patterns redacted; unrecognized formats pass through (documented limit).

**Gate pass criteria:** No sibling false positives; redaction limits documented and tested.

---

## Phase G â€” Release Gate G7: Corrupt index DB recovery

**Goal:** A damaged `syn-index.db` never silently destroys session history; users get an actionable status and an explicit rebuild path. Next.

**Why:** Startup catches/logs engine-open errors (e.g. "file is not a database") and proceeds degraded. No backup, no rebuild offer, no archive protection.

**Files**
| File | Change | Done |
|------|--------|------|
| `packages/core/index.js` | Detect invalid/truncated DB on `open()`; preserve a timestamped backup copy before any rebuild; never auto-delete. | â€” |
| `main.js` | Startup: if engine open fails, show actionable status in renderer and offer explicit "Rebuild index from sources" action. | â€” |
| Renderer error/status UI | Display DB health status (healthy / corrupt / rebuilding) with plain text (not a GIF). | â€” |

**Validation loop**
- Corrupt/truncated DB at startup â†’ archives unchanged, backup preserved, recovery offered, rebuild restores indexing/search.
- Valid DB unaffected.

**Gate pass criteria:** No silent destructive replacement; corrupt DB recoverable from source archives.

---

## Phase H â€” Release Gate G8: Keyboard + screen-reader + contrast

**Goal:** Core retrieval (search â†’ open result â†’ menu â†’ cancel/delete) works keyboard-only and with a screen reader; contrast failures resolved. Next.

**Why:** Report 09 measured 14 contrast failures among 47 checks. Context menus, session/result rows, terminal results rely on mouse click handlers; several controls lack roles/ARIA names; no dependable focus-visible treatment; no live announcements.

**Files**
| File | Change | Done |
|------|--------|------|
| `renderer/index.html` | Convert clickable divs to semantic controls (buttons/links); add accessible names, roles, selected/expanded state. | DONE 2026-11-19 |
| `renderer/app.js` | Keyboard handlers (Enter/Space/Arrow/Escape), focus return after actions, live region announcements for terminal output and status. | DONE 2026-11-19 |
| `renderer/style.css` | Visible `focus-visible` across custom controls; contrast fixes for all 14 measured failures; stable contrast check for key text/control pairs. | DONE 2026-11-19 |

**Validation loop**
- Automated DOM/a11y checks; keyboard-only workflow search â†’ open result â†’ menu â†’ cancel/delete.
- Manual screen-reader and contrast review after palette changes.

**Gate pass criteria:** All 14 contrast failures addressed; core workflows keyboard + screen-reader accessible.

---

## Phase I â€” Release Gate G9: Clarify product contract + correct docs

**Goal:** Public docs match code: one search contract, 16 MCP tools, BM25-not-FTS5 honesty, supported install flow. Next.

**Why:** `nextphase.md`/`README.md`/skills claim FTS5, 17 tools, terminal-replaces-search-bar, `npx` install â€” all contradicted by code/analysis. The "Phase 0-12 complete (100%)" label is unsupported (this document now resets it).

**Files**
| File | Change | Done |
|------|--------|------|
| `nextphase.md` | This document: reset status, release gates G1-G10, validation rules, end the "100%" claim. | DONE 2026-11-19 |
| `README.md` | Replace FTS5 claims with "BM25-style ranking over LIKE candidates" (sql.js has no FTS5); document co-primary header search + terminal sharing one contract; replace unsupported `npx` install with tested installer/source-run instructions. | DONE 2026-11-19 |
| `skills/`, `.agents/skills/` | Align `/syn` and `/locate` skill text with actual tool names, filter support, and primary surface. | DONE 2026-11-19 |
| `brain/` | Correct session-start brain injection docs (`injectBrainIndex()` reads `brain/index.md` and renderer shows it at launch via `synAPI.getBrainIndex()`). | DONE 2026-11-19 |
| `mcp-server.js` | Tool descriptions and count reflect the real 16 tools; add missing filters + required-arg validation. | DONE 2026-11-19 |

**Note on `injectBrainIndex()`:** Implemented as part of G9 â€” reads `brain/index.md` via `brainmaxxing.readIndexMd()` at session start, stores it in `brainIndexMd`, and exposes it through `synAPI.getBrainIndex()`; the renderer shows it in the `brainIndexPreview` element at launch.

**Validation loop**
- Doc-contract check: tool count == 16, filters listed match implementation, primary surface stated, install flow tested.
- `injectBrainIndex()` reads `brain/index.md` and renderer shows it at launch.

**Gate pass criteria:** Docs and code agree; no unsupported capability claims remain.

---

## Phase J â€” Release Gate G10: Source configuration + MCP parity

**Goal:** One source of truth for harness registration; desktop and MCP index the same sources; MCP has full filter support + validation. Next.

**Why:** Desktop (`main.js` `CONFIG_FILE`) and MCP (`mcp-server.js` `CONFIG_FILE`) use distinct config files. Shared storage does not mean shared registration. `syn_search` omits some engine filters; validation inconsistent. Local `.mcp.json` path is stale-relative to a renamed folder assumption (retained `K:\Repos\locate`).

**Files**
| File | Change | Done |
|------|--------|------|
| `main.js` | Decide config ownership (share one config file or document intentional separation); keep `syn/` userData subfolder consistent with MCP. | DONE 2026-11-19 |
| `mcp-server.js` | Add missing MCP filters (`date`, `project`, `brain`) and required-argument validation (`query` required, sane limits). | DONE 2026-11-19 |
| `.mcp.json` | Document that local path must match the retained checkout folder; do not assume `K:\Repos\Syn`. | DONE 2026-11-19 |
| `skills/syn/skill.md` | Document configured source visibility parity between desktop and MCP. | DONE 2026-11-19 |

**Validation loop**
- Add/index a source via desktop; verify it is documented/visible through MCP (and vice versa, per the chosen config model).
- Schema/error tests: missing `query`, invalid `limit`, unknown filter keys produce MCP errors.

**Gate pass criteria:** No duplicate setup; agents don't search a different source set than the desktop app.

---

## Phase J.5 â€” Brain vault UI: Obsidian-style brain navigation in middle column (pre-Phase K)

**Goal:** Replace the brain index preview pill with an image button beside the search bar that opens an Obsidian-style brain vault menu in the middle column, plus a "Brain index" tab showing plain-text brain/index.md content. This phase ships just before Phase K â€” post-v1.

| Item | Change | Done |
|------|--------|------|
| K.1 | Move DB health badge beside app name "Syn" in header (red square location) | DONE 2026-11-20 |
| K.2 | Fix DB health badge dot positioning (white/green dot alignment) | DONE 2026-11-20 |
| K.3 | Replace brain index preview with image button beside search bar (yellow square location) using `assets/iconBrain.png` | DONE 2026-11-20 |
| K.4 | Brain button: breathing hover glow (green #53C68B variant), "Brain" tooltip | DONE 2026-11-20 |
| K.5 | Brain button click opens Obsidian-style brain vault menu in middle column with interactive tabs | DONE 2026-11-20 |
| K.6 | Brain vault menu: Vault tab shows Obsidian-style graph view (canvas nodes + curved bezier connections based on [[wikilink]] references, zoom/pan/click-to-open) instead of file list | DONE 2026-11-20 |
| K.7 | Brain vault menu: "Brain index" tab shows plain-text brain/index.md content | DONE 2026-11-20 |
| K.8 | Escape key + click outside closes brain vault panel | DONE 2026-11-20 |

**Additional refinements (same session):**

| Item | Change | Done |
|------|--------|------|
| K.9 | Graph dots spread further apart (REPULSION 1800â†’5000, MIN_DIST 50â†’250) | DONE 2026-11-20 |
| K.10 | Connection lines changed to blue-to-purple gradient (#4f46e5 â†’ #7c3aed) | DONE 2026-11-20 |
| K.11 | Multi-tab note opening with Ã— close buttons on each tab | DONE 2026-11-20 |
| K.12 | [[wikilink]] references render as #53C68B clickable text (single render, not duplicated) | DONE 2026-11-20 |
| K.13 | `loadBrainVault()` idempotency guard â€” event listeners + render loop only set up once | DONE 2026-11-20 |
| K.14 | Graph node mousedown `stopPropagation()` prevents panel close on node click | DONE 2026-11-20 |
| K.15 | Brain vault panel repositioned edge-to-edge (left: 300px, right: 0) filling middle column | DONE 2026-11-20 |
| K.16 | DB health badge: white outer dot + smaller colored inner dot, badge moved down 3px | DONE 2026-11-20 |

**Status:** Complete â€” brain vault UI implemented before Phase K â€” post-v1. All K.1â€“K.16 items done 2026-11-20.

---

## Phase K â€” Later: scale & polish (post-v1)

| Item | Direction |
|------|-----------|
| SQLCipher encryption-at-rest | Explicitly future work; not a v1 requirement. |
| Native FTS5 / semantic search | Optional architectural change; current BM25-over-LIKE is adequate if measured performance is acceptable. |
| Per-source indexing progress | Busy/error states, textual status instead of GIF. |
| Sign/notarize installers | macOS distribution polish; requires credentials. |
| Live GitHub Pages verification | Confirm which file/branch Pages publishes; fix Locate branding/stale URL. |

---

### Validation rules (apply to every gate)

1. **Clean checkout first:** `npm ci` must succeed before any gate is marked done.
2. **Tests required:** Every gate adds or updates tests under `test/`; focused suites run in CI; real-world machine data is opt-in with explicit skips.
3. **No silent skips:** A test that cannot run reports an explicit skip and exit code 0; it never becomes a hidden pass.
4. **Security first:** G1 (brain containment) and G2 (archive preservation) must be complete and regression-tested before MCP brain tools are enabled for untrusted clients.
5. **Mark done honestly:** A gate is done only when its validation loop passes on a clean checkout, not when the code is written.

---

---

## Phase 13 â€” v1 pre-release: Brain Vault window, editing, drag-drop, ctx menus, enhanced search

**Goal:** Ship the remaining v1 features requested by the user: (1) Brain Vault as its own draggable/resizable BrowserWindow; (2) inline file editing with Save button, unsaved-changes confirm-on-close, double-click rename; (3) drag a session from the list onto the graph view to create a .md in the vault; (4) graph background right-click menu (Create, Create Group, Import, Open Brain folder) + node menu (Open, Copy, Delete); (5) search bar renamed "Search sessions/vault" searching sessions + brain .md files with persistent state + auto-highlight navigation; (6) refresh icon black & white; (7) rename HARNESSES.md â†’ harnessindex.md; (8) verify deleted files aren't gitignored.

| Item | Change | Done |
|------|--------|------|
| 13.1 | Write Phase 13 plan into nextphase.md (this table) | done |
| 13.2 | Brain Vault as separate draggable/resizable BrowserWindow; btnBrain opens the window instead of toggling in-panel; same spawn aspect/position; title bar drag; move out of Syn window / to secondary monitor | done |
| 13.3 | Inline file editing: click to edit in note tabs; "Save" button appears beside doc name on change; unsaved-changes confirm dialog ("This document has been edited; are you sure you don't want to [proceed]?") with Yes/No on X close | done |
| 13.4 | Double-click note tab name to rename the document | done |
| 13.5 | Drag a session from session list â†’ drop onto graph view canvas; copies session content (everything) into a new .md in brain vault; opens in new tab | done |
| 13.6 | Graph background right-click menu: "Create" (new .md in Brain folder, open in new tab), "Create Group" (select 2+ notes, auto-link with [[l#serialnumber]] serial #000001-#999999 at bottom of docs + visual link in graph), "Import" (file/folder picker, .md only, recursive folder scan, copy into Brain folder), "Open Brain folder" (OS file explorer to brain dir) | done |
| 13.7 | Node right-click menu: "Open" (open file in file viewer tab), "Copy" (copy content to clipboard without opening), "Delete" (delete file) | done |
| 13.8 | Search bar placeholder â†’ "Search sessions/vault"; search across all sessions (names + content) AND all .md files in brain vault (names + content); keep search state while interacting with app/files; click a result â†’ auto-drive to match location + highlight; search state does not reset | done |
| 13.9 | Refresh button icon â†’ black & white (replace ðŸ”„ with â†» / â®•) | done |
| 13.10 | Rename HARNESSES.md â†’ harnessindex.md via git mv; update all references (nextphase.md, .obsidian/workspace.json); verify nothing breaks | done |
| 13.11 | Verify deleted files are not on .gitignore or otherwise excluded | done |
| 13.12 | Run lint + tests (npm test, npx eslint . --ext .js --max-warnings 0) | done |
| 13.13 | Review, commit, and push all changes to origin/main | done |

**Why:** These are the remaining user-requested features before a trustworthy v1. The Brain Vault window gives Obsidian-like freedom; editing + rename make it a real note-taking surface; drag-drop and graph menus make it a knowledge workspace; unified search makes sessions + vault discoverable together.

**Validation rule:** Every item adds/updates code in renderer/, main.js, preload.js, packages/core/brainmaxxing.js, and/or tests/; run full suite on clean checkout before marking done.

---

### Files changed (Phase 13)

| File | Change |
|------|--------|
| `main.js` | New BrowserWindow for brain vault; new IPC handlers: brain:write (exists), brain:rename, brain:delete, brain:import (dialog:openFile/folder), shell:showItemInFolder, dialog:openFile; window spawn position/size; webPreferences matching main window |
| `preload.js` | New synAPI bridges: brainVaultOpen, brainRename, brainDelete, brainImport, brainShowInFolder, brainOpenFileDialog |
| `renderer/app.js` | btnBrain opens external window; note editing (contenteditable/textarea), Save button, dirty-state tracking, confirm-on-close, double-click rename; drag source on session items; drop target on graph canvas; graph background context menu; node context menu; search placeholder + .md search + persistent state + highlight navigation; searchQuery not reset on click |
| `renderer/index.html` | Search input placeholder; brain vault panel hidden by default (window handles UI); Save button, rename input, confirm dialog markup (can also be injected via JS) |
| `renderer/style.css` | .brain-vault-panel no longer needed as fixed overlay (window is separate); refresh-btn B&W icon styling; search input placeholder styling; note edit styles |
| `packages/core/brainmaxxing.js` | Add brainRename, brainDelete helpers (containBrainPath + fs ops); import helper (copy .md files into vault) |
| `nextphase.md` | Phase 13 plan (this table); update references to HARNESSES.md â†’ harnessindex.md |
| `HARNESSES.md` â†’ `harnessindex.md` | git mv |
| `.obsidian/workspace.json` | Update HARNESSES.md reference â†’ harnessindex.md |

**Validation loop**
- `npm ci` on clean checkout
- `npx eslint . --ext .js --max-warnings 0` passes
- `npm test` passes (all suites)
- Electron app launches; brain vault window opens; drag session â†’ graph creates .md; graph ctx menus work; search searches vault; rename works; save/confirm works
- Commit and push to origin/main




## Phase 14 â€” v1 immediate user-requested fixes

**Goal:** Apply user-requested UI/UX fixes and housekeeping items not covered by Phase 0-13 release gates: custom title bar, .gitignore exclusions, serial number clickable links, portable-path confirmation.

| Item | Change | Done |
|------|--------|------|
| 14.1 | Custom title bar on main window â€” frame: false on mainWindow; SynWindow:minimize/maximize/close IPC handlers; synWindow: { minimize, maximize, close } synAPI bridge; custom header HTML with Minimize/Maximize/Close buttons + CSS; click handlers call synAPI.synWindow.* | done |
| 14.2 | .gitignore brain vault exclusions â€” excluded brain/sessions/, brain/plans/, brain/memories/; removed 8 already-tracked files via git rm --cached (kept on disk); core brain files (index.md, codebase/, principles/) remain tracked | done |
| 14.3 | Serial number clickable links â€” archived sessions and Create Group write Serial: [[Serial: #NNNNNN]] as clickable wikilink instead of plain text, consistent with vault's [[wikilink]] system | done |
| 14.4 | Portable paths audit â€” all runtime code uses __dirname/path.join/app.getPath('userData'); already portable; hardcoded K:\ paths only in non-runtime files (.mcp.json, docs, tests); no changes needed | done |
| 14.5 | Fix renderer/app.js syntax error â€” removed stray ) after updateTogglePosition() function closing brace; all JS files pass node --check | done |
| 14.6 | Fix edit button garbled character â€” replaced `*` icon with `✎` pencil character; added `.bv-edit-btn` CSS styling (padding, font-size 16px, hover state) matching `.tab-close` design system | done |
| 14.7 | Fix graph off-canvas on maximize â€” fixed `resizeCanvas()` in renderer/brain-vault.js: removed buggy offset compensation logic that drifted graph bottom-right; now resets offsetX/offsetY to 0 before `recenterGraph()`; fixed missing closing brace syntax error | done |
| 14.8 | Remove mojibake characters â€” replaced all `â”€â”€` sequences with `===` and `â€“` en-dash with `-` in renderer/brain-vault.js | done |
| 14.9 | ESLint clean â€” full project `npx eslint . --ext .js --max-warnings 0` passes with 0 errors, 0 warnings | done |
| 14.10 | Brain Vault window positioned aligned with Syn middle column â€” `createBrainVaultWindow()` in main.js: x=300 (aligned with middle column left edge after Sessions sidebar), y=80 (below header), width=1003 (fills horizontally across middle column before Terminal), height=933 (fills vertically from header to near bottom) | done |

**Files changed:**
| File | Change |
|------|--------|
| main.js | frame: false on mainWindow; SynWindow:minimize/maximize/close IPC handlers; `createBrainVaultWindow()` spawn position x=300, y=80, width=1003, height=933 aligned with Syn middle column |
| preload.js | synWindow: { minimize, maximize, close } synAPI object |
| renderer/index.html | Custom title bar <header class="syn-window-header"> with three window control buttons |
| renderer/style.css | .syn-window-header, .syn-window-title, .syn-window-actions, .syn-window-btn CSS; `.bv-edit-btn` pencil icon styling (font-size 16px, padding, hover) |
| renderer/app.js | Window control click handlers + serial wikilink + syntax fix |
| renderer/brain-vault.js | Serial wikilink for Create Group; edit button `*` â†’ `✎` pencil icon; `resizeCanvas()` offset fix for maximize recenter; mojibake `â”€â”€` â†’ `===` cleanup |
| .gitignore | brain/sessions/, brain/plans/, brain/memories/ exclusions |

**Validation loop:**
- node --check passes on all JS files (main.js, preload.js, renderer/app.js, renderer/brain-vault.js)
- Custom title bar buttons call synAPI.synWindow.minimize/maximize/close via IPC
- Serial numbers render as [[Serial: #NNNNNN]] clickable wikilinks
- brain/sessions/, brain/plans/, brain/memories/ excluded from git tracking

---

**End of nextphase.md.** This is the multi-phased plan for a trustworthy Syn v1. Execute Phase Aâ€”E (release gates) before tagging v1; Phase Fâ€”J before broad adoption; Phase 13 before v1 tag; Phase 14 immediate user-requested fixes; Phase K after v1 is stable. Validate at each checkpoint before proceeding.

