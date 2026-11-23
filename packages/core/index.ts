/**
 * Locate Core Indexing Engine
 *
 * SQLite-based full-text search index for archived coding sessions.
 * Uses LIKE-based search (sql.js does not include FTS5).
 * Reads original session files read-only; never copies or modifies them.
 *
 * Schema:
 *   sources   - registered harness directories
 *   sessions  - session records (metadata + content)
 *   messages  - individual messages (role, timestamp, content, tool calls)
 */

import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import initSqlJs from 'sql.js'
import { wrapDb, SqlJsDatabase } from './db-compat'
import { AdapterRegistry } from '../adapters/registry'

// Supported session file extensions
export const SUPPORTED_EXTS = new Set<string>(['.md', '.txt', '.json', '.jsonl', '.db', '.sqlite'])

// ── Secret redaction patterns (Phase 8) ──────────────────────────────────
// Applied at index time to redact secrets from indexed content.
// Original files are never modified — only the indexed copy is redacted.

export interface SecretPattern {
  name: string
  pattern: RegExp
  replacement: string
}

const DEFAULT_SECRET_PATTERNS: SecretPattern[] = [
  // GitHub personal access tokens (classic and fine-grained)
  { name: 'GitHub token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { name: 'GitHub fine-grained token', pattern: /ghp_[A-Za-z0-9_]{36,}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  // AWS access keys
  { name: 'AWS access key', pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  { name: 'AWS secret key', pattern: /[0-9a-zA-Z/+]{40}/g, replacement: '[REDACTED_AWS_SECRET]' },
  // Generic API keys (sk-, pk-, etc.)
  { name: 'Generic API key', pattern: /(sk|pk|rk|sk-live|sk-test)_[A-Za-z0-9]{24,}/g, replacement: '[REDACTED_API_KEY]' },
  // Bearer tokens
  { name: 'Bearer token', pattern: /Bearer\s+[A-Za-z0-9\-_=.]+\b/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  // Passwords in config-style assignments
  { name: 'Password assignment', pattern: /(password|passwd|pwd|secret|api_key|apikey)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi, replacement: '$1: [REDACTED]' },
  // Private keys (PEM blocks)
  { name: 'Private key PEM', pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, replacement: '-----BEGIN REDACTED PRIVATE KEY-----\n[REDACTED]\n-----END REDACTED PRIVATE KEY-----' }
]

interface EngineOptions {
  redactSecrets?: boolean
  secretPatterns?: SecretPattern[]
  excludedPaths?: string[]
}

function redactSecrets (content: string, patterns: SecretPattern[]): string {
  if (!content || typeof content !== 'string') return content
  let redacted = content
  for (const p of patterns) {
    redacted = redacted.replace(p.pattern, p.replacement)
  }
  return redacted
}

type SqlJs = Awaited<ReturnType<typeof initSqlJs>>
let SQL: SqlJs | null = null
const sqlPromise = initSqlJs({
  locateFile: (file: string) => path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file)
}).then((sql: SqlJs) => { SQL = sql })

// Yield to the event loop so the UI stays responsive during long indexing
const sleep = (ms: number = 0): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

// Known non-session file / directory names that should never appear as sessions
const NON_SESSION_NAMES = new Set<string>([
  'models_cache',
  '.lease',
  'lease',
  'cache',
  'temp',
  'tmp',
  'lock',
  '.lock',
  'config',
  'settings',
  'preferences',
  '.config',
  'messages',
  '.messages',
  'providers',
  'feature-flags',
  'feature_flags',
  'credential',
  'credentials',
  'token',
  'tokens',
  'auth',
  'history',
  'index',
  'indexed_db',
  'leveldb',
  'localstorage',
  'websql'
])

function isNonSessionFile (filePath: string): boolean {
  const base = path.basename(filePath)
  const lower = base.toLowerCase()
  const nameWithoutExt = path.basename(filePath, path.extname(filePath))
  const nameWithoutExtLower = nameWithoutExt.toLowerCase()
  // Skip numeric-only filenames (e.g. "22135", "22136") - not real session files
  if (/^\d+$/.test(nameWithoutExtLower)) return true
  // Check name without extension against known non-session names (e.g. "config.json" -> "config")
  if (NON_SESSION_NAMES.has(nameWithoutExtLower)) return true
  if (NON_SESSION_NAMES.has(lower)) return true
  // Skip files whose name contains or ends with known non-session patterns
  // e.g. "139.lease.json", "foo.lease.db", ".lease" itself
  for (const name of NON_SESSION_NAMES) {
    if (lower === name || lower.endsWith('.' + name) || lower.includes('.' + name + '.')) return true
  }
  // Skip dotfiles that aren't recognized session formats
  if (lower.startsWith('.') && !['.jsonl', '.json', '.md', '.txt', '.db', '.sqlite'].includes(path.extname(lower))) return true
  return false
}

// ── Interfaces (from existing JSDoc) ─────────────────────────────────────

export interface SessionResult {
  id: string
  session_id: string
  title: string
  harness: string
  source_path: string
  file_path: string
  created_at: string
  rank: number
  score: number
  snippet: string
  excerpt: string
}

export interface IndexOptions {
  limit?: number
  harness?: string
  project?: string
  dateFrom?: string
  dateTo?: string
  brain?: boolean
  role?: string
  enabledHarnesses?: string[]
  excerptLength?: number
}

export interface Message {
  session_id: string
  message_index: number
  role: string
  timestamp: string
  content: string
  tool_calls: unknown
}

interface IndexSourceResult {
  sourceId: number
  sourcePath: string
  indexed: number
  skipped: number
  total: number
  sessionCount: number
  durationMs: number
}

interface IndexSourceErrorResult {
  sourceId: number
  sourcePath: string
  error: string
}

interface IncrementalIndexSourceResult {
  sourceId: number
  sourcePath: string
  indexed: number
  skipped: number
  deleted: number
  total: number
  sessionCount: number
  durationMs: number
}

interface SessionRow {
  id: number
  session_id: string
  title: string
  harness: string
  source_path: string
  file_path: string
  file_ext: string
  file_mtime: number
  file_size: number
  file_hash: string
  created_at: string
  indexed_at: string
  content_hash: string
  content: string
}

export interface SessionWithMessages extends SessionRow {
  messages: Message[]
}

interface FileSession {
  sessionId: string
  title: string
  createdAt: string
  messages: Message[]
  content: string
  filePath: string
  harness: string
}

type DbHealth = 'healthy' | 'corrupt' | 'rebuilding' | null

/**
 * SQLite-based full-text search index for archived coding sessions.
 * Uses sql.js backend with BM25-style ranking implemented in JS.
 */
export class IndexingEngine {
  dbPath: string
  db: SqlJsDatabase | null = null
  initialized = false
  registry: AdapterRegistry
  redactSecrets: boolean
  secretPatterns: SecretPattern[]
  excludedPaths: string[]
  dbHealth: DbHealth = null

  /**
   * @param dbPath - Path to the SQLite database file
   * @param options - Engine options
   */
  constructor (dbPath: string, options: EngineOptions = {}) {
    this.dbPath = dbPath
    this.db = null
    this.initialized = false
    this.registry = new AdapterRegistry()
    // Phase 8: Privacy & Security options
    this.redactSecrets = options.redactSecrets !== false // default: enabled
    this.secretPatterns = options.secretPatterns || DEFAULT_SECRET_PATTERNS
    this.excludedPaths = options.excludedPaths || [] // array of path substrings/patterns
    // Gate G7: database health tracking
    this.dbHealth = null
  }

  // ── Database health tracking (Gate G7) ─────────────────────────────────
  // 'healthy'   — DB opened and schema verified
  // 'corrupt'   — DB file exists but is invalid/truncated; backup preserved
  // 'rebuilding'— rebuild in progress from source archives
  // null        — not yet opened

  /**
   * Open the database, create schema, persist empty DB if new.
   * Detects invalid/truncated DB files, preserves a timestamped backup,
   * and never auto-deletes or silently replaces a corrupt DB.
   * @returns this instance
   */
  async open (): Promise<IndexingEngine> {
    await sqlPromise
    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    let buffer: Buffer | null = null
    if (fs.existsSync(this.dbPath)) {
      buffer = fs.readFileSync(this.dbPath)
    }

    if (!SQL) throw new Error('sql.js not initialized')
    try {
      this.db = wrapDb(new SQL.Database(buffer))
    } catch (err) {
      // Corrupt or truncated DB — preserve a timestamped backup, never auto-delete
      this.dbHealth = 'corrupt'
      if (buffer && buffer.length > 0) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        const backupPath = this.dbPath + '.corrupt-' + ts + '.bak'
        try {
          fs.writeFileSync(backupPath, buffer)
        } catch (bakErr) {
          // Backup failure is non-fatal; we still must not auto-delete the original
        }
      }
      // Leave this.db null so callers can check dbHealth and decide to rebuild
      return this
    }

    try {
      this.db.exec('PRAGMA journal_mode = WAL')
      this.db.exec('PRAGMA synchronous = NORMAL')
    } catch (err) {
      // DB appears valid but exec fails — treat as corrupt
      this.dbHealth = 'corrupt'
      const buffer2 = fs.readFileSync(this.dbPath)
      if (buffer2 && buffer2.length > 0) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        const backupPath = this.dbPath + '.corrupt-' + ts + '.bak'
        try {
          fs.writeFileSync(backupPath, buffer2)
        } catch (_) {}
      }
      try { this.db.close() } catch (_) {}
      this.db = null
      return this
    }

    this._createSchema()
    // Persist initial empty DB to disk so the file exists after open()
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, this.db.export())
    }
    this.dbHealth = 'healthy'
    this.initialized = true
    return this
  }

  /**
   * Rebuild the database from scratch: remove the current (possibly corrupt)
   * DB file after preserving a backup, create a fresh empty DB, and re-index
   * all registered sources. Caller must have registered sources before calling.
   * @param preserveCorrupt - if true, keep the corrupt DB as a .bak file
   * @returns indexAllSources result
   */
  async rebuild (preserveCorrupt: boolean = true): Promise<{ indexed: number; skipped: number; total: number }> {
    if (this.db) {
      try { this.db.close() } catch (_) {}
      this.db = null
    }
    this.dbHealth = 'rebuilding'

    if (fs.existsSync(this.dbPath)) {
      if (preserveCorrupt) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        fs.copyFileSync(this.dbPath, this.dbPath + '.rebuild-' + ts + '.bak')
      }
      try { fs.unlinkSync(this.dbPath) } catch (_) {}
      for (const ext of ['-wal', '-shm']) {
        try { fs.unlinkSync(this.dbPath + ext) } catch (_) {}
      }
    }

    // Re-open to create a fresh empty DB
    await this.open()

    // Re-index all registered sources
    const sources = this.listSources()
    let indexed = 0
    let skipped = 0
    let total = 0
    for (const source of sources) {
      const result = await this.indexSource(source.id)
      indexed += result.indexed
      skipped += result.skipped
      total += result.total
    }
    this.dbHealth = 'healthy'
    return { indexed, skipped, total }
  }

  _createSchema (): void {
    if (!this.db) throw new Error('Database not open')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        name TEXT,
        format TEXT,
        harness TEXT,
        session_count INTEGER DEFAULT 0,
        indexed_count INTEGER DEFAULT 0,
        last_scan TEXT,
        status TEXT DEFAULT 'pending',
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        title TEXT,
        harness TEXT,
        source_path TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_ext TEXT,
        file_mtime REAL,
        file_size INTEGER,
        file_hash TEXT,
        created_at TEXT,
        indexed_at TEXT DEFAULT (datetime('now')),
        content_hash TEXT,
        content TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        message_index INTEGER NOT NULL,
        role TEXT,
        timestamp TEXT,
        content TEXT,
        tool_calls TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_harness ON sessions(harness);
      CREATE INDEX IF NOT EXISTS idx_sessions_source ON sessions(source_path);
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
      CREATE INDEX IF NOT EXISTS idx_sessions_file ON sessions(file_path);
    `)
  }

  /**
   * Export and persist the database to disk, then close it.
   */
  close (): void {
    if (this.db) {
      const data = this.db.export()
      fs.writeFileSync(this.dbPath, data)
      this.db.close()
      this.db = null
      this.initialized = false
    }
  }

  // ── Fingerprinting ────────────────────────────────────────────────────

  _fingerprint (filePath: string): { mtime: number; size: number; hash: string } {
    try {
      const stat = fs.statSync(filePath)
      const hash = crypto.createHash('sha256')
        .update(filePath + '|' + stat.size + '|' + stat.mtimeMs)
        .digest('hex')
      return {
        mtime: stat.mtimeMs,
        size: stat.size,
        hash
      }
    } catch (e) {
      return { mtime: 0, size: 0, hash: '' }
    }
  }

  // Phase 8: Check if a file path matches any exclusion pattern
  // Uses exact match or separator-aware descendant match only — never a raw
  // substring (includes) check, which can exclude unrelated sibling paths
  // that merely contain the excluded text (e.g. excluding ".cline" would
  // also match ".cline-backup").
  _isExcluded (filePath: string): boolean {
    if (!this.excludedPaths || this.excludedPaths.length === 0) return false
    const normalized = this._normalizePath(path.resolve(filePath))
    return this.excludedPaths.some(excl => {
      const exclResolved = this._normalizePath(path.resolve(excl))
      // Exact match, or filePath is a descendant of exclResolved
      return normalized === exclResolved ||
             normalized.startsWith(exclResolved + path.sep)
    })
  }

  // Normalize path case according to platform semantics.
  // Windows/macOS are case-insensitive; POSIX is case-sensitive.
  _normalizePath (p: string): string {
    return process.platform === 'win32' || process.platform === 'darwin'
      ? p.toLowerCase()
      : p
  }

  // ── Text extraction (read-only) ──────────────────────────────────────

  /**
   * Read a text file read-only, stripping BOM.
   * @param filePath - Absolute path to the file
   * @returns File content as UTF-8 text
   * @throws If the file cannot be read
   */
  static readTextFile (filePath: string): string {
    return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  }

  /**
   * Extract plain text from JSONL content (one JSON object per line).
   * @param content - JSONL file content
   * @returns Joined text extracted from each line
   */
  static extractTextFromJsonl (content: string): string {
    const lines = content.split('\n').filter(l => l.trim())
    const texts: string[] = []
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        const text = IndexingEngine.extractTextFromJsonValue(obj)
        if (text) texts.push(text)
      } catch (e) {
        if (line.trim()) texts.push(line.trim())
      }
    }
    return texts.join('\n')
  }

  /**
   * Extract plain text from a parsed JSON value, recursing into objects/arrays.
   * @param obj - Parsed JSON value
   * @returns Extracted text
   */
  static extractTextFromJsonValue (obj: unknown): string {
    if (typeof obj === 'string') return obj
    if (obj === null || obj === undefined) return ''
    const record = obj as Record<string, unknown>
    if (typeof record.content === 'string') return record.content
    if (typeof record.message === 'string') return record.message
    if (typeof record.text === 'string') return record.text
    if (typeof record.prompt === 'string') return record.prompt
    if (typeof record.response === 'string') return record.response
    if (Array.isArray(record.content)) {
      return (record.content as unknown[])
        .map((c: unknown) => (typeof c === 'string' ? c : (c as Record<string, unknown>).text || (c as Record<string, unknown>).content || ''))
        .filter(Boolean)
        .join('\n')
    }
    const parts: string[] = []
    for (const [k, v] of Object.entries(record)) {
      if (k === 'type' || k === 'id' || k === 'timestamp' || k === 'role') continue
      if (typeof v === 'string' && v.length > 0) parts.push(`${k}: ${v}`)
      else if (typeof v === 'object' && v !== null) {
        const t = IndexingEngine.extractTextFromJsonValue(v)
        if (t) parts.push(t)
      }
    }
    return parts.join('\n')
  }

  /**
   * Extract text from a JSON file (tries single-object parse, falls back to JSONL).
   * @param filePath - Absolute path to the JSON file
   * @returns Extracted text, or '' on error
   */
  static extractTextFromJsonFile (filePath: string): string {
    try {
      const content = IndexingEngine.readTextFile(filePath)
      try {
        const obj = JSON.parse(content)
        return IndexingEngine.extractTextFromJsonValue(obj)
      } catch (e) {
        return IndexingEngine.extractTextFromJsonl(content)
      }
    } catch (e) {
      return ''
    }
  }

  /**
   * Extract text from a SQLite database file (scans text-like columns).
   * @param dbPath - Absolute path to the .db/.sqlite file
   * @returns Joined text from text columns
   */
  static async extractTextFromSqlite (dbPath: string): Promise<string> {
    try {
      await sqlPromise
      if (!SQL) throw new Error('sql.js not initialized')
      const buffer = fs.readFileSync(dbPath)
      const db = new SQL.Database(buffer)
      const texts: string[] = []
      const tables = db
        .prepare('SELECT name FROM sqlite_master WHERE type=\'table\'')
        .all()
        .map((r: Record<string, unknown>) => r.name as string)
      for (const table of tables) {
        try {
          const columns = db
            .prepare(`PRAGMA table_info(${table})`)
            .all()
            .map((c: Record<string, unknown>) => c.name as string)
          const textCols = columns.filter((c: string) =>
            /content|message|text|body|prompt|response|title|summary|objective|goal|description|note|answer|output/i.test(c)
          )
          if (textCols.length === 0) continue
          const idCol = columns.find((c: string) => /id|session|thread/i.test(c)) || columns[0]
          const query = `SELECT ${[idCol, ...textCols].join(', ')} FROM ${table} LIMIT 1000`
          const rows = db.prepare(query).all()
          for (const row of rows) {
            const parts: string[] = []
            for (const col of textCols) {
              if (row[col] && typeof row[col] === 'string') parts.push(row[col])
            }
            if (parts.length > 0) texts.push(parts.join('\n'))
          }
        } catch (e) {
          // skip unreadable tables
        }
      }
      db.close()
      return texts.join('\n')
    } catch (e) {
      return ''
    }
  }

  /**
   * Read session file content based on extension (jsonl/json/db/sqlite/md/txt).
   * @param filePath - Absolute path to the session file
   * @returns Extracted text content, or error placeholder string
   */
  static async readSessionFileContent (filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase()
    try {
      switch (ext) {
      case '.jsonl':
        return IndexingEngine.extractTextFromJsonl(IndexingEngine.readTextFile(filePath))
      case '.json':
        return IndexingEngine.extractTextFromJsonFile(filePath)
      case '.db':
      case '.sqlite':
        return await IndexingEngine.extractTextFromSqlite(filePath)
      case '.md':
      case '.txt':
        return IndexingEngine.readTextFile(filePath)
      default:
        return IndexingEngine.readTextFile(filePath)
      }
    } catch (e) {
      return `[Error reading ${filePath}: ${(e as Error).message}]`
    }
  }

  // ── Session parsing into messages ────────────────────────────────────

  /**
   * Parse a session file into an array of message objects.
   * @param filePath - Absolute path to the session file
   * @param sessionId - ID to assign to parsed messages
   * @returns Array of message objects
   */
  static async parseMessages (filePath: string, sessionId: string): Promise<Message[]> {
    const ext = path.extname(filePath).toLowerCase()
    const messages: Message[] = []

    try {
      if (ext === '.jsonl') {
        const content = IndexingEngine.readTextFile(filePath)
        const lines = content.split('\n').filter(l => l.trim())
        let index = 0
        for (const line of lines) {
          try {
            const obj = JSON.parse(line)
            messages.push({
              session_id: sessionId,
              message_index: index++,
              role: obj.role || 'unknown',
              timestamp: obj.timestamp || '',
              content: obj.content || obj.text || obj.message || '',
              tool_calls: obj.tool_calls || obj.tools || null
            })
          } catch (e) {
            messages.push({
              session_id: sessionId,
              message_index: index++,
              role: 'unknown',
              timestamp: '',
              content: line.trim(),
              tool_calls: null
            })
          }
        }
      } else if (ext === '.json') {
        const content = IndexingEngine.readTextFile(filePath)
        try {
          const obj = JSON.parse(content)
          // Single session object - may contain a messages array or be one message
          if (Array.isArray(obj.messages)) {
            obj.messages.forEach((m: Record<string, unknown>, i: number) => {
              messages.push({
                session_id: sessionId,
                message_index: i,
                role: (m.role as string) || 'unknown',
                timestamp: (m.timestamp as string) || '',
                content: (m.content as string) || (m.text as string) || (m.message as string) || '',
                tool_calls: (m.tool_calls as unknown) || null
              })
            })
          } else {
            messages.push({
              session_id: sessionId,
              message_index: 0,
              role: (obj.role as string) || 'unknown',
              timestamp: (obj.timestamp as string) || '',
              content: (obj.content as string) || (obj.text as string) || (obj.message as string) || '',
              tool_calls: (obj.tool_calls as unknown) || null
            })
          }
        } catch (e) {
          messages.push({
            session_id: sessionId,
            message_index: 0,
            role: 'unknown',
            timestamp: '',
            content,
            tool_calls: null
          })
        }
      } else if (ext === '.md' || ext === '.txt') {
        const content = IndexingEngine.readTextFile(filePath)
        // Split markdown into paragraphs/messages
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim())
        paragraphs.forEach((p: string, i: number) => {
          messages.push({
            session_id: sessionId,
            message_index: i,
            role: 'unknown',
            timestamp: '',
            content: p.trim(),
            tool_calls: null
          })
        })
      } else if (ext === '.db' || ext === '.sqlite') {
        await sqlPromise
        if (!SQL) throw new Error('sql.js not initialized')
        const buffer = fs.readFileSync(filePath)
        const db = new SQL.Database(buffer)
        const tables = db
          .prepare('SELECT name FROM sqlite_master WHERE type=\'table\'')
          .all()
          .map((r: Record<string, unknown>) => r.name as string)
        let index = 0
        for (const table of tables) {
          try {
            const columns = db
              .prepare(`PRAGMA table_info(${table})`)
              .all()
              .map((c: Record<string, unknown>) => c.name as string)
            const hasContent = columns.some((c: string) => /content|message|text|body|prompt|response/i.test(c))
            if (!hasContent) continue
            const contentCol = columns.find((c: string) => /content|message|text|body|prompt|response/i.test(c))
            const roleCol = columns.find((c: string) => /role/i.test(c))
            const tsCol = columns.find((c: string) => /timestamp|created_at|date/i.test(c))
            const rows = db.prepare(`SELECT * FROM ${table}`).all()
            rows.forEach((row: Record<string, unknown>) => {
              const rawContent = row[contentCol || ''] || ''
              // If content looks like JSON, extract meaningful text instead of raw JSON
              let content: string = String(rawContent)
              const trimmed = String(rawContent).trim()
              if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                  const parsed = JSON.parse(trimmed)
                  const extracted = IndexingEngine.extractTextFromJsonValue(parsed)
                  if (extracted && extracted.trim().length > 0) {
                    content = extracted
                  } else {
                    content = String(rawContent)
                  }
                } catch (e) {
                  content = String(rawContent)
                }
              }
              messages.push({
                session_id: sessionId,
                message_index: index++,
                role: roleCol ? (row[roleCol] as string) : 'unknown',
                timestamp: tsCol ? (row[tsCol] as string) : '',
                content,
                tool_calls: null
              })
            })
          } catch (e) {
            // skip
          }
        }
        db.close()
      }
    } catch (e) {
      // Return whatever we have
    }

    return messages
  }

  /**
   * Discover session files in a directory via the adapter registry.
   * @param dirPath - Absolute path to the harness directory
   * @param harness - Optional harness name for detection
   * @returns Array of session file paths
   */
  static collectSessionFiles (dirPath: string, harness: string | null = null): string[] {
    const registry = new AdapterRegistry()
    if (!harness) harness = registry.detectHarness(dirPath)
    try {
      // registry.discover() applies both the extension check (via adapters)
      // and the per-harness session validator, so only real session files
      // are returned. This replaces the previous extension-only scan which
      // produced false positives (agent definitions, caches, configs, etc.)
      return registry.discover(dirPath, harness).map(d => d.filePath)
    } catch (e) {
      // skip inaccessible directories
      return []
    }
  }

  // ── Source management ────────────────────────────────────────────────

  /**
   * Register a directory as an indexing source.
   * @param dirPath - Absolute path to the harness directory
   * @param harness - Optional override harness name
   * @returns The source id (existing or newly inserted)
   * @throws If dirPath does not exist or is not a directory
   */
  addSource (dirPath: string, harness: string | null = null): number {
    const normalized = path.resolve(dirPath)
    if (!fs.existsSync(normalized)) {
      throw new Error(`Directory does not exist: ${normalized}`)
    }
    const stat = fs.statSync(normalized)
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${normalized}`)
    }

    if (!this.db) throw new Error('Database not open')
    const name = path.basename(normalized)
    const detectedHarness = harness || this._detectHarness(normalized)

    const existing = this.db
      .prepare('SELECT id FROM sources WHERE path = ?')
      .get(normalized)
    if (existing) {
      return (existing as Record<string, unknown>).id as number
    }

    const info = this._analyzeDirectory(normalized)
    this.db
      .prepare(
        `INSERT INTO sources (path, name, format, harness, session_count, indexed_count, last_scan, status)
         VALUES (?, ?, ?, ?, 0, 0, NULL, 'pending')`
      )
      .run(normalized, name, info.format, detectedHarness)

    return (this.db
      .prepare('SELECT id FROM sources WHERE path = ?')
      .get(normalized) as Record<string, unknown>).id as number
  }

  /**
   * List all registered sources ordered by name.
   * @returns Source rows
   */
  listSources (): Array<{
    id: number; path: string; name: string; format: string; harness: string;
    session_count: number; indexed_count: number; last_scan: string | null;
    status: string; error: string | null
  }> {
    if (!this.db) throw new Error('Database not open')
    return this.db.prepare('SELECT * FROM sources ORDER BY name').all() as Array<{
      id: number; path: string; name: string; format: string; harness: string;
      session_count: number; indexed_count: number; last_scan: string | null;
      status: string; error: string | null
    }>
  }

  /**
   * Remove a source and all its sessions/messages from the index.
   * @param dirPath - Absolute path of the source to remove
   */
  removeSource (dirPath: string): void {
    if (!this.db) throw new Error('Database not open')
    const normalized = path.resolve(dirPath)
    // Delete sessions and their messages from this source
    const sessions = this.db
      .prepare('SELECT session_id FROM sessions WHERE source_path = ?')
      .all(normalized) as Array<{ session_id: string }>
    for (const s of sessions) {
      this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(s.session_id)
      this.db.prepare('DELETE FROM sessions WHERE session_id = ?').run(s.session_id)
    }
    this.db.prepare('DELETE FROM sources WHERE path = ?').run(normalized)
  }

  // Remove a single session from the index (undoable via re-index/refresh)
  /**
   * Remove a single session from the index (undoable via re-index/refresh).
   * @param sessionId - ID of the session to remove
   */
  removeSession (sessionId: string): boolean {
    if (!this.db) throw new Error('Database not open')
    const safeId = String(sessionId).replace(/'/g, '\'\'')
    this.db.exec(`DELETE FROM messages WHERE session_id = '${safeId}'`)
    this.db.exec(`DELETE FROM sessions WHERE session_id = '${safeId}'`)
    return true
  }

  _detectHarness (dirPath: string): string {
    return this.registry.detectHarness(dirPath)
  }

  _analyzeDirectory (dirPath: string): { format: string; fileCount: number } {
    const files = IndexingEngine.collectSessionFiles(dirPath)
    const exts = new Set<string>()
    for (const f of files) exts.add(path.extname(f).toLowerCase())
    let format = 'mixed'
    if (exts.size === 1) {
      const e = exts.values().next().value
      if (e === '.db' || e === '.sqlite') format = 'sqlite'
      else if (e === '.jsonl') format = 'jsonl'
      else if (e === '.json') format = 'json'
      else format = 'text'
    }
    return { format, fileCount: files.length }
  }

  // ── Indexing ─────────────────────────────────────────────────────────

  /**
   * Index all sessions from a registered source.
   * @param sourceId - ID of the source to index
   * @param options - Indexing options
   * @returns Indexing result
   */
  async indexSource (sourceId: number, options: { batchSize?: number } = {}): Promise<IndexSourceResult> {
    if (!this.db) throw new Error('Database not open')
    const source = this.db
      .prepare('SELECT * FROM sources WHERE id = ?')
      .get(sourceId) as Record<string, unknown> | undefined
    if (!source) throw new Error(`Source not found: ${sourceId}`)

    const batchSize = options.batchSize || 10
    const startTime = Date.now()
    let indexed = 0
    let skipped = 0

    const discovered = this.registry.discover(source.path as string, source.harness as string)
    const files = discovered.map(d => d.filePath)
    const discoveredSet = new Set(files)

    // Remove sessions from files that are no longer discovered (e.g. validator
    // changes that exclude previously-matched non-session files)
    const staleFiles = (this.db
      .prepare('SELECT DISTINCT file_path FROM sessions WHERE source_path = ?')
      .all(source.path as string) as Array<{ file_path: string }>)
      .map(r => r.file_path)
      .filter(fp => !discoveredSet.has(fp))
    for (const staleFile of staleFiles) {
      const sessionsToDelete = this.db
        .prepare('SELECT session_id FROM sessions WHERE file_path = ?')
        .all(staleFile) as Array<{ session_id: string }>
      for (const s of sessionsToDelete) {
        this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(s.session_id)
        this.db.prepare('DELETE FROM sessions WHERE session_id = ?').run(s.session_id)
      }
    }

    const upsertSession = this.db.prepare(`INSERT INTO sessions (session_id, title, harness, source_path, file_path, file_ext,
                            file_mtime, file_size, file_hash, created_at, content_hash, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        title = excluded.title,
        harness = excluded.harness,
        source_path = excluded.source_path,
        file_path = excluded.file_path,
        file_ext = excluded.file_ext,
        file_mtime = excluded.file_mtime,
        file_size = excluded.file_size,
        file_hash = excluded.file_hash,
        created_at = excluded.created_at,
        indexed_at = datetime('now'),
        content_hash = excluded.content_hash,
        content = excluded.content`)

    const insertMessage = this.db.prepare(`INSERT INTO messages (session_id, message_index, role, timestamp, content, tool_calls)
      VALUES (?, ?, ?, ?, ?, ?)`)

    // Phase 1: discover sessions from files (async, outside transaction)
    const work: Array<{
      fp: { mtime: number; size: number; hash: string }
      session: FileSession
      contentHash: string
      filePath: string
    }> = []
    const filesProcessedWithoutSessions = new Set<string>()
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      for (const filePath of batch) {
        // Skip known non-session files
        if (isNonSessionFile(filePath)) continue
        // Phase 8: Skip excluded paths
        if (this._isExcluded(filePath)) continue

        const fp = this._fingerprint(filePath)
        // Skip extremely large files that could crash the indexer
        const MAX_INDEX_FILE_SIZE = 200 * 1024 * 1024 // 200 MB
        if (fp.size > MAX_INDEX_FILE_SIZE) {
          skipped++
          console.log(`[ENGINE] indexSource: skipping oversized file ${filePath} (${(fp.size / 1024 / 1024).toFixed(1)} MB)`)
          continue
        }
        // Skip unchanged files (incremental indexing)
        const existing = this.db
          .prepare('SELECT file_hash, file_mtime, file_size FROM sessions WHERE file_path = ?')
          .get(filePath) as Record<string, unknown> | undefined
        if (existing && existing.file_hash === fp.hash && existing.file_mtime === fp.mtime && existing.file_size === fp.size) {
          skipped++
          continue
        }
        const sessions = await this._getFileSessions(filePath)
        // Filter out sessions that have no real content (not actual conversations)
        const validSessions = sessions.filter(s => {
          // Skip sessions with numeric-only IDs (not real conversations)
          if (/^\d+$/.test(String(s.sessionId || ''))) return false
          if (/^\d+$/.test(String(s.title || ''))) return false
          // Must have a valid title
          if (!s.title || s.title.trim().length === 0) return false

          // Sessions with no messages (e.g. Codex DB sessions where content is
          // remote) are still valid sessions — allow them through if they have
          // valid metadata. Sessions with messages still need real content.
          if (!s.messages || s.messages.length === 0) {
            return true
          }

          const hasContent = s.messages.some(m => {
            const c = typeof m.content === 'string' ? m.content : (m.content != null ? String(m.content) : '')
            return c.trim().length > 0
          })
          if (!hasContent) return false
          // Skip records whose content looks like raw JSON metadata, not conversation
          const firstContent = typeof s.messages[0].content === 'string' ? s.messages[0].content : (s.messages[0].content != null ? String(s.messages[0].content) : '')
          if (firstContent.trim().startsWith('{') && firstContent.trim().endsWith('}')) {
            try {
              const parsed = JSON.parse(firstContent)
              if (parsed.models || parsed.fetched_at || parsed.etag || parsed.identity) return false
            } catch (e) {}
          }
          // Reject sessions whose content is "[object Object]" (unextracted object content)
          const hasRealText = s.messages.some(m => {
            const c = typeof m.content === 'string' ? m.content : (m.content != null ? String(m.content) : '')
            return c.trim().length > 0 && c.trim() !== '[object Object]'
          })
          if (!hasRealText) return false
          return true
        })
        if (validSessions.length === 0) {
          filesProcessedWithoutSessions.add(filePath)
          continue
        }

        for (const s of validSessions) {
          const contentHash = crypto.createHash('sha256').update(s.content).digest('hex')
          work.push({
            fp,
            session: s,
            contentHash,
            filePath
          })
        }
      }
      // Yield between batches to keep UI responsive
      await sleep()
    }

    // Remove sessions from files that produced no valid sessions (e.g. empty
    // Codex/ChatGPT threads re-scanned after previous indexing left stale rows)
    for (const filePath of filesProcessedWithoutSessions) {
      const sessionsToDelete = this.db
        .prepare('SELECT session_id FROM sessions WHERE file_path = ?')
        .all(filePath) as Array<{ session_id: string }>
      for (const s of sessionsToDelete) {
        this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(s.session_id)
        this.db.prepare('DELETE FROM sessions WHERE session_id = ?').run(s.session_id)
      }
    }

    // Phase 2: write all to DB inside a transaction
    const tx = this.db.transaction(() => {
      for (const w of work) {
        const { fp, session, contentHash, filePath } = w
        upsertSession.run([
          session.sessionId,
          session.title,
          source.harness as string,
          source.path as string,
          filePath,
          path.extname(filePath).toLowerCase(),
          fp.mtime,
          fp.size,
          fp.hash,
          session.createdAt || new Date(fp.mtime).toISOString(),
          contentHash,
          this.redactSecrets ? redactSecrets(session.content, this.secretPatterns) : session.content
        ])

        this.db!.prepare('DELETE FROM messages WHERE session_id = ?').run(session.sessionId)
        for (const m of session.messages) {
          const mc = m.content
          let contentStr = typeof mc === 'string' ? mc : String(mc != null ? mc : '')
          if (this.redactSecrets) contentStr = redactSecrets(contentStr, this.secretPatterns)
          insertMessage.run([
            session.sessionId,
            m.message_index ?? 0,
            m.role,
            m.timestamp || '',
            contentStr,
            m.tool_calls != null ? JSON.stringify(m.tool_calls) : null
          ])
        }
        indexed++
      }
    })

    tx()

    const now = new Date().toISOString()
    const sessionCount = this.db
      .prepare('SELECT COUNT(*) as c FROM sessions WHERE source_path = ?')
      .get(source.path as string) as Record<string, unknown>
    const sessionCountVal = (sessionCount.c as number)

    this.db
      .prepare('UPDATE sources SET session_count = ?, indexed_count = ?, last_scan = ?, status = \'indexed\' WHERE id = ?')
      .run(sessionCountVal, indexed + skipped, now, sourceId)

    return {
      sourceId,
      sourcePath: source.path as string,
      indexed,
      skipped,
      total: files.length,
      sessionCount: sessionCountVal,
      durationMs: Date.now() - startTime
    }
  }

  /**
   * Index all registered sources.
   * @param options - Indexing options (passed to indexSource)
   * @returns Per-source results
   */
  async indexAllSources (options: { batchSize?: number } = {}): Promise<{
    indexed: number; skipped: number; total: number;
    sources: Array<IndexSourceResult | IndexSourceErrorResult>
  }> {
    const sources = this.listSources()
    const results: Array<IndexSourceResult | IndexSourceErrorResult> = []
    let totalIndexed = 0
    let totalSkipped = 0
    let totalTotal = 0

    for (const source of sources) {
      try {
        const result = await this.indexSource(source.id, options)
        results.push(result)
        totalIndexed += result.indexed || 0
        totalSkipped += result.skipped || 0
        totalTotal += result.total || 0
      } catch (e) {
        results.push({ sourceId: source.id, sourcePath: source.path, error: (e as Error).message })
      }
      // Yield between sources to keep UI responsive
      await sleep()
    }

    return {
      indexed: totalIndexed,
      skipped: totalSkipped,
      total: totalTotal,
      sources: results
    }
  }

  // ── Incremental indexing ─────────────────────────────────────────────

  /**
   * Incrementally index all sources (skip unchanged, delete removed files).
   * @param options - Indexing options
   * @returns Per-source results
   */
  async incrementalIndex (options: { batchSize?: number } = {}): Promise<Array<IncrementalIndexSourceResult | IndexSourceErrorResult>> {
    const sources = this.listSources()
    const results: Array<IncrementalIndexSourceResult | IndexSourceErrorResult> = []
    for (const source of sources) {
      try {
        const result = await this._incrementalIndexSource(source.id, options)
        results.push(result)
      } catch (e) {
        results.push({ sourceId: source.id, sourcePath: source.path, error: (e as Error).message })
      }
    }
    return results
  }

  async _incrementalIndexSource (sourceId: number, options: { batchSize?: number } = {}): Promise<IncrementalIndexSourceResult> {
    if (!this.db) throw new Error('Database not open')
    const source = this.db
      .prepare('SELECT * FROM sources WHERE id = ?')
      .get(sourceId) as Record<string, unknown> | undefined
    if (!source) throw new Error(`Source not found: ${sourceId}`)

    const batchSize = options.batchSize || 10
    const discovered = this.registry.discover(source.path as string, source.harness as string)
    const files = discovered.map(d => d.filePath)
    let indexed = 0
    let skipped = 0
    let deleted = 0

    // Get currently indexed file paths for this source
    const indexedPaths = new Set<string>(
      (this.db
        .prepare('SELECT file_path FROM sessions WHERE source_path = ?')
        .all(source.path as string) as Array<{ file_path: string }>)
        .map(r => r.file_path)
    )

    const upsertSession = this.db.prepare(`INSERT INTO sessions (session_id, title, harness, source_path, file_path, file_ext,
                            file_mtime, file_size, file_hash, created_at, content_hash, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        title = excluded.title,
        harness = excluded.harness,
        source_path = excluded.source_path,
        file_path = excluded.file_path,
        file_ext = excluded.file_ext,
        file_mtime = excluded.file_mtime,
        file_size = excluded.file_size,
        file_hash = excluded.file_hash,
        created_at = excluded.created_at,
        indexed_at = datetime('now'),
        content_hash = excluded.content_hash,
        content = excluded.content`)

    const insertMessage = this.db.prepare(`INSERT INTO messages (session_id, message_index, role, timestamp, content, tool_calls)
      VALUES (?, ?, ?, ?, ?, ?)`)

    // Phase 1: discover sessions from files (async, outside transaction)
    const work: Array<{
      fp: { mtime: number; size: number; hash: string }
      session: FileSession
      contentHash: string
      filePath: string
    }> = []
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      for (const filePath of batch) {
        const fp = this._fingerprint(filePath)
        // Skip extremely large files that could crash the indexer
        const MAX_INDEX_FILE_SIZE = 200 * 1024 * 1024 // 200 MB
        if (fp.size > MAX_INDEX_FILE_SIZE) {
          console.log(`[ENGINE] indexSource: skipping oversized file ${filePath} (${(fp.size / 1024 / 1024).toFixed(1)} MB)`)
          continue
        }
        // Phase 8: Skip excluded paths
        if (this._isExcluded(filePath)) continue
        const existing = this.db
          .prepare('SELECT file_hash, file_mtime, file_size FROM sessions WHERE file_path = ?')
          .get(filePath) as Record<string, unknown> | undefined

        if (existing && existing.file_hash === fp.hash && existing.file_mtime === fp.mtime && existing.file_size === fp.size) {
          skipped++
          indexedPaths.delete(filePath)
          continue
        }

        const sessions = await this._getFileSessions(filePath)
        if (sessions.length === 0) continue

        for (const s of sessions) {
          const contentHash = crypto.createHash('sha256').update(s.content).digest('hex')
          work.push({
            fp,
            session: s,
            contentHash,
            filePath
          })
        }

        indexedPaths.delete(filePath)
      }
    }

    // Phase 2: write all to DB inside a transaction
    const tx = this.db.transaction(() => {
      for (const w of work) {
        const { fp, session, contentHash, filePath } = w
        upsertSession.run([
          session.sessionId,
          session.title,
          source.harness as string,
          source.path as string,
          filePath,
          path.extname(filePath).toLowerCase(),
          fp.mtime,
          fp.size,
          fp.hash,
          session.createdAt || new Date(fp.mtime).toISOString(),
          contentHash,
          this.redactSecrets ? redactSecrets(session.content, this.secretPatterns) : session.content
        ])

        this.db!.prepare('DELETE FROM messages WHERE session_id = ?').run(session.sessionId)
        for (const m of session.messages) {
          let contentStr = m.content || ''
          if (this.redactSecrets) contentStr = redactSecrets(contentStr, this.secretPatterns)
          insertMessage.run([
            session.sessionId,
            m.message_index ?? 0,
            m.role,
            m.timestamp || '',
            contentStr,
            m.tool_calls != null ? JSON.stringify(m.tool_calls) : null
          ])
        }
        indexed++
      }

      // Remove deleted files (and all their sessions)
      for (const filePath of indexedPaths) {
        const sessionsToDelete = this.db!
          .prepare('SELECT session_id FROM sessions WHERE file_path = ?')
          .all(filePath) as Array<{ session_id: string }>
        for (const s of sessionsToDelete) {
          this.db!.prepare('DELETE FROM messages WHERE session_id = ?').run(s.session_id)
          this.db!.prepare('DELETE FROM sessions WHERE session_id = ?').run(s.session_id)
          deleted++
        }
      }
    })

    tx()

    const now = new Date().toISOString()
    const sessionCount = this.db
      .prepare('SELECT COUNT(*) as c FROM sessions WHERE source_path = ?')
      .get(source.path as string) as Record<string, unknown>
    const sessionCountVal = (sessionCount.c as number)

    this.db
      .prepare('UPDATE sources SET session_count = ?, indexed_count = ?, last_scan = ?, status = \'indexed\' WHERE id = ?')
      .run(sessionCountVal, indexed, now, sourceId)

    return {
      sourceId,
      sourcePath: source.path as string,
      indexed,
      skipped,
      deleted,
      total: files.length,
      sessionCount: sessionCountVal,
      durationMs: 0
    }
  }

  // ── Session extraction helpers ───────────────────────────────────────

  /**
   * Get all sessions from a file using the appropriate adapter.
   * Returns an array of { sessionId, title, createdAt, messages, content, filePath }.
   * Falls back to static parsing if no adapter matches.
   */
  static _uniqueSessionId (baseId: string, filePath: string): string {
    const hash = crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 8)
    return `${baseId}_${hash}`
  }

  async _getFileSessions (filePath: string): Promise<FileSession[]> {
    const ext = path.extname(filePath).toLowerCase()
    const adapter = this.registry.findAdapterForFile(filePath)

    if (adapter) {
      if (typeof adapter.parseAllSessions === 'function') {
        const sessions = await adapter.parseAllSessions(filePath)
        return sessions.map(s => {
          const content = (s.messages || [])
            .map(m => {
              const c = m.content
              return typeof c === 'string' ? c : String(c != null ? c : '')
            })
            .join('\n')
          return {
            sessionId: IndexingEngine._uniqueSessionId(s.sessionId, filePath),
            title: s.title,
            createdAt: s.createdAt || '',
            messages: s.messages || [],
            content: content || '',
            filePath,
            harness: s.harness || adapter.harness || 'Unknown'
          }
        })
      }
      const parsed = adapter.parseSession(filePath)
      if (parsed) {
        const text = await adapter.extractText(filePath)
        return [{
          sessionId: IndexingEngine._uniqueSessionId(parsed.sessionId, filePath),
          title: parsed.title,
          createdAt: parsed.createdAt || '',
          messages: parsed.messages || [],
          content: typeof text === 'string' ? text : String(text || ''),
          filePath,
          harness: parsed.harness || adapter.harness || 'Unknown'
        }]
      }
      return []
    }

    // Fallback: static parsing
    const content = await IndexingEngine.readSessionFileContent(filePath)
    let sessionId = path.basename(filePath, ext)
    let title = sessionId
    let createdAt = ''

    if (ext === '.json') {
      try {
        const obj = JSON.parse(content)
        sessionId = obj.session_id || sessionId
        title = obj.title || obj.label || title
        createdAt = obj.timestamp || obj.created_at || ''
      } catch (e) {}
    } else if (ext === '.jsonl') {
      try {
        const firstLine = content.split('\n')[0]
        if (firstLine) {
          const obj = JSON.parse(firstLine)
          sessionId = obj.session_id || sessionId
          title = obj.title || obj.label || title
          createdAt = obj.timestamp || obj.created_at || ''
        }
      } catch (e) {}
    } else {
      const firstLine = content.split('\n')[0]
      if (firstLine) title = firstLine.substring(0, 200)
      createdAt = new Date(this._fingerprint(filePath).mtime).toISOString()
    }

    return [{
      sessionId: IndexingEngine._uniqueSessionId(sessionId, filePath),
      title,
      createdAt,
      messages: await IndexingEngine.parseMessages(filePath, sessionId),
      content,
      filePath,
      harness: 'Unknown'
    }]
  }

  // Weights for the BM25-style ranking. Title matches are weighted more heavily
  // than content matches so sessions whose title names the topic rank first.
  static TITLE_WEIGHT = 5
  static CONTENT_WEIGHT = 1
  static TITLE_PRESENCE_BONUS = 10

  // Note: sql.js (this engine's SQLite backend) does not ship FTS5, so BM25-style
  // ranking is implemented in JavaScript over LIKE candidate rows. This delivers
  // the same quality goals (title-favoring weights, relevant snippets, filters)
  // without a native dependency or a DB backend switch.
  /**
   * Search sessions with BM25-style ranking, snippets, and filters.
   * sql.js has no native FTS5, so ranking runs in JS over LIKE candidate rows.
   * @param query - Space-separated search terms
   * @param options - Search options (limit, filters, excerpt length)
   * @returns Ranked results (title-biased), empty array if no terms
   */
  search (query: string, options: IndexOptions = {}): SessionResult[] {
    if (!this.db) throw new Error('Database not open')
    const limit = options.limit || 50
    const harness = options.harness || null
    const project = options.project || null
    const dateFrom = options.dateFrom || null
    const dateTo = options.dateTo || null
    const brain = options.brain || false
    const role = options.role || null
    const enabledHarnesses = options.enabledHarnesses || null
    const excerptLength = options.excerptLength || 200

    // Parse colon-prefix filters (harness:, project:, date:, role:, brain:)
    // out of the free-text query so the engine handles them directly.
    const rawQuery = query
    const brainMatch = rawQuery.match(/\bbrain:\s*/i)
    if (brainMatch) { options.brain = true; query = query.replace(brainMatch[0], ' ') }
    const dateMatch = rawQuery.match(/\bdate:(\S+)/i)
    if (dateMatch) {
      const range = dateMatch[1].split('..')
      options.dateFrom = range[0]
      if (range[1]) options.dateTo = range[1]
      query = query.replace(dateMatch[0], ' ')
    }
    const harnessMatch = rawQuery.match(/\bharness:(\S+)/i)
    if (harnessMatch) { options.harness = harnessMatch[1]; query = query.replace(harnessMatch[0], ' ') }
    const projectMatch = rawQuery.match(/\bproject:(\S+)/i)
    if (projectMatch) { options.project = projectMatch[1]; query = query.replace(projectMatch[0], ' ') }
    const roleMatch = rawQuery.match(/\brole:(\S+)/i)
    if (roleMatch) { options.role = roleMatch[1]; query = query.replace(roleMatch[0], ' ') }

    // Re-derive terms after filter tokens are stripped from the query.
    const filteredTerms = query.trim().split(/\s+/).filter((t: string) => t.length > 0)
    if (filteredTerms.length === 0) return []

    // Compute document frequency per term for IDF weighting.
    const totalSessions = this.db.prepare('SELECT COUNT(*) as c FROM sessions').get() as Record<string, unknown>
    const totalSessionsVal = (totalSessions.c as number)
    const idfWeights: Record<string, number> = {}
    for (const term of filteredTerms) {
      const like = '%' + term + '%'
      const df = this.db
        .prepare('SELECT COUNT(*) as c FROM sessions WHERE title LIKE ? OR content LIKE ?')
        .get(like, like) as Record<string, unknown>
      // Smoothed IDF: log(N / (df + 1)) + 1
      idfWeights[term] = Math.log(totalSessionsVal / ((df.c as number) + 1)) + 1
    }

    // Candidate set: sessions matching any query term in title or content.
    const termClauses = filteredTerms.map(() => '(s.title LIKE ? OR s.content LIKE ?)').join(' OR ')
    const params: unknown[] = []
    for (const term of filteredTerms) {
      const like = '%' + term + '%'
      params.push(like, like)
    }

    let sql = `
      SELECT s.id, s.session_id, s.title, s.harness, s.source_path, s.file_path,
             s.created_at, s.file_mtime
      FROM sessions s
      WHERE (${termClauses})
    `

    if (harness) {
      sql += ' AND s.harness = ?'
      params.push(harness)
    }
    if (project) {
      const like = '%' + project + '%'
      sql += ' AND (s.source_path LIKE ? OR s.file_path LIKE ?)'
      params.push(like, like)
    }
    if (brain) {
      sql += ' AND (s.source_path LIKE ? OR s.file_path LIKE ? OR s.source_path LIKE ? OR s.file_path LIKE ?)'
      params.push('%brain%', '%vault%', '%Brain%', '%Vault%')
    }
    if (dateFrom) {
      sql += ' AND s.created_at >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      sql += ' AND s.created_at <= ?'
      params.push(dateTo)
    }
    if (enabledHarnesses) {
      if (enabledHarnesses.length === 0) return []
      sql += ` AND s.harness IN (${enabledHarnesses.map(() => '?').join(', ')})`
      params.push(...enabledHarnesses)
    }
    if (role) {
      sql += ' AND EXISTS (SELECT 1 FROM messages m WHERE m.session_id = s.session_id AND m.role = ?)'
      params.push(role)
    }

    // Order deterministically before scoring; final ranking is done in JS.
    sql += ' ORDER BY s.created_at DESC'

    const rows = this.db.prepare(sql).all(params) as Array<Record<string, unknown>>

    // Score each candidate with BM25-style weighting and build a highlighted snippet.
    const results: SessionResult[] = rows.map((row) => {
      const title = (row.title as string) || ''
      const sessionContent = this._getSessionContent((row.session_id as string))
      const fullText = (title + '\n' + sessionContent)
      const score = this._bm25Score(filteredTerms, title, sessionContent, idfWeights)
      if (score <= 0) return null as unknown as SessionResult
      const snippet = this._snippet(fullText, filteredTerms, excerptLength)
      return {
        id: row.session_id as string,
        session_id: row.session_id as string,
        title,
        harness: (row.harness as string) || '',
        source_path: (row.source_path as string) || '',
        file_path: (row.file_path as string) || '',
        created_at: (row.created_at as string) || '',
        rank: score,
        score,
        snippet,
        excerpt: snippet
      }
    }).filter((r): r is SessionResult => r !== null)

    results.sort((a, b) => b.rank - a.rank || (a.title || '').localeCompare(b.title || ''))
    if (limit) results.length = Math.min(results.length, limit)
    return results
  }

  /**
   * Search individual messages matching a query term.
   * @param query - Search term matched against message content
   * @param options - Search options
   * @returns Message results
   */
  searchMessages (query: string, options: { limit?: number; harness?: string; role?: string } = {}): Array<{
    id: number; session_id: string; message_index: number; role: string;
    timestamp: string; content: string; title: string; harness: string;
    file_path: string; rank: number; snippet: string; excerpt: string
  }> {
    if (!this.db) throw new Error('Database not open')
    const limit = options.limit || 50
    const harness = options.harness || null
    const role = options.role || null

    const like = '%' + query + '%'

    let sql = `
      SELECT m.id, m.session_id, m.message_index, m.role, m.timestamp, m.content,
             s.title, s.harness, s.file_path,
             CASE
               WHEN m.content LIKE ? THEN 1
               ELSE 2
             END AS rank
      FROM messages m
      JOIN sessions s ON s.session_id = m.session_id
      WHERE m.content LIKE ?
    `
    const params: unknown[] = [like, like]

    if (harness) {
      sql += ' AND s.harness = ?'
      params.push(harness)
    }
    if (role) {
      sql += ' AND m.role = ?'
      params.push(role)
    }

    sql += ' ORDER BY rank, m.message_index'
    if (limit) {
      sql += ' LIMIT ?'
      params.push(limit)
    }

    const rows = this.db.prepare(sql).all(params) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: (row.id as number),
      session_id: (row.session_id as string),
      message_index: (row.message_index as number),
      role: (row.role as string),
      timestamp: (row.timestamp as string),
      content: (row.content as string),
      title: (row.title as string) || '',
      harness: (row.harness as string) || '',
      file_path: (row.file_path as string) || '',
      rank: (row.rank as number),
      snippet: this._snippet(row.content as string, [query], 200),
      excerpt: this._snippet(row.content as string, [query], 200)
    }))
  }

  // ── Session retrieval ─────────────────────────────────────────────────

  /**
   * Get a full session by ID including its messages.
   * @param sessionId - ID of the session to retrieve
   * @returns Session row with messages array, or null if not found
   */
  getSession (sessionId: string): SessionWithMessages | null {
    if (!this.db) throw new Error('Database not open')
    const session = this.db
      .prepare('SELECT * FROM sessions WHERE session_id = ?')
      .get(sessionId) as Record<string, unknown> | undefined
    if (!session) return null

    const messages = this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY message_index')
      .all(sessionId) as Array<Record<string, unknown>>

    return {
      ...session,
      messages: messages as unknown as Message[]
    } as SessionWithMessages
  }

  /**
   * Get messages around a given message index within a session.
   * @param sessionId - ID of the session
   * @param messageIndex - Center message index
   * @param before - messages before center
   * @param after - messages after center
   * @returns Context messages, or null if session not found
   */
  getContext (sessionId: string, messageIndex: number, before: number = 5, after: number = 5): {
    session: { id: string; title: string; harness: string; created_at: string }
    messages: Message[]
    centerIndex: number
  } | null {
    if (!this.db) throw new Error('Database not open')
    const session = this.db
      .prepare('SELECT * FROM sessions WHERE session_id = ?')
      .get(sessionId) as Record<string, unknown> | undefined
    if (!session) return null

    const messages = this.db
      .prepare(
        `SELECT * FROM messages WHERE session_id = ? AND message_index BETWEEN ? AND ?
         ORDER BY message_index`
      )
      .all(sessionId, messageIndex - before, messageIndex + after) as Array<Record<string, unknown>>

    return {
      session: {
        id: session.session_id as string,
        title: session.title as string,
        harness: session.harness as string,
        created_at: session.created_at as string
      },
      messages: messages as unknown as Message[],
      centerIndex: messageIndex
    }
  }

  /**
   * List indexed sessions, optionally filtered by harness/project/date.
   * @param options - List options
   * @returns Session rows
   */
  listSessions (options: { harness?: string; project?: string; dateFrom?: string; dateTo?: string; limit?: number; enabledHarnesses?: string[] } = {}): Array<{
    session_id: string; title: string; harness: string; source_path: string;
    file_path: string; created_at: string; indexed_at: string
  }> {
    if (!this.db) throw new Error('Database not open')
    const harness = options.harness || null
    const enabledHarnesses = options.enabledHarnesses || null
    const limit = options.limit || 10000
    let sql = 'SELECT * FROM sessions'
    const params: unknown[] = []
    const conditions: string[] = []
    if (harness) {
      conditions.push('harness = ?')
      params.push(harness)
    }
    if (enabledHarnesses) {
      if (enabledHarnesses.length === 0) return []
      conditions.push(`harness IN (${enabledHarnesses.map(() => '?').join(', ')})`)
      params.push(...enabledHarnesses)
    }
    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)
    return this.db.prepare(sql).all(params) as Array<{
      session_id: string; title: string; harness: string; source_path: string;
      file_path: string; created_at: string; indexed_at: string
    }>
  }

  /**
   * List all distinct harness names present in the index.
   * @returns Harness names
   */
  getAllHarnesses (): string[] {
    if (!this.db) throw new Error('Database not open')
    const rows = this.db.prepare('SELECT DISTINCT harness FROM sessions').all() as Array<{ harness: string | null }>
    return rows.map(r => r.harness).filter((h): h is string => h != null && h !== '')
  }

  countSessions (): number {
    if (!this.db) throw new Error('Database not open')
    const row = this.db.prepare('SELECT COUNT(*) as c FROM sessions').get() as Record<string, unknown>
    return (row.c as number)
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  _getSessionContent (sessionId: string): string {
    if (!this.db) throw new Error('Database not open')
    const messages = this.db
      .prepare('SELECT content FROM messages WHERE session_id = ? ORDER BY message_index')
      .all(sessionId) as Array<{ content: string }>
    return messages.map(m => m.content).join('\n')
  }

  // ── BM25-style scoring ───────────────────────────────────────────────

  // Score a session for the given query terms. Title matches are weighted more
  // heavily than content matches, and a term present in the title earns a bonus,
  // so sessions whose title names the topic rank first (BM25 "title bias").
  // IDF (inverse document frequency) down-weights terms that appear in many
  // sessions and up-weights rare, distinctive terms.
  _bm25Score (terms: string[], title: string, content: string, idfWeights: Record<string, number> = {}): number {
    let score = 0
    const titleLower = (title || '').toLowerCase()
    const contentLower = (content || '').toLowerCase()
    for (const term of terms) {
      const t = term.toLowerCase()
      const titleMatches = this._countOccurrences(titleLower, t)
      const contentMatches = this._countOccurrences(contentLower, t)
      const idf = idfWeights[term] || 1
      if (titleMatches > 0) {
        score += titleMatches * IndexingEngine.TITLE_WEIGHT * idf
        score += IndexingEngine.TITLE_PRESENCE_BONUS * idf
      }
      if (contentMatches > 0) {
        score += contentMatches * IndexingEngine.CONTENT_WEIGHT * idf
      }
    }
    return score
  }

  _countOccurrences (haystack: string, needle: string): number {
    let count = 0
    let pos = 0
    while ((pos = haystack.indexOf(needle, pos)) !== -1) {
      count++
      pos += needle.length
    }
    return count
  }

  // Build a highlighted excerpt centered on the best term match. Matched terms
  // are wrapped in <mark> so the UI can render highlighted snippets.
  _snippet (text: string, terms: string[], maxLength: number): string {
    if (!text) return ''
    const lower = text.toLowerCase()
    let bestIdx = -1
    let bestLen = 0
    for (const term of terms) {
      const t = term.toLowerCase()
      const idx = lower.indexOf(t)
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
        bestIdx = idx
        bestLen = t.length
      }
    }
    if (bestIdx === -1) return text.substring(0, maxLength)
    const start = Math.max(0, bestIdx - 80)
    const end = Math.min(text.length, bestIdx + bestLen + 80)
    let snippet = text.substring(start, end).replace(/\n/g, ' ')
    // Wrap all matched term occurrences in <mark> tags
    for (const term of terms) {
      const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
      snippet = snippet.replace(re, '<mark>$1</mark>')
    }
    if (start > 0) snippet = '...' + snippet
    if (end < text.length) snippet = snippet + '...'
    return snippet
  }

  _excerpt (content: string, query: string, maxLength: number): string {
    const queryLower = query.toLowerCase()
    const contentLower = content.toLowerCase()
    const idx = contentLower.indexOf(queryLower)
    if (idx < 0) {
      return content.substring(0, maxLength)
    }
    const start = Math.max(0, idx - 100)
    const end = Math.min(content.length, idx + query.length + 100)
    return content.substring(start, end).replace(/\n/g, ' ')
  }
}
