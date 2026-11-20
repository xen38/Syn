/**
 * MCP server test suite for Gate G5.
 *
 * Tests the IndexingEngine operations that the Syn MCP server (mcp-server.js)
 * exposes via its syn_* tools, plus brainmaxxing operations used by
 * syn_read_brain / syn_write_brain. Uses fixture data so CI does not depend
 * on real user data.
 */

const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const { IndexingEngine } = require('../packages/core/index')
const bm = require('../packages/core/brainmaxxing')

const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const DB_PATH = path.join(os.tmpdir(), 'syn-mcp-test-index.db')

let passed = 0
let failed = 0

function assert (condition, message) {
  if (condition) {
    passed++
    console.log(`  PASS: ${message}`)
  } else {
    failed++
    console.log(`  FAIL: ${message}`)
  }
}

function cleanupDb () {
  try { fs.unlinkSync(DB_PATH) } catch (e) {}
  try { fs.unlinkSync(DB_PATH + '-wal') } catch (e) {}
  try { fs.unlinkSync(DB_PATH + '-shm') } catch (e) {}
}

cleanupDb()

async function runTests () {
  console.log('=== MCP Server Tests (engine-level, fixture-based) ===\n')

  // ── syn_status equivalent ──
  console.log('Test 1: Engine status (syn_status equivalent)')
  const engine = new IndexingEngine(DB_PATH)
  await engine.open()
  assert(engine.initialized, 'engine should be initialized')
  const sources = engine.listSources()
  assert(Array.isArray(sources), 'listSources should return an array')
  const count = engine.countSessions()
  assert(typeof count === 'number', 'countSessions should return a number')

  // ── syn_add_harness + syn_index_source equivalent ──
  console.log('\nTest 2: Register and index fixture sources (syn_add_harness / syn_index_source)')
  const clineDir = path.join(FIXTURES_DIR, 'cline/sessions')
  const cursorDir = path.join(FIXTURES_DIR, 'cursor/agent-transcripts/abc123')
  const aiderDir = path.join(FIXTURES_DIR, 'aider')
  const geminiDir = path.join(FIXTURES_DIR, 'gemini')

  const cId = engine.addSource(clineDir, 'Cline')
  assert(cId > 0, 'should add Cline source')
  const cuId = engine.addSource(cursorDir, 'Cursor')
  assert(cuId > 0, 'should add Cursor source')
  const aId = engine.addSource(aiderDir, 'Aider')
  assert(aId > 0, 'should add Aider source')
  const gId = engine.addSource(geminiDir, 'Gemini CLI')
  assert(gId > 0, 'should add Gemini CLI source')

  const allSources = engine.listSources()
  assert(allSources.length >= 4, `should have >= 4 sources (got ${allSources.length})`)

  const indexResult = await engine.indexAllSources()
  assert(indexResult.indexed > 0, `should index sessions (got ${indexResult.indexed})`)
  assert(indexResult.status !== 'error', 'indexing should not error')

  // ── syn_search equivalent ──
  console.log('\nTest 3: Search (syn_search equivalent)')
  const results = engine.search('session')
  assert(results.length > 0, `should find results for "session" (got ${results.length})`)
  assert(results.every(r => r.title && r.harness), 'results should have title and harness')
  assert(results.some(r => r.excerpt && typeof r.excerpt === 'string'), 'results should have excerpts')

  // Harness-filtered search
  const clineResults = engine.search('session', { harness: 'Cline' })
  assert(clineResults.length > 0, 'should find Cline results with harness filter')
  assert(clineResults.every(r => r.harness === 'Cline'), 'all Cline-filtered results should be Cline')

  // Date-range search
  const dated = engine.search('session', { dateFrom: '2024-01-01', dateTo: '2026-12-31' })
  assert(dated.length >= 0, 'date-range search should work without error')

  // Empty query
  const empty = engine.search('')
  assert(empty.length >= 0, 'empty query search should work without error')

  // ── syn_get_session equivalent ──
  console.log('\nTest 4: Get session (syn_get_session equivalent)')
  const sessions = engine.listSessions()
  assert(sessions.length > 0, 'should have sessions to retrieve')
  const session = engine.getSession(sessions[0].session_id)
  assert(session !== null, 'should retrieve session by ID')
  assert(session.messages !== undefined, 'session should have messages')
  assert(Array.isArray(session.messages), 'messages should be an array')

  // ── syn_get_context equivalent ──
  console.log('\nTest 5: Get context (syn_get_context equivalent)')
  if (session.messages.length > 0) {
    const ctx = engine.getContext(session.session_id, 0, 2, 2)
    assert(ctx !== null, 'should retrieve context')
    assert(Array.isArray(ctx.messages), 'context messages should be an array')
    assert(ctx.messages.length > 0, 'context should have messages')
  }

  // ── syn_list_sessions equivalent ──
  console.log('\nTest 6: List sessions (syn_list_sessions equivalent)')
  const listed = engine.listSessions()
  assert(listed.length > 0, 'should list sessions')
  assert(listed.every(s => s.session_id && s.title), 'listed sessions should have id and title')

  // ── syn_list_harnesses equivalent ──
  console.log('\nTest 7: List sources/harnesses (syn_list_harnesses equivalent)')
  const srcs = engine.listSources()
  assert(srcs.length >= 4, 'should list sources')
  assert(srcs.every(s => s.path && s.harness), 'sources should have path and harness')

  // ── Archive integrity (read-only) ──
  console.log('\nTest 8: Archive file integrity (read-only indexing)')
  const originalHashes = {}
  function collectHashes (dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) collectHashes(full)
      else if (e.isFile() && !/-wal$|-shm$/.test(e.name)) {
        originalHashes[full] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')
      }
    }
  }
  collectHashes(FIXTURES_DIR)
  await engine.indexAllSources()
  let integrityOk = true
  for (const [f, hash] of Object.entries(originalHashes)) {
    const current = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
    if (current !== hash) {
      console.log(`    FILE MODIFIED: ${f}`)
      integrityOk = false
    }
  }
  assert(integrityOk, 'original fixture files must remain unchanged after indexing')

  // ── brainmaxxing: syn_read_brain / syn_write_brain equivalent ──
  console.log('\nTest 9: Brain read/write (syn_read_brain / syn_write_brain equivalent)')
  const brainWriteResult = bm.brainWrite('mcp/test-note.md', '# MCP test note')
  assert(brainWriteResult.ok, 'brainWrite should succeed for valid path')
  const brainReadResult = bm.brainRead('mcp/test-note.md')
  assert(brainReadResult.ok, 'brainRead should succeed for valid path')
  assert(brainReadResult.content && brainReadResult.content.includes('MCP test note'), 'brainRead should return written content')

  // Brain containment: reject traversal
  const escapeResult = bm.brainWrite('../../../escape.txt', 'escape attempt')
  assert(!escapeResult.ok, 'brainWrite should reject path traversal')

  // Brain list
  const brainList = bm.brainList('mcp')
  assert(Array.isArray(brainList), 'brainList should return an array')

  // Cleanup brain test file
  try { fs.unlinkSync(path.join(bm.BRAIN_DIR, 'mcp/test-note.md')) } catch (e) {}

  // ── syn_remove source equivalent ──
  console.log('\nTest 10: Remove source (index-only removal)')
  engine.removeSource(clineDir)
  const sourcesAfter = engine.listSources()
  assert(sourcesAfter.length === allSources.length - 1, 'source should be removed')

  engine.close()
  cleanupDb()

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(e => {
  console.error('Test error:', e)
  cleanupDb()
  process.exit(1)
})
