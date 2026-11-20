# Syn

![Syn](assets/syn-cat.png)

A unified agent memory environment and searchable memory infrastructure for AI coding agents.

Syn is an independent desktop application that acts as a centralized search engine for archived sessions and conversation history of AI coding agents. It allows both humans and AI agents to search, retrieve, explore, and read previous sessions across multiple coding harnesses without manually opening, parsing, or reading archive files themselves.

## Final project principle

**Syn is not a chat application.**
**Syn is not another coding agent.**
**Syn is not a file browser with a search box.**
**Syn is the unified agent memory environment and searchable memory infrastructure for AI coding agents.**

Its purpose is to make every previous session, archive, and craftable memory accessible across harnesses through a single, fast, reliable retrieval engine and interactive terminal.

An agent or user should be able to execute commands directly or ask:

```
/locate Find the implementation decision we made about authentication in the previous project.
```

Syn searches the archives and the Memory Vault (`brain/`), identifies the relevant session or file, retrieves the exact context, and returns it instantly.

The model does not need to read thousands of lines. The model does not need to inspect archive directories. The model does not need to waste tokens searching its own historical files.

It simply uses Syn's terminal or MCP tools (`syn_*`) to `/locate`, `/reflect`, `/meditate`, `/ruminate`, `/plan`, or `/review`.

## Architecture

Syn consists of three main components sharing a single indexing engine:

| Component | Description | Entry point |
|-----------|-------------|-------------|
| **Syn Core** | Indexing engine — discovery, parsing, indexing, search | `packages/core/index.js` |
| **Syn Desktop App** | Electron UI for humans to explore, search, and manage sessions | `main.js` + `renderer/` |
| **Syn MCP Server** | MCP tools for AI agents to search and retrieve programmatically | `mcp-server.js` |

The desktop app and MCP server share the same index database at `%APPDATA%\Syn\Syn-index.db`. Either component can index sources, and both can search the same index.

## Critical constraint

**NEVER COPY, MOVE, MODIFY, DUPLICATE, OR DELETE ORIGINAL SESSION FILES.** Syn only reads original files read-only. It maintains its own lightweight metadata database and search index, which never modify, duplicate, or delete the original session archives. Index removal (via "Delete Entry") only removes the entry from the search index; the original archive file on disk is never touched and can be restored by re-indexing.

## Security & privacy

### Secret redaction (best-effort)

Syn can optionally redact common secret patterns (GitHub tokens, AWS keys, and user-configured custom patterns) at index time. Redaction is **pattern-based and best-effort**, not a guarantee:

- Secrets in unrecognized, obfuscated, or split-across-lines formats can remain indexed.
- Custom patterns can be added via the `secretPatterns` engine option.
- Original files on disk are **never modified** — redaction applies only to the indexed copy in Syn's database.

### Path exclusions

Syn supports excluding directories from indexing via the `excludedPaths` engine option. Exclusion uses exact path match or separator-aware descendant match — a sibling path that merely contains the excluded text (e.g. `.cline` vs `.cline-backup`) is **not** excluded. Exclusion is applied at index time only; already-indexed entries are not retroactively removed.

## Supported adapters

File extensions → adapter:

| Extension | Adapter | Example harnesses |
|-----------|---------|-------------------|
| `.db`, `.sqlite` | SQLiteAdapter | Copilot `data.db`, Codex `goals_1.sqlite`, T3 `statev2.sqlite` |
| `.jsonl` | JsonlAdapter | Cline, Pi, Aider, Gemini CLI |
| `.json` | JsonAdapter | Cline, Continue, Zed |
| `.md`, `.txt` | TextAdapter | Cursor |

## Quick start

### Desktop app

Option 1 — download a prebuilt installer (recommended):

1. Go to https://github.com/xen38/Syn/releases and download the latest installer for your platform (Windows `.exe`, macOS `.dmg`, or Linux AppImage).
2. Run the installer and launch Syn.

Option 2 — run from source:

```bash
# Clone the repository
git clone https://github.com/xen38/Syn.git
cd Syn

# Install dependencies
npm install

# Run the app
npm start
```

### MCP server

```bash
# Run the MCP server on stdio
node mcp-server.js
```

Then register and index harness directories via MCP tools:

- `syn_add_harness` — register a directory
- `syn_index_source` / `syn_index_all` — index sessions
- `syn_search` — search across all indexed sessions

## Project structure

```
packages/core/        # Indexing engine
packages/adapters/    # Per-format parsers (SQLite, JSONL, JSON, Text)
main.js               # Electron main process (IPC handlers)
preload.js            # Electron preload (bridge to renderer)
renderer/             # Desktop UI
mcp-server.js         # MCP server (stdio transport)
test/                 # Indexing engine tests
docs/                 # Documentation (HARNESS_COMPATIBILITY.md, etc.)
skills/syn/           # /syn agent skill
skills/locate/        # /locate agent skill (legacy name)
```

## Search and retrieval model

Syn separates search from retrieval for token efficiency:

| Operation | What Syn returns |
|-----------|------------------|
| Search | Ranked excerpts from relevant sessions |
| Context | Relevant message + surrounding messages |
| Retrieve | Complete selected messages |
| Session | Entire session, only when explicitly requested |

### Ranking

Because the engine (sql.js) ships without native FTS5, ranking is implemented in JavaScript as a BM25-style scorer over LIKE candidate rows:

- **Title bias**: a term in the session title scores `TITLE_WEIGHT × 5` plus a `TITLE_PRESENCE_BONUS × 10`, so sessions whose title names the topic rank first.
- **Content matches**: each occurrence scores `CONTENT_WEIGHT × 1`.
- Final results sort by score descending, then title alphabetically.

Example: searching `Authentication` returns the session titled "Authentication session" before one that merely mentions authentication in its body.

### Snippets

Each search result includes a `snippet` — plain text centered on the first matched term, with `...` ellipsis when truncated. The UI wraps matched terms in a highlight span.

### Filters

Search accepts optional filter tokens typed directly into the top search bar:

| Token | Meaning | Example |
|-------|---------|---------|
| `harness:NAME` | Filter by harness | `harness:copilot error` |
| `project:PATH` | Filter by source/file path | `project:/src/ auth` |
| `date:YYYY-MM-DD` / `date:FROM..TO` | Date range | `date:2024-01-01..2024-01-31 bug` |
| `role:ROLE` | Message-level role (API compatibility) | `role:user login` |
| `brain:` | Brain/vault paths only | `brain: architecture` |

## Testing

```bash
npm test
```

## Documentation

- `docs/HARNESS_COMPATIBILITY.md` — archive structures and adapter strategy for 11+ harnesses
- `skills/syn/skill.md` — /syn agent skill
- `skills/locate/skill.md` — /locate agent skill (legacy)
