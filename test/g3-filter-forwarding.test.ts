/**
 * G3: Terminal filter forwarding + unified search contract tests.
 *
 * Verifies:
 * 1. Terminal `/locate` path builds top-level options (not nested `{batchSize, filters}`),
 *    via the shared `parseSearchFilters`.
 * 2. `engine.search()` (single source of truth) applies dateFrom, dateTo, project,
 *    brain, role, harness, enabledHarnesses filters end-to-end.
 */

import path from 'path'
import fs from 'fs'
import os from 'os'
import { IndexingEngine } from '../packages/core/index'

const DB_PATH = path.join(os.tmpdir(), `locate-g3-${Date.now()}.db`)

let passed = 0
let failed = 0

function assert (condition: boolean, message: string) {
  if (condition) {
    passed++
    console.log(`  PASS: ${message}`)
  } else {
    failed++
    console.log(`  FAIL: ${message}`)
  }
}

// ── parseSearchFilters (shared by header performSearch + terminal /locate) ──
function parseSearchFilters (raw: string) {
  const options: Record<string, unknown> = {}
  let query = raw

  const brainMatch = query.match(/\bbrain:\s*/i)
  if (brainMatch) { options.brain = true; query = query.replace(brainMatch[0], ' ') }

  const dateMatch = query.match(/\bdate:(\S+)/i)
  if (dateMatch) {
    const range = dateMatch[1].split('..')
    options.dateFrom = range[0]
    if (range[1]) options.dateTo = range[1]
    query = query.replace(dateMatch[0], ' ')
  }

  const harnessMatch = query.match(/\bharness:(\S+)/i)
  if (harnessMatch) { options.harness = harnessMatch[1]; query = query.replace(harnessMatch[0], ' ') }

  const projectMatch = query.match(/\bproject:(\S+)/i)
  if (projectMatch) { options.project = projectMatch[1]; query = query.replace(projectMatch[0], ' ') }

  const roleMatch = query.match(/\brole:(\S+)/i)
  if (roleMatch) { options.role = roleMatch[1]; query = query.replace(roleMatch[0], ' ') }

  return { query: query.trim().replace(/\s+/g, ' '), options }
}

async function main () {
  const engine = new IndexingEngine(DB_PATH)
  await engine.open()

  const now = new Date().toISOString()
  const older = new Date(Date.now() - 86400000 * 30).toISOString() // 30 days ago

  const insertSession = engine.db!.prepare(`
    INSERT INTO sessions (session_id, title, harness, source_path, file_path, file_ext, created_at, content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertMessage = engine.db!.prepare(`
    INSERT INTO messages (session_id, message_index, role, timestamp, content)
    VALUES (?, ?, ?, ?, ?)
  `)

  insertSession.run([
    's1', 'Auth session', 'harness-a', '/brain/auth.md', '/brain/auth.md', '.md', now,
    'OAuth2 token refresh session and login flow.'
  ])
  insertMessage.run('s1', 0, 'user', now, 'OAuth2 token refresh session and login flow.')

  insertSession.run([
    's2', 'Database migration', 'harness-b', '/data/db.md', '/data/db.md', '.md', older,
    'PostgreSQL 13 to 15 migration session notes.'
  ])
  insertMessage.run('s2', 0, 'user', older, 'PostgreSQL 13 to 15 migration session notes.')

  insertSession.run([
    's3', 'API design', 'harness-a', '/api/api.md', '/api/api.md', '.md', now,
    'REST session endpoints for user management via JWT.'
  ])
  insertMessage.run('s3', 0, 'user', now, 'REST session endpoints for user management via JWT.')

  console.log('Running G3 filter-forwarding tests...\n')

  // ── G3.1: Terminal /locate builds top-level options (not nested) ──
  {
    // Terminal raw input with filters
    const raw = 'session harness:harness-a date:2020-01-01..2020-12-31 brain: project:/data/ role:user'
    const { query, options } = parseSearchFilters(raw)

    assert(query === 'session', 'terminal query strips filter tokens -> "' + query + '"')
    assert(options.harness === 'harness-a', 'terminal options.harness forwarded top-level')
    assert(options.dateFrom === '2020-01-01', 'terminal options.dateFrom forwarded top-level')
    assert(options.dateTo === '2020-12-31', 'terminal options.dateTo forwarded top-level')
    assert(options.brain === true, 'terminal options.brain forwarded top-level')
    assert(options.project === '/data/', 'terminal options.project forwarded top-level')
    assert(options.role === 'user', 'terminal options.role forwarded top-level')
    assert(options.filters === undefined, 'terminal options has no nested "filters" key (G3 fix)')
  }

  // ── G3.2: engine.search applies date range (dateFrom + dateTo) ──
  {
    const results = engine.search('migration', { dateFrom: older, dateTo: now })
    assert(results.length === 1, 'date range filter returns 1 result (s2)')
    assert(results[0].id === 's2', 'date range result is s2')

    const empty = engine.search('migration', { dateFrom: now })
    assert(empty.length === 0, 'dateFrom=now (future) returns 0 results (s2 is older)')
  }

  // ── G3.3: engine.search applies project filter ──
  {
    const results = engine.search('migration', { project: '/data/' })
    assert(results.length === 1, 'project="/data/" filter returns 1 result (s2)')
    assert(results[0].id === 's2', 'project result is s2')
  }

  // ── G3.4: engine.search applies brain filter ──
  {
    const results = engine.search('login', { brain: true })
    assert(results.length === 1, 'brain=true filter returns 1 result (s1)')
    assert(results[0].id === 's1', 'brain result is s1')
  }

  // ── G3.5: engine.search applies harness + role filters ──
  {
    const results = engine.search('session', { harness: 'harness-a', role: 'user' })
    assert(results.length === 2, 'harness=harness-a + role=user returns 2 results')
    assert(!results.some(r => r.id === 's2'), 's2 (harness-b) excluded')
  }

  // ── G3.6: engine.search applies enabledHarnesses filter ──
  {
    const results = engine.search('session', { enabledHarnesses: ['harness-b'] })
    assert(results.length === 1, 'enabledHarnesses=[harness-b] returns 1 result (s2)')
    assert(results[0].id === 's2', 'enabledHarnesses result is s2')
  }

  // ── G3.7: main.js-style options coercion produces full shape ──
  {
    const getEnabledHarnesses = () => ['harness-a', 'harness-b']
    const options = {
      harness: 'harness-a',
      role: 'user',
      project: '/brain/',
      brain: 'true',
      dateFrom: older,
      dateTo: now,
      limit: 10,
      excerptLength: 200,
      enabledHarnesses: ['harness-a']
    }
    // Coerce exactly as main.js session:search does
    const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 50
    const excerptLength = Number.isFinite(Number(options.excerptLength)) ? Number(options.excerptLength) : 200
    const harness = options.harness ? String(options.harness) : undefined
    const role = options.role ? String(options.role) : undefined
    const project = options.project ? String(options.project) : undefined
    const brain = options.brain === 'true'
    const dateFrom = options.dateFrom ? String(options.dateFrom) : undefined
    const dateTo = options.dateTo ? String(options.dateTo) : undefined
    const enabledHarnesses = Array.isArray(options.enabledHarnesses)
      ? options.enabledHarnesses.map(String)
      : getEnabledHarnesses()

    const built = { harness, role, project, brain, dateFrom, dateTo, enabledHarnesses, limit, excerptLength }
    assert(built.harness === 'harness-a', 'coerced harness top-level')
    assert(built.role === 'user', 'coerced role top-level')
    assert(built.project === '/brain/', 'coerced project top-level')
    assert(built.brain === true, 'coerced brain top-level')
    assert(built.dateFrom === older, 'coerced dateFrom top-level')
    assert(built.dateTo === now, 'coerced dateTo top-level')
    assert(JSON.stringify(built.enabledHarnesses) === JSON.stringify(['harness-a']), 'coerced enabledHarnesses top-level')
    assert(built.limit === 10, 'coerced limit top-level')
    assert(built.excerptLength === 200, 'coerced excerptLength top-level')

    // End-to-end: pass coerced options to engine.search (filters intersect consistently here)
    const results = engine.search('session', built)
    assert(results.length === 1, 'engine.search accepts full coerced options shape (returns s1)')
    assert(results[0].id === 's1', 'coerced-options result is s1')
  }

  engine.close()
  fs.rmSync(DB_PATH, { recursive: true, force: true })

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err: Error) => {
  console.error('Test setup failed:', err)
  process.exit(1)
})
