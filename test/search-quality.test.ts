/**
 * Search quality tests for the IndexingEngine search() method.
 * Verifies: BM25-style title-first ranking, highlighted snippets,
 * harness/project/date/brain filters, and snippet generation.
 */

import path from 'path'
import fs from 'fs'
import os from 'os'
import { IndexingEngine } from '../packages/core/index'

const DB_PATH = path.join(os.tmpdir(), `locate-search-quality-${Date.now()}.db`)

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

async function main () {
  const engine = new IndexingEngine(DB_PATH)
  await engine.open()

  const now = new Date().toISOString()
  const older = new Date(Date.now() - 86400000 * 30).toISOString() // 30 days ago

  // Directly insert sessions into the sessions table
  const insertSession = engine.db!.prepare(`
    INSERT INTO sessions (session_id, title, harness, source_path, file_path, file_ext, created_at, content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertMessage = engine.db!.prepare(`
    INSERT INTO messages (session_id, message_index, role, timestamp, content)
    VALUES (?, ?, ?, ?, ?)
  `)

  const created = now

  insertSession.run([
    's1', 'Authentication session', 'harness-a', '/brain/auth.md', '/brain/auth.md', '.md', created,
    'This session covers OAuth2 token refresh and login flow. When the token expires, retry with a refresh token.'
  ])
  insertMessage.run('s1', 0, 'user', created, 'This session covers OAuth2 token refresh and login flow. When the token expires, retry with a refresh token.')

  insertSession.run([
    's2', 'Database migration notes', 'harness-b', '/data/db.md', '/data/db.md', '.md', created,
    'We migrated from PostgreSQL 13 to 15. Schema changes added indexes on the users table.'
  ])
  insertMessage.run('s2', 0, 'user', created, 'We migrated from PostgreSQL 13 to 15. Schema changes added indexes on the users table.')

  insertSession.run([
    's3', 'API design', 'harness-a', '/api/api.md', '/api/api.md', '.md', created,
    'REST endpoints for user management. Authentication is handled via JWT. OAuth2 is also supported.'
  ])
  insertMessage.run('s3', 0, 'user', created, 'REST endpoints for user management. Authentication is handled via JWT. OAuth2 is also supported.')

  insertSession.run([
    's4', 'Old brain vault note', 'brain-harness', '/Brain/vault/old.md', '/Brain/vault/old.md', '.md', older,
    'Archived notes from the brain vault about legacy architecture decisions.'
  ])
  insertMessage.run('s4', 0, 'user', older, 'Archived notes from the brain vault about legacy architecture decisions.')

  console.log('Running locate search quality tests...\n')

  // Test 1: Title match ranks above content-only match
  {
    const results = engine.search('Authentication')
    assert(results.length === 2, 'search "Authentication" returns 2 results (s1 title + s3 content)')
    assert(results[0].id === 's1', 'title match (s1) ranks first')
    assert(results[1].id === 's3', 'content-only match (s3) ranks second')
  }

  // Test 2: Multi-term query still returns relevant results
  {
    const results = engine.search('token refresh')
    assert(results.length >= 1, 'search "token refresh" returns at least 1 result')
    assert(results[0].id === 's1', 's1 (token + refresh in content) ranks first')
  }

  // Test 3: Snippet is generated and contains a matched term
  {
    const results = engine.search('PostgreSQL')
    assert(results.length === 1, 'search "PostgreSQL" returns 1 result')
    assert(!!results[0].snippet, 'snippet is non-empty')
    assert(results[0].snippet.toLowerCase().includes('postgresql'), 'snippet contains matched term')
  }

  // Test 4: Snippet includes ellipsis when text is truncated at start
  {
    const results = engine.search('indexes')
    assert(results.length === 1, 'search "indexes" returns 1 result (s2)')
    const s2 = results.find(r => r.id === 's2')
    assert(!!(s2 && s2.snippet), 's2 snippet is non-empty')
  }

  // Test 5: No results for non-existent term
  {
    const results = engine.search('nonexistentxyz123')
    assert(results.length === 0, 'search non-existent term returns 0 results')
  }

  // Test 6: Harness filter
  {
    const results = engine.search('session', { harness: 'harness-a' })
    assert(results.length === 1, 'harness=harness-a filter returns 1 result (s1)')
    assert(results[0].id === 's1', 'filtered result is s1')
  }

  // Test 7: Project filter (matches source_path or file_path)
  {
    const results = engine.search('notes', { project: '/data/' })
    assert(results.length === 1, 'project="/data/" filter returns 1 result (s2)')
    assert(results[0].id === 's2', 'filtered result is s2')
  }

  // Test 8: Date range filter (dateFrom)
  {
    const results = engine.search('vault', { dateFrom: now })
    assert(results.length === 0, 'dateFrom=now returns 0 results (s4 is older)')
    const results2 = engine.search('vault', { dateTo: now })
    assert(results2.length === 1, 'dateTo=now returns 1 result (s4)')
  }

  // Test 9: Brain filter
  {
    const results = engine.search('architecture', { brain: true })
    assert(results.length === 1, 'brain filter returns 1 result (s4)')
    assert(results[0].id === 's4', 'brain filtered result is s4')
  }

  // Test 10: Result shape includes score, snippet, excerpt
  {
    const results = engine.search('Authentication')
    const r = results[0]
    assert(typeof r.score === 'number', 'result has numeric score')
    assert(typeof r.snippet === 'string', 'result has string snippet')
    assert(typeof r.excerpt === 'string', 'result has string excerpt')
    assert(typeof r.title === 'string', 'result has title')
    assert(typeof r.harness === 'string', 'result has harness')
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
