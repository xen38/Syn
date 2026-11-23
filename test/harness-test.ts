import path from 'path'
import fs from 'fs'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { wrapDb } from '../packages/core/db-compat'

type SqlJs = { Database: new (buffer: Uint8Array | null) => SqlJsDatabase }

let SQL: SqlJs | null = null
const initSqlJsFn = initSqlJs as unknown as (config: { locateFile: (file: string) => string }) => Promise<SqlJs>
const sqlPromise = initSqlJsFn({
  locateFile: (file: string) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
}).then(sql => { SQL = sql })

// Reuse the extraction functions from main.ts
function extractTextFromJsonl (content: string): string {
  const lines = content.split('\n').filter(l => l.trim())
  const texts: string[] = []
  for (const line of lines) {
    try {
      const obj = JSON.parse(line)
      const text = extractTextFromJsonValue(obj)
      if (text) texts.push(text)
    } catch {
      if (line.trim()) texts.push(line.trim())
    }
  }
  return texts.join('\n')
}

function extractTextFromJsonValue (obj: unknown): string {
  if (typeof obj === 'string') return obj
  if (obj === null || obj === undefined) return ''

  const record = obj as Record<string, unknown>
  if (typeof record.content === 'string') return record.content
  if (typeof record.message === 'string') return record.message
  if (typeof record.text === 'string') return record.text
  if (typeof record.prompt === 'string') return record.prompt
  if (typeof record.response === 'string') return record.response

  if (Array.isArray(record.content)) {
    return record.content
      .map((c: unknown) => (typeof c === 'string' ? c : (c as Record<string, unknown>).text || (c as Record<string, unknown>).content || ''))
      .filter(Boolean)
      .join('\n')
  }

  const parts: string[] = []
  for (const [k, v] of Object.entries(record)) {
    if (k === 'type' || k === 'id' || k === 'timestamp' || k === 'role') continue
    if (typeof v === 'string' && v.length > 0) parts.push(`${k}: ${v}`)
    else if (typeof v === 'object' && v !== null) {
      const t = extractTextFromJsonValue(v)
      if (t) parts.push(t)
    }
  }
  return parts.join('\n')
}

async function extractTextFromSqlite (dbPath: string): Promise<string> {
  try {
    await sqlPromise
    const buffer = fs.readFileSync(dbPath)
    const db = wrapDb(new SQL!.Database(buffer))
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

        const textCols = columns.filter(c =>
          /content|message|text|body|prompt|response|title|summary/i.test(c)
        )

        if (textCols.length === 0) continue

        const idCol = columns.find(c => /id|session|thread/i.test(c)) || columns[0]
        const query = `SELECT ${[idCol, ...textCols].join(', ')} FROM ${table} LIMIT 100`
        const rows = db.prepare(query).all()

        for (const row of rows) {
          const parts: string[] = []
          for (const col of textCols) {
            const val = (row as Record<string, unknown>)[col]
            if (val && typeof val === 'string') {
              parts.push(val)
            }
          }
          if (parts.length > 0) texts.push(parts.join('\n'))
        }
      } catch {
        // skip
      }
    }

    db.close()
    return texts.join('\n')
  } catch (e: unknown) {
    return `[SQLite error: ${(e as Error).message}]`
  }
}

async function readSessionFileContent (filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()
  try {
    switch (ext) {
    case '.jsonl':
      return extractTextFromJsonl(fs.readFileSync(filePath, 'utf8'))
    case '.json':
      try {
        const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        return extractTextFromJsonValue(obj)
      } catch {
        return extractTextFromJsonl(fs.readFileSync(filePath, 'utf8'))
      }
    case '.db':
    case '.sqlite':
      return extractTextFromSqlite(filePath)
    case '.md':
    case '.txt':
      return fs.readFileSync(filePath, 'utf8')
    default:
      return fs.readFileSync(filePath, 'utf8')
    }
  } catch (e: unknown) {
    return `[Error reading ${filePath}: ${(e as Error).message}]`
  }
}

interface TestCase {
  name: string
  file: string
}

const tests: TestCase[] = [
  { name: 'Cline JSON session', file: 'C:\\Users\\luizy\\.cline\\data\\sessions\\1793856300703_vVUs5_cli\\1793856300703_vVUs5_cli.json' },
  { name: 'Pi JSONL session', file: 'C:\\Users\\luizy\\.pi\\agent\\sessions\\--K----\\2026-11-05T06-15-33-232Z_01a1aa59-2c6f-70be-8872-b58b081de28e.jsonl' },
  { name: 'Cursor agent markdown', file: 'C:\\Users\\luizy\\.cursor\\agents\\meteor-client-expert.md' },
  { name: 'Copilot SQLite', file: 'C:\\Users\\luizy\\.copilot\\data.db' },
  { name: 'Codex SQLite', file: 'C:\\Users\\luizy\\.codex\\goals_1.sqlite' },
  { name: 'T3 SQLite', file: 'C:\\Users\\luizy\\.t3\\userdata\\statev2.sqlite' }
]

let passed = 0
let failed = 0

;(async () => {
  for (const t of tests) {
    try {
      if (!fs.existsSync(t.file)) {
        console.log(`SKIP: ${t.name} - file not found`)
        continue
      }
      const content = await readSessionFileContent(t.file)
      const len = content.length
      const preview = content.substring(0, 200).replace(/\n/g, ' ')
      if (len > 0) {
        console.log(`PASS: ${t.name} (${len} chars): ${preview}...`)
        passed++
      } else {
        console.log(`FAIL: ${t.name} - empty content`)
        failed++
      }
    } catch (e: unknown) {
      console.log(`FAIL: ${t.name} - ${(e as Error).message}`)
      failed++
    }
  }
})()

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
